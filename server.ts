import "dotenv/config";
import express, { Request, Response as ExpressResponse, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
// cors will be imported dynamically inside startServer
import helmet from 'helmet';

import { GoogleGenAI } from "@google/genai";
import {
  createToken,
  verifyToken,
  authenticate,
  generateEncryptionKey,
  logApiCall,
  hashPassword,
  sanitizeInput,
  encryptSensitiveData,
  decryptSensitiveData,
} from './src/lib/security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// SECURITY & INITIALIZATION
// ============================================

// Генерировать encryption key если его нет
if (!process.env.DATABASE_ENCRYPTION_KEY || process.env.DATABASE_ENCRYPTION_KEY === '') {
  const newKey = generateEncryptionKey();
  console.log('\n🔐 Generated DATABASE_ENCRYPTION_KEY - ADD THIS TO YOUR .env FILE:');
  console.log(newKey);
  console.log('\nSet: DATABASE_ENCRYPTION_KEY="' + newKey + '"\n');
  process.env.DATABASE_ENCRYPTION_KEY = newKey;
}

// Проверить пароль
if (!process.env.APP_PASSWORD) {
  console.warn('⚠️ WARNING: APP_PASSWORD not set! Using default "admin" - CHANGE THIS IN PRODUCTION!');
  process.env.APP_PASSWORD = 'admin';
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 попыток
  message: 'Too many login attempts, please try again after 15 minutes',
  skipSuccessfulRequests: true,
});

// Initialize Database
const dbPath = path.resolve("patient_data.db");
const db = new Database(dbPath);
const patientColumns = db.prepare("PRAGMA table_info(patients)").all() as Array<{ name: string }>;
const hasPatientColumn = (name: string) => patientColumns.some((column) => column.name === name);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    gender TEXT NOT NULL,
    snils TEXT,
    policy_number TEXT,
    contact_info TEXT,
    menopause_mode TEXT,
    menopause_status_manual TEXT,
    last_menstruation_date TEXT,
    bilateral_oophorectomy INTEGER DEFAULT 0,
    menopause_status TEXT,
    menopause_basis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    data JSON NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients (id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    action TEXT,
    resource TEXT,
    details TEXT,
    ip_address TEXT,
    status_code INTEGER
  );

  CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    model TEXT,
    api_key_encrypted TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Добавить колонки если их нет
if (!hasPatientColumn('menopause_mode')) {
  db.exec(`ALTER TABLE patients ADD COLUMN menopause_mode TEXT;`);
}
if (!hasPatientColumn('menopause_status_manual')) {
  db.exec(`ALTER TABLE patients ADD COLUMN menopause_status_manual TEXT;`);
}
if (!hasPatientColumn('last_menstruation_date')) {
  db.exec(`ALTER TABLE patients ADD COLUMN last_menstruation_date TEXT;`);
}
if (!hasPatientColumn('bilateral_oophorectomy')) {
  db.exec(`ALTER TABLE patients ADD COLUMN bilateral_oophorectomy INTEGER DEFAULT 0;`);
}
if (!hasPatientColumn('menopause_status')) {
  db.exec(`ALTER TABLE patients ADD COLUMN menopause_status TEXT;`);
}
if (!hasPatientColumn('menopause_basis')) {
  db.exec(`ALTER TABLE patients ADD COLUMN menopause_basis TEXT;`);
}

// Authentication middleware
interface AuthRequest extends Request {
  userId?: string;
  startTime?: number;
}

function authenticateToken(req: AuthRequest, res: ExpressResponse, next: NextFunction) {
  // Пропустить аутентификацию для login и health
  if (req.path === '/api/auth/login' || req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please login first.' });
  }

  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(403).json({ error: 'Invalid or expired token. Please login again.' });
  }

  req.userId = result.userId;
  next();
}

// Logging middleware
function loggingMiddleware(req: AuthRequest, res: ExpressResponse, next: NextFunction) {
  req.startTime = Date.now();

  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - (req.startTime || Date.now());
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    logApiCall(
      req.method,
      req.path,
      res.statusCode,
      ip,
      duration,
      req.userId
    );

    return originalSend.call(this, data);
  };

  next();
}

