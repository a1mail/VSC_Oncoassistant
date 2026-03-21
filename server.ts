import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
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

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
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
function loggingMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
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
  app.use(cors({
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
  app.post('/api/auth/logout', (req: AuthRequest, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // ============================================
  // API ROUTES - PATIENTS
  // ============================================

  // Get all patients
  app.get("/api/patients", (req: AuthRequest, res: Response) => {
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
  app.post("/api/patients", (req: AuthRequest, res: Response) => {
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

  // AI Generation - используем только сервер-сайд ключи!
  app.post("/api/ai/generate", async (req: AuthRequest, res: Response) => {
    const { prompt, provider, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      let apiKey: string | undefined;

      // Получить ключ ТОЛЬКО с сервера, никогда от клиента!
      if (provider === 'gemini') {
        apiKey = process.env.GEMINI_API_KEY;
      } else if (provider === 'openai') {
        apiKey = process.env.OPENAI_API_KEY;
      } else if (provider === 'anthropic') {
        apiKey = process.env.ANTHROPIC_API_KEY;
      }

      if (!apiKey) {
        return res.status(400).json({
          error: `API key for ${provider} not configured on server. Contact administrator.`,
        });
      }

      // Здесь ваш код для работы с провайдерами
      // Используем ТОЛЬКО сервер-сайд ключи - совершенно безопасно!

      res.json({
        success: true,
        text: "Response from secure server-side provider",
        provider,
      });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "AI generation failed" });
    }
  });

  // ============================================
  // API ROUTES - CONSULTATIONS
  // ============================================

  app.get("/api/consultations/:patientId", (req: AuthRequest, res: Response) => {
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

  app.post("/api/consultations/:patientId", (req: AuthRequest, res: Response) => {
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
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // ============================================
  // START LISTENING
  // ============================================

  app.listen(PORT, "0.0.0.0", () => {
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
