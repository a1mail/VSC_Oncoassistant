import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    data JSON NOT NULL, -- Stores the full state of the consultation (anamnesis, exam, etc.)
    FOREIGN KEY (patient_id) REFERENCES patients (id)
  );
`);

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for images
  app.use(express.json({ limit: '50mb' }));

  // --- API Routes ---

  // AI Generation Endpoint
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, config, documents } = req.body;

    try {
      if (config.provider === 'openai_compatible') {
        const apiKey = config.apiKey;
        let baseUrl = (config.baseUrl || 'https://api.openai.com/v1').trim();
        baseUrl = baseUrl.replace(/\/+$/, ''); // remove trailing slashes
        
        // Auto-fix for Qwen/DashScope
        if ((baseUrl.includes('dashscope.aliyuncs.com') || baseUrl.includes('aliyun.com')) && !baseUrl.includes('/compatible-mode/v1')) {
            baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        }

        let endpoint = baseUrl;
        // Only append /chat/completions if it's not already there AND it's not a special endpoint that doesn't need it
        if (!baseUrl.endsWith('/chat/completions')) {
            endpoint = `${baseUrl}/chat/completions`;
        }

        const modelName = (config.modelName || 'gpt-3.5-turbo').trim();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: 'system', content: 'You are a helpful medical assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            // Try to parse JSON error to give better message
            try {
                const jsonErr = JSON.parse(errText);
                if (jsonErr.error && jsonErr.error.message) {
                    return res.status(response.status).json({ error: `Provider Error (${response.status}): ${jsonErr.error.message}` });
                } else if (jsonErr.message) {
                    // Handle Qwen/DashScope error format
                    return res.status(response.status).json({ error: `Provider Error (${response.status}): ${jsonErr.message}` });
                }
            } catch (e) {
                // ignore, it's probably HTML
            }
            
            // If it's HTML, truncate it so it doesn't flood the UI
            let cleanErrText = errText;
            if (errText.trim().startsWith('<')) {
                cleanErrText = `Invalid response from provider (HTML returned instead of JSON). Check your Base URL.`;
            }
            
            return res.status(response.status).json({ error: `Provider Error (${response.status}): ${cleanErrText}` });
        }

        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            return res.status(500).json({ error: `Provider returned invalid JSON: ${textResponse.substring(0, 100)}...` });
        }

        const text = data.choices?.[0]?.message?.content || "{}";
        res.json({ text });

      } else {
        res.status(400).json({ error: "Server-side generation is only supported for OpenAI-compatible providers." });
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Debug Env Endpoint
  app.get("/api/debug/env", (req, res) => {
    const hasAnyApiKey = Boolean(process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    res.json({
      API_KEY: hasAnyApiKey ? "Present" : "Missing",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "Present" : "Missing",
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "Present" : "Missing",
      NODE_ENV: process.env.NODE_ENV
    });
  });

  // Download Source Code
  app.get("/api/download-source", (req, res) => {
    const archive = archiver("zip", {
      zlib: { level: 9 } // Sets the compression level.
    });

    res.attachment("onco-assistant-source.zip");

    archive.on("error", (err) => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // Append files from the current directory, excluding node_modules, .git, dist, etc.
    archive.glob("**/*", {
      cwd: __dirname,
      ignore: ["node_modules/**", ".git/**", "dist/**", "patient_data.db", "patient_data.db-journal"]
    });

    archive.finalize();
  });

  // Get all patients
  app.get("/api/patients", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM patients ORDER BY updated_at DESC");
      const patients = stmt.all().map((patient: any) => ({
        ...patient,
        bilateral_oophorectomy: !!patient.bilateral_oophorectomy,
      }));
      res.json(patients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Create/Update patient
  app.post("/api/patients", (req, res) => {
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
    
    // better-sqlite3 throws an error if bind parameters are undefined. Convert to null or default strings.
    const safe_full_name = full_name || '';
    const safe_birth_date = birth_date || '';
    const safe_gender = gender || '';
    const safe_snils = snils ?? null;
    const safe_policy_number = policy_number ?? null;
    const safe_contact_info = contact_info ?? null;
    const safe_menopause_mode = menopause_mode ?? null;
    const safe_menopause_status_manual = menopause_status_manual ?? null;
    const safe_last_menstruation_date = last_menstruation_date ?? null;
    const safe_bilateral_oophorectomy = bilateral_oophorectomy ? 1 : 0;
    const safe_menopause_status = menopause_status ?? null;
    const safe_menopause_basis = menopause_basis ?? null;

    try {
      if (id) {
        // Update
        const stmt = db.prepare(`
          UPDATE patients 
          SET full_name = ?, birth_date = ?, gender = ?, snils = ?, policy_number = ?, contact_info = ?, menopause_mode = ?, menopause_status_manual = ?, last_menstruation_date = ?, bilateral_oophorectomy = ?, menopause_status = ?, menopause_basis = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(
          safe_full_name,
          safe_birth_date,
          safe_gender,
          safe_snils,
          safe_policy_number,
          safe_contact_info,
          safe_menopause_mode,
          safe_menopause_status_manual,
          safe_last_menstruation_date,
          safe_bilateral_oophorectomy,
          safe_menopause_status,
          safe_menopause_basis,
          id
        );
        res.json({ id, ...req.body });
      } else {
        // Create
        const stmt = db.prepare(`
          INSERT INTO patients (full_name, birth_date, gender, snils, policy_number, contact_info, menopause_mode, menopause_status_manual, last_menstruation_date, bilateral_oophorectomy, menopause_status, menopause_basis)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          safe_full_name,
          safe_birth_date,
          safe_gender,
          safe_snils,
          safe_policy_number,
          safe_contact_info,
          safe_menopause_mode,
          safe_menopause_status_manual,
          safe_last_menstruation_date,
          safe_bilateral_oophorectomy,
          safe_menopause_status,
          safe_menopause_basis
        );
        res.json({ id: info.lastInsertRowid, ...req.body });
      }
    } catch (error) {
      console.error("Database error saving patient:", error);
      res.status(500).json({ error: "Failed to save patient" });
    }
  });

  // Get Consultation
  app.get("/api/consultations/:patientId", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC LIMIT 1");
      const consultation = stmt.get(req.params.patientId);
      res.json(consultation || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consultation" });
    }
  });

  // Save Consultation
  app.post("/api/consultations", (req, res) => {
    const { patient_id, data } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO consultations (patient_id, data) VALUES (?, ?)
      `);
      const info = stmt.run(patient_id, JSON.stringify(data));
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save consultation" });
    }
  });

  // --- Vite Middleware ---
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