// ============================================
// START SERVER
// ============================================

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // ============================================
  // БЕЗОПАСНОСТЬ MIDDLEWARE
  // ============================================

  // Helmet для защиты headers
  app.use(helmet());

  // CORS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
  const corsModule = await import('cors');
  const corsFn: any = (corsModule as any).default || corsModule;
  app.use(corsFn({
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
  }));

  // Parsing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Rate limiting
  app.use(limiter);

  // Logging
  app.use(loggingMiddleware);

  // Authentication
  app.use(authenticateToken);

  // ============================================
  // API ROUTES - AUTHENTICATION
  // ============================================

  // Health check (без аутентификации)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  });

  // Login endpoint (с rate limiting)
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    try {
      // Хешировать введённый пароль и сравнить
      const passwordHash = await hashPassword(process.env.APP_PASSWORD || 'admin');
      const result = await authenticate(password, passwordHash);

      if (!result.success) {
        return res.status(401).json({ error: result.error || 'Authentication failed' });
      }

      res.json({
        success: true,
        token: result.token,
        expiresIn: '24h',
        message: 'Authenticated successfully',
      });
    } catch (error: any) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: AuthRequest, res: ExpressResponse) => {
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // ============================================
  // API ROUTES - PATIENTS
  // ============================================

  // Get all patients
  app.get("/api/patients", (req: AuthRequest, res: ExpressResponse) => {
    try {
      const stmt = db.prepare("SELECT * FROM patients ORDER BY updated_at DESC");
      const patients = stmt.all().map((patient: any) => ({
        ...patient,
        bilateral_oophorectomy: !!patient.bilateral_oophorectomy,
      }));
      res.json(patients);
    } catch (error) {
      console.error('Fetch patients error:', error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Create/Update patient
  app.post("/api/patients", (req: AuthRequest, res: ExpressResponse) => {
    const {
      id,
      full_name,
      birth_date,
      gender,
      snils,
      policy_number,
      contact_info,
      menopause_mode,
      menopause_status_manual,
      last_menstruation_date,
      bilateral_oophorectomy,
      menopause_status,
      menopause_basis,
    } = req.body;

    try {
      // Валидация
      if (!full_name || !birth_date || !gender) {
        return res.status(400).json({ error: "Full name, birth date, and gender are required" });
      }

      const safe_full_name = sanitizeInput(full_name);
      const safe_birth_date = sanitizeInput(birth_date);
      const safe_gender = sanitizeInput(gender);

      if (id) {
        // Update
        const stmt = db.prepare(`
          UPDATE patients
          SET full_name = ?, birth_date = ?, gender = ?, snils = ?, policy_number = ?,
              contact_info = ?, menopause_mode = ?, menopause_status_manual = ?,
              last_menstruation_date = ?, bilateral_oophorectomy = ?, menopause_status = ?,
              menopause_basis = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(
          safe_full_name, safe_birth_date, safe_gender, snils, policy_number,
          contact_info, menopause_mode, menopause_status_manual,
          last_menstruation_date, bilateral_oophorectomy ? 1 : 0,
          menopause_status, menopause_basis, id
        );
        res.json({ id, ...req.body });
      } else {
        // Create
        const stmt = db.prepare(`
          INSERT INTO patients (full_name, birth_date, gender, snils, policy_number,
                               contact_info, menopause_mode, menopause_status_manual,
                               last_menstruation_date, bilateral_oophorectomy,
                               menopause_status, menopause_basis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          safe_full_name, safe_birth_date, safe_gender, snils, policy_number,
          contact_info, menopause_mode, menopause_status_manual,
          last_menstruation_date, bilateral_oophorectomy ? 1 : 0,
          menopause_status, menopause_basis
        );
        res.json({ id: info.lastInsertRowid, ...req.body });
      }
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Failed to save patient" });
    }
  });

  // ============================================
  // API ROUTES - AI GENERATION (БЕЗОПАСНО!)
  // ============================================

  const fetchWithRetry = async (
    url: string,
    init: RequestInit,
    attempts: number = 3
  ): Promise<Response> => {
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url, init);
        if (response.ok) return response;
        const retryable = response.status >= 500 || response.status === 429;
        if (!retryable || i === attempts - 1) return response;
      } catch (e) {
        lastError = e;
        if (i === attempts - 1) break;
      }
      const delayMs = Math.min(2000, 250 * Math.pow(2, i));
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw lastError instanceof Error ? lastError : new Error('Network error');
  };

  const readResponseBodySafe = async (response: Response): Promise<{ json: any; text: string }> => {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    try {
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return { json, text: '' };
      }
    } catch (e) {
      void e;
    }

    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return { json, text };
      } catch (e) {
        return { json: null, text };
      }
    } catch (e) {
      return { json: null, text: '' };
    }
  };

  const getProviderFromDb = (providerId: string) => {
    const stmt = db.prepare(`SELECT * FROM ai_providers WHERE id = ?`);
    return stmt.get(providerId) as any | undefined;
  };

  const cors = (await import('cors')).default as any;
  app.use(cors());
  app.get("/api/ai/providers", (req: AuthRequest, res: ExpressResponse) => {
    try {
      const stmt = db.prepare(`SELECT id, name, type, base_url, model, created_at, updated_at FROM ai_providers ORDER BY created_at DESC`);
      const rows = stmt.all();
      res.json({ providers: rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load providers" });
    }
  });

  app.post("/api/ai/providers", (req: AuthRequest, res: ExpressResponse) => {
    const encryptionKey = process.env.DATABASE_ENCRYPTION_KEY || '';
    const rawId = String(req.body?.id || '').trim();
    const rawName = String(req.body?.name || '').trim();
    const rawType = String(req.body?.type || '').trim();
    const rawBaseUrl = String(req.body?.baseUrl || req.body?.base_url || '').trim();
    const rawModel = String(req.body?.model || '').trim();
    const rawApiKey = String(req.body?.apiKey || '').trim();

    if (!rawId || !rawName || !rawType || !rawBaseUrl || !rawApiKey) {
      return res.status(400).json({ error: "id, name, type, baseUrl and apiKey are required" });
    }

    try {
      const id = sanitizeInput(rawId, 200);
      const name = sanitizeInput(rawName, 200);
      const type = sanitizeInput(rawType, 50);
      const baseUrl = sanitizeInput(rawBaseUrl, 2000).replace(/\/+$/, '');
      const model = sanitizeInput(rawModel, 200);
      const apiKeyEncrypted = encryptSensitiveData(rawApiKey, encryptionKey);

      const stmt = db.prepare(`
        INSERT INTO ai_providers (id, name, type, base_url, model, api_key_encrypted, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          base_url = excluded.base_url,
          model = excluded.model,
          api_key_encrypted = excluded.api_key_encrypted,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(id, name, type, baseUrl, model || null, apiKeyEncrypted);

      res.json({ success: true, provider: { id, name, type, base_url: baseUrl, model } });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to save provider" });
    }
  });

  app.delete("/api/ai/providers/:id", (req: AuthRequest, res: ExpressResponse) => {
    try {
      const id = sanitizeInput(String(req.params.id || ''), 200);
      if (!id) return res.status(400).json({ error: "id is required" });
      const stmt = db.prepare(`DELETE FROM ai_providers WHERE id = ?`);
      const info = stmt.run(id);
      res.json({ success: true, deleted: info.changes });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete provider" });
    }
  });

  const handleAiProxy = async (req: AuthRequest, res: ExpressResponse) => {
    const providerId = String(req.body?.providerId || '').trim();
    const prompt = String(req.body?.prompt || '').trim();

    if (!providerId || !prompt) {
      return res.status(400).json({ error: "providerId and prompt are required" });
    }

    try {
      const row = getProviderFromDb(providerId);
      if (!row) {
        return res.status(404).json({ error: "Provider not found on server" });
      }

      const encryptionKey = process.env.DATABASE_ENCRYPTION_KEY || '';
      const apiKey = decryptSensitiveData(String(row.api_key_encrypted || ''), encryptionKey);
      const type = String(row.type || '').toLowerCase();
      const baseUrl = String(row.base_url || '').replace(/\/+$/, '');
      const model = String(row.model || '').trim();

      if (!apiKey) {
        return res.status(400).json({ error: "Provider API key is missing on server" });
      }

      if (!baseUrl) {
        return res.status(400).json({ error: "Provider baseUrl is missing on server" });
      }

      if (type === 'gemini') {
        const modelName = model || 'gemini-2.0-flash';
        const normalized = baseUrl;
        const url =
          /\/models\/?$/i.test(normalized)
            ? `${normalized.replace(/\/+$/, '')}/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`
            : /\/v1beta\/?$/i.test(normalized)
              ? `${normalized.replace(/\/+$/, '')}/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`
              : `${normalized.replace(/\/+$/, '')}/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: { text: 'Ты - опытный онколог и специалист по диагностике. Используй доступную информацию для предложения наиболее вероятных диагнозов и практических рекомендаций.' }
            },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 2048 }
          })
        });

        const body = await readResponseBodySafe(response);
        if (!response.ok) {
          const msg =
            body.json?.error?.message ||
            body.json?.error?.code ||
            body.json?.message ||
            body.text ||
            `HTTP ${response.status}`;
          return res.status(502).json({ error: String(msg) });
        }

        const content = body.json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          return res.status(502).json({ error: "Invalid Gemini response structure" });
        }

        return res.json({ content });
      }

      if (type === 'anthropic') {
        const url = /\/v1$/i.test(baseUrl) ? `${baseUrl}/messages` : (/\/messages$/i.test(baseUrl) ? baseUrl : `${baseUrl}/v1/messages`);
        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-latest',
            max_tokens: 2048,
            system: 'Ты - опытный онколог и специалист по диагностике. Используй доступную информацию для предложения наиболее вероятных диагнозов и практических рекомендаций.',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const body = await readResponseBodySafe(response);
        if (!response.ok) {
          const msg =
            body.json?.error?.message ||
            body.json?.message ||
            body.text ||
            `HTTP ${response.status}`;
          return res.status(502).json({ error: String(msg) });
        }

        const content = body.json?.content?.[0]?.text;
        if (!content) {
          return res.status(502).json({ error: "Invalid Anthropic response structure" });
        }

        return res.json({ content });
      }

      const chatUrl = /\/chat\/completions$/i.test(baseUrl) ? baseUrl : `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
      if (type === 'openrouter') {
        const ref = String(process.env.APP_URL || '').trim();
        if (ref) headers['HTTP-Referer'] = ref;
        headers['X-Title'] = 'OncoAssistant';
      }

      const response = await fetchWithRetry(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'Ты - опытный онколог и мастер диагностики. Используй доступную информацию для предложения наиболее вероятных диагнозов и практических рекомендаций.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      const body = await readResponseBodySafe(response);
      if (!response.ok) {
        const msg =
          body.json?.error?.message ||
          body.json?.message ||
          body.text ||
          `HTTP ${response.status}`;
        return res.status(502).json({ error: String(msg) });
      }

      const data = body.json;
      if (!data) {
        return res.status(502).json({ error: body.text ? `Invalid response (not JSON): ${body.text.substring(0, 300)}` : "Invalid response (not JSON)" });
      }

      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output_text ||
        '';

      const reasoning =
        data?.choices?.[0]?.message?.reasoning ||
        data?.choices?.[0]?.message?.thinking ||
        data?.choices?.[0]?.reasoning ||
        '';

      const out = reasoning ? `[Размышление]\n${reasoning}\n\n[Ответ]\n${content}` : content;
      if (!out) {
        return res.status(502).json({ error: "Invalid response structure (no content)" });
      }

      return res.json({ content: out });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "AI proxy failed" });
    }
  };

  app.post("/api/ai/proxy", handleAiProxy);
  app.post("/api/ai/generate", handleAiProxy);

  // ============================================
  // API ROUTES - CONSULTATIONS
  // ============================================

  app.get("/api/consultations/:patientId", (req: AuthRequest, res: ExpressResponse) => {
    try {
      const stmt = db.prepare(
        "SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC LIMIT 1"
      );
      const consultation = stmt.get(req.params.patientId);
      res.json(consultation || null);
    } catch (error) {
      console.error("Fetch consultation error:", error);
      res.status(500).json({ error: "Failed to fetch consultation" });
    }
  });

  app.post("/api/consultations/:patientId", (req: AuthRequest, res: ExpressResponse) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Data is required" });
      }

      const stmt = db.prepare(
        "INSERT INTO consultations (patient_id, data) VALUES (?, ?)"
      );
      const info = stmt.run(req.params.patientId, JSON.stringify(data));

      res.json({
        id: info.lastInsertRowid,
        patientId: req.params.patientId,
        data,
      });
    } catch (error) {
      console.error("Save consultation error:", error);
      res.status(500).json({ error: "Failed to save consultation" });
    }
  });

  // ============================================
  // VITE DEV SERVER / STATIC FILES
  // ============================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    const distIndexPath = path.join(distPath, "index.html");
    const htmlAppPath = path.resolve(__dirname, "OncoAssistWeb.html");
    const hasDist = fs.existsSync(distIndexPath);
    const hasHtmlApp = fs.existsSync(htmlAppPath);

    if (hasDist) {
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
          return next();
        }
        res.sendFile(distIndexPath);
      });
    } else if (hasHtmlApp) {
      app.use(express.static(path.resolve(__dirname)));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
          return next();
        }
        res.sendFile(htmlAppPath);
      });
    } else {
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
          return next();
        }
        res.status(404).send("No frontend found (dist/index.html or OncoAssistWeb.html).");
      });
    }
  }

  // ============================================
  // START LISTENING
  // ============================================

  const PORT_NUM = Number(process.env.PORT || PORT);
  app.listen(PORT_NUM, "0.0.0.0", () => {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║  OncoAssistant Server Started         ║`);
    console.log(`║  🔐 Security: ENABLED                 ║`);
    console.log(`║  📍 Port: ${PORT}                          ║`);
    console.log(`║  🌍 URL: http://localhost:${PORT}           ║`);
    console.log(`║  🔌 Environment: ${process.env.NODE_ENV}            ║`);
    console.log(`╚══════════════════════════════════════╝\n`);
  });
}

startServer().catch(console.error);
