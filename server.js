import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pkg from 'pg';
import multer from 'multer';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
} from 'docx';
const { Pool } = pkg;
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const _require   = createRequire(import.meta.url);
const pdfParse   = _require('pdf-parse');

// ── Motor de Email (nodemailer) ───────────────────────────────────────────────
const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth:   smtpConfigured
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

async function enviarEmailNotificacion({ to, nombre, accion, fecha_limite, diasRestantes, criticidad }) {
  if (!smtpConfigured) {
    console.log(`[EMAIL-SIM] Para: ${to} | Acción: "${accion}" | ${diasRestantes} días para vencer`);
    return { simulado: true };
  }
  const colores = { Crítico: '#dc2626', Alto: '#ea580c', Medio: '#d97706', Bajo: '#16a34a' };
  const color   = colores[criticidad] || '#374151';

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08)">
      <!-- Header -->
      <div style="background:#1a3c2b;padding:28px 32px;">
        <p style="margin:0;color:#86efac;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SKUDO PSM</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:800;">Recordatorio de Plan de Acción</h1>
      </div>
      <!-- Alerta criticidad -->
      <div style="background:${color};padding:10px 32px;">
        <p style="margin:0;color:#fff;font-size:13px;font-weight:700;">
          ⚠️ Nivel ${criticidad} — Vence en <strong>${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}</strong>
        </p>
      </div>
      <!-- Cuerpo -->
      <div style="padding:32px;">
        <p style="margin:0 0 8px;color:#374151;font-size:14px;">Hola <strong>${nombre || 'responsable'}</strong>,</p>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
          Esta es una notificación automática del sistema SKUDO PSM sobre una acción de corrección asignada a ti que está próxima a vencer.
        </p>
        <!-- Card acción -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
          <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Acción Correctiva</p>
          <p style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:700;">${accion}</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:13px;">📅 Fecha límite</td>
              <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">
                ${new Date(fecha_limite).toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:13px;">🔴 Criticidad</td>
              <td style="padding:4px 0;font-size:13px;">
                <span style="background:${color};color:#fff;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;">${criticidad}</span>
              </td>
            </tr>
          </table>
        </div>
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
          Por favor actualiza el estado de esta acción en el sistema SKUDO PSM o contacta al coordinador del programa.
        </p>
      </div>
      <!-- Footer -->
      <div style="background:#f3f4f6;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          Este es un mensaje automático del sistema SKUDO PSM Expert System. No respondas a este correo.
        </p>
      </div>
    </div>
  </body>
  </html>`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'SKUDO PSM <noreply@skudo.app>',
    to,
    subject: `⚠️ [SKUDO] Acción vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}: ${accion.substring(0, 60)}`,
    html,
  });
  return { enviado: true };
}

const JWT_SECRET = process.env.JWT_SECRET || 'skudo-dev-secret-changeme';
if (!process.env.JWT_SECRET) {
  console.warn('[AUTH] JWT_SECRET no definido en .env; usando valor por defecto solo para desarrollo.');
}

const app = express();

// ── Almacenamiento de archivos ────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

const multerStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const diagId  = req.params.id ?? 'misc';
    const tid     = req.usuario?.tenant_id ?? 0;
    const catSlug = (req.body?.categoria ?? 'general')
      .toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
    const dir = path.join(UPLOADS_DIR, String(tid), String(diagId), catSlug);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 25 * 1024 * 1024 },   // 25 MB
  fileFilter(_req, file, cb) {
    const ok = ['application/pdf','image/jpeg','image/png','image/tiff',
                 'application/vnd.ms-excel',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                 'application/msword',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'text/plain'].includes(file.mimetype);
    cb(null, ok);
  },
});

// Extrae texto de un archivo según su tipo MIME
async function extractText(filePath, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const buf = fs.readFileSync(filePath);
      const d   = await pdfParse(buf);
      return d.text?.slice(0, 15000) ?? ''; // límite para la IA
    }
    if (mimetype === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8').slice(0, 15000);
    }
    return null; // imágenes y Office → texto no disponible
  } catch { return null; }
}

// Llama a Gemini desde el servidor con un prompt técnico PSM
async function geminiAnalizar(prompt) {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en .env');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── CORS: debe ir antes de cualquier ruta de la API ───────────────────────────
// Acepta: skudo.vercel.app, localhost:5173 y cualquier URL que termine en .vercel.app
const CORS_ORIGIN_MAIN = 'https://skudo.vercel.app';
const CORS_ORIGIN_LOCAL = 'http://localhost:5173';
const CORS_VERCEL_ANY = /^https:\/\/[^/]+\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === CORS_ORIGIN_MAIN || origin === CORS_ORIGIN_LOCAL) return callback(null, true);
    if (CORS_VERCEL_ANY.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204,
}));

// Límites de datos altos para triangulación y payloads grandes (evitar bloqueo del fetch)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log de cada petición entrante (rastreo de flujo)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ─── JWT Middleware ────────────────────────────────────────────────────────

function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function verificarRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

// Retorna el tenant_id del token, o null si es SuperAdmin/Consultor global
function tenantScope(req) {
  const { rol, tenant_id } = req.usuario;
  if (rol === 'SuperAdmin') return null;
  if (rol === 'Consultor' && !tenant_id) return null;
  return tenant_id;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Necesario para Neon y otros Postgres con SSL
});

/** Verifica que las tablas principales existan antes de aceptar tráfico (evita 500 por tablas faltantes). */
async function ensureMainTablesExist() {
  const required = ['usuarios', 'diagnosticos', 'plan_accion_items'];
  const client = await pool.connect();
  try {
    for (const table of required) {
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      if (rows.length === 0) {
        throw new Error(`Tabla requerida "${table}" no existe. Ejecute: npm run migrate`);
      }
    }
    console.log('[setup] Tablas principales verificadas: usuarios, diagnosticos, plan_accion_items');
  } finally {
    client.release();
  }
}

async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        empresa TEXT,
        sector TEXT,
        responsable TEXT,
        system_prompt TEXT
      )
    `);
    // Migración no destructiva: añade la columna si ya existía la tabla sin ella
    await client.query(`
      ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS system_prompt TEXT
    `);
  } finally {
    client.release();
  }
}

app.get('/api/config', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, empresa, sector, responsable, system_prompt FROM configuracion WHERE id = 1 LIMIT 1'
    );
    const data = rows[0] || { id: 1, empresa: '', sector: '', responsable: '', system_prompt: '' };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  console.log('Datos recibidos:', req.body);
  try {
    const { empresa = '', sector = '', responsable = '', system_prompt = '' } = req.body;
    await pool.query(
      `INSERT INTO configuracion (id, empresa, sector, responsable, system_prompt)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         empresa = EXCLUDED.empresa,
         sector = EXCLUDED.sector,
         responsable = EXCLUDED.responsable,
         system_prompt = EXCLUDED.system_prompt`,
      [empresa, sector, responsable, system_prompt]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Preguntas Normativas ──────────────────────────────────────────────────

async function ensureQuestionsTable() {
  const client = await pool.connect();
  try {
    // Secuencia para IDs automáticos en preguntas nuevas
    await client.query(`CREATE SEQUENCE IF NOT EXISTS preguntas_id_seq`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id                    INTEGER PRIMARY KEY DEFAULT nextval('preguntas_id_seq'),
        complejidad           INTEGER,
        elemento              TEXT,
        pregunta              TEXT,
        plan_escasa           TEXT,
        plan_al_menos         TEXT,
        plan_no_evidencia     TEXT,
        evidencia_suficiente  TEXT,
        evidencia_escasa      TEXT,
        evidencia_al_menos    TEXT,
        evidencia_no_evidencia TEXT,
        evidencia_no_aplica   TEXT,
        guia_suficiente       TEXT,
        guia_escasa           TEXT,
        guia_al_menos         TEXT,
        guia_no_evidencia     TEXT,
        guia_no_aplica        TEXT,
        legislacion           TEXT,
        herramienta           TEXT
      )
    `);

    // Migración: si la tabla ya existía sin default, aplicarlo y sincronizar la secuencia
    await client.query(
      `ALTER TABLE preguntas ALTER COLUMN id SET DEFAULT nextval('preguntas_id_seq')`
    );
    await client.query(
      `SELECT setval('preguntas_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM preguntas), 0), 1))`
    );
  } finally {
    client.release();
  }
}

// GET /api/preguntas?search=texto  – lista resumida (id + Elemento + Pregunta truncada)
app.get('/api/preguntas', async (req, res) => {
  try {
    const { search } = req.query;
    let q = 'SELECT id, complejidad, elemento, LEFT(pregunta, 300) AS pregunta FROM preguntas';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ' WHERE elemento ILIKE $1 OR pregunta ILIKE $1';
    }
    q += ' ORDER BY id ASC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/preguntas/:id  – fila completa para edición
app.get('/api/preguntas/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM preguntas WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/preguntas  – crear nueva (id autoincremental)
app.post('/api/preguntas', async (req, res) => {
  console.log('[POST /api/preguntas] Datos recibidos:', JSON.stringify(req.body).slice(0, 200));
  try {
    const {
      complejidad, elemento, pregunta,
      plan_escasa, plan_al_menos, plan_no_evidencia,
      evidencia_suficiente, evidencia_escasa, evidencia_al_menos,
      evidencia_no_evidencia, evidencia_no_aplica,
      guia_suficiente, guia_escasa, guia_al_menos,
      guia_no_evidencia, guia_no_aplica,
      legislacion, herramienta,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO preguntas (
         complejidad, elemento, pregunta,
         plan_escasa, plan_al_menos, plan_no_evidencia,
         evidencia_suficiente, evidencia_escasa, evidencia_al_menos,
         evidencia_no_evidencia, evidencia_no_aplica,
         guia_suficiente, guia_escasa, guia_al_menos,
         guia_no_evidencia, guia_no_aplica, legislacion, herramienta
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        complejidad ?? 1, elemento ?? '', pregunta ?? '',
        plan_escasa ?? '', plan_al_menos ?? '', plan_no_evidencia ?? '',
        evidencia_suficiente ?? '', evidencia_escasa ?? '', evidencia_al_menos ?? '',
        evidencia_no_evidencia ?? '', evidencia_no_aplica ?? '',
        guia_suficiente ?? '', guia_escasa ?? '', guia_al_menos ?? '',
        guia_no_evidencia ?? '', guia_no_aplica ?? '', legislacion ?? '', herramienta ?? '',
      ]
    );
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/preguntas/:id  – actualizar
app.put('/api/preguntas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[PUT /api/preguntas] id recibido: "${id}", body keys: ${Object.keys(req.body || {}).join(', ')}`);
  try {
    const {
      complejidad, elemento, pregunta,
      plan_escasa, plan_al_menos, plan_no_evidencia,
      evidencia_suficiente, evidencia_escasa, evidencia_al_menos,
      evidencia_no_evidencia, evidencia_no_aplica,
      guia_suficiente, guia_escasa, guia_al_menos,
      guia_no_evidencia, guia_no_aplica, legislacion, herramienta,
    } = req.body;

    const result = await pool.query(
      `UPDATE preguntas SET
         complejidad=$1, elemento=$2, pregunta=$3,
         plan_escasa=$4, plan_al_menos=$5, plan_no_evidencia=$6,
         evidencia_suficiente=$7, evidencia_escasa=$8, evidencia_al_menos=$9,
         evidencia_no_evidencia=$10, evidencia_no_aplica=$11,
         guia_suficiente=$12, guia_escasa=$13, guia_al_menos=$14,
         guia_no_evidencia=$15, guia_no_aplica=$16,
         legislacion=$17, herramienta=$18
       WHERE id=$19`,
      [
        complejidad ?? 1, elemento ?? '', pregunta ?? '',
        plan_escasa ?? '', plan_al_menos ?? '', plan_no_evidencia ?? '',
        evidencia_suficiente ?? '', evidencia_escasa ?? '', evidencia_al_menos ?? '',
        evidencia_no_evidencia ?? '', evidencia_no_aplica ?? '',
        guia_suficiente ?? '', guia_escasa ?? '', guia_al_menos ?? '',
        guia_no_evidencia ?? '', guia_no_aplica ?? '', legislacion ?? '', herramienta ?? '',
        id,
      ]
    );
    console.log(`[PUT] filas afectadas: ${result.rowCount}`);
    res.json({ ok: true, updated: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/preguntas/:id
app.delete('/api/preguntas/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[DELETE /api/preguntas] id recibido: "${id}"`);
  try {
    const result = await pool.query('DELETE FROM preguntas WHERE id = $1', [id]);
    console.log(`[DELETE] filas afectadas: ${result.rowCount}`);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (err) {
    console.error('[DELETE] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Autenticación ────────────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, nombre, rol, tenant_id, password_hash FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );
    const user = rows[0];
    // Log de depuración seguro (nunca imprimir contraseña)
    if (!user) {
      console.log('[LOGIN] Usuario encontrado: no');
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    console.log('[LOGIN] Usuario encontrado: si');
    const hashOk = await bcrypt.compare(password, user.password_hash);
    console.log('[LOGIN] Comparación de hash: ' + (hashOk ? 'exitosa' : 'fallida'));
    if (!hashOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const payload = {
      id: user.id, email: user.email, nombre: user.nombre,
      rol: user.rol, tenant_id: user.tenant_id,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    console.log(`[LOGIN] ${user.email} (${user.rol})`);
    res.json({ token, usuario: payload });
  } catch (err) {
    console.error('[LOGIN] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', verificarToken, (req, res) => {
  res.json({ usuario: req.usuario });
});

// ─── Tenants (SuperAdmin) ─────────────────────────────────────────────────

app.get('/api/tenants', verificarToken, verificarRol('SuperAdmin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tenants', verificarToken, verificarRol('SuperAdmin'), async (req, res) => {
  const { nombre, nit, logo_url, plan_tipo } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tenants (nombre, nit, logo_url, plan_tipo)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nombre, nit || null, logo_url || null, plan_tipo || 'Básico']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tenants/:id', verificarToken, verificarRol('SuperAdmin'), async (req, res) => {
  const { nombre, nit, logo_url, plan_tipo } = req.body;
  try {
    await pool.query(
      'UPDATE tenants SET nombre=$1, nit=$2, logo_url=$3, plan_tipo=$4 WHERE id=$5',
      [nombre, nit || null, logo_url || null, plan_tipo || 'Básico', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Usuarios ────────────────────────────────────────────────────────────

app.get('/api/usuarios', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  try {
    const tid = tenantScope(req);
    let q = 'SELECT id, email, nombre, rol, tenant_id, activo, created_at FROM usuarios';
    const params = [];
    if (tid) { q += ' WHERE tenant_id = $1'; params.push(tid); }
    q += ' ORDER BY nombre ASC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/usuarios', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { email, password, nombre, rol, tenant_id } = req.body;
  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'email, password, nombre y rol son obligatorios' });
  }
  const rolesPermitidos = ['SuperAdmin', 'Consultor', 'AdminInquilino', 'Auditor', 'Lector'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Permitidos: ${rolesPermitidos.join(', ')}` });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const tid = req.usuario.rol === 'AdminInquilino' ? req.usuario.tenant_id : (tenant_id || null);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, tenant_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, nombre, rol, tenant_id`,
      [email.toLowerCase().trim(), hash, nombre, rol, tid]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { nombre, email, password, rol, activo, tenant_id } = req.body;
  const id = Number(req.params.id);

  // AdminInquilino: no puede promover a SuperAdmin ni Consultor
  if (req.usuario.rol === 'AdminInquilino') {
    if (['SuperAdmin', 'Consultor'].includes(rol)) {
      return res.status(403).json({ error: 'No tienes permiso para asignar ese rol' });
    }
    // Solo puede editar usuarios de su mismo tenant
    const { rows } = await pool.query('SELECT tenant_id FROM usuarios WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (rows[0].tenant_id !== req.usuario.tenant_id) {
      return res.status(403).json({ error: 'No tienes permiso para editar este usuario' });
    }
  }

  try {
    const setClauses = ['nombre=$1', 'rol=$2', 'activo=$3'];
    const params = [nombre, rol, activo !== false];
    let idx = 4;

    if (email) { setClauses.push(`email=$${idx++}`); params.push(email.toLowerCase().trim()); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      setClauses.push(`password_hash=$${idx++}`);
      params.push(hash);
    }
    if (req.usuario.rol === 'SuperAdmin' && tenant_id !== undefined) {
      setClauses.push(`tenant_id=$${idx++}`);
      params.push(tenant_id || null);
    }
    params.push(id);
    await pool.query(`UPDATE usuarios SET ${setClauses.join(', ')} WHERE id=$${idx}`, params);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/usuarios/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  try {
    if (req.usuario.rol === 'AdminInquilino') {
      const { rows } = await pool.query('SELECT tenant_id, rol FROM usuarios WHERE id=$1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (rows[0].tenant_id !== req.usuario.tenant_id) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este usuario' });
      }
      if (['SuperAdmin', 'Consultor'].includes(rows[0].rol)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este rol' });
      }
    }
    const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cambio de contraseña propia (cualquier rol autenticado)
app.put('/api/auth/me/password', verificarToken, async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias' });
  }
  if (password_nuevo.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  try {
    // Buscar por email (más robusto que por id en caso de desfase entre JWT y DB)
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM usuarios WHERE email=$1',
      [req.usuario.email]
    );
    console.log(`[CAMBIAR PASS] buscando email=${req.usuario.email} → encontrado=${rows.length}`);
    if (!rows.length) {
      return res.status(404).json({ error: `Usuario no encontrado (email: ${req.usuario.email})` });
    }
    const valida = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!valida) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    const hash = await bcrypt.hash(password_nuevo, 12);
    await pool.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CAMBIAR PASS] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Plantas ─────────────────────────────────────────────────────────────

app.get('/api/plantas', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    let q = 'SELECT p.*, t.nombre AS tenant_nombre FROM plantas p LEFT JOIN tenants t ON t.id = p.tenant_id';
    const params = [];
    if (tid) { q += ' WHERE p.tenant_id = $1'; params.push(tid); }
    q += ' ORDER BY p.nombre ASC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/plantas', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { nombre, ubicacion, responsable, tenant_id } = req.body;
  const tid = req.usuario.rol === 'AdminInquilino' ? req.usuario.tenant_id : tenant_id;
  if (!nombre || !tid) return res.status(400).json({ error: 'nombre y tenant_id son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO plantas (tenant_id, nombre, ubicacion, responsable)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tid, nombre, ubicacion || '', responsable || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/plantas/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { nombre, ubicacion, responsable } = req.body;
  console.log(`[PUT /api/plantas/${req.params.id}]`);
  try {
    await pool.query(
      'UPDATE plantas SET nombre=$1, ubicacion=$2, responsable=$3 WHERE id=$4',
      [nombre, ubicacion || '', responsable || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/plantas/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  console.log(`[DELETE /api/plantas/${req.params.id}]`);
  try {
    await pool.query('DELETE FROM plantas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Áreas ────────────────────────────────────────────────────────────────

app.get('/api/areas', verificarToken, async (req, res) => {
  const { planta_id } = req.query;
  try {
    let q = 'SELECT a.*, p.nombre AS planta_nombre FROM areas a LEFT JOIN plantas p ON p.id = a.planta_id';
    const params = [];
    if (planta_id) { q += ' WHERE a.planta_id = $1'; params.push(planta_id); }
    q += ' ORDER BY a.nombre ASC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/areas', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { planta_id, nombre, descripcion } = req.body;
  if (!planta_id || !nombre) return res.status(400).json({ error: 'planta_id y nombre son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO areas (planta_id, nombre, descripcion) VALUES ($1,$2,$3) RETURNING *`,
      [planta_id, nombre, descripcion || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/areas/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    await pool.query(
      'UPDATE areas SET nombre=$1, descripcion=$2 WHERE id=$3',
      [nombre, descripcion || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/areas/:id', verificarToken, verificarRol('SuperAdmin', 'AdminInquilino'), async (req, res) => {
  try {
    await pool.query('DELETE FROM areas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Diagnósticos ────────────────────────────────────────────────────────

// POST /api/diagnosticos/setup  ← DEBE IR ANTES que las rutas con :id
app.post('/api/diagnosticos/setup', verificarToken, async (req, res) => {
  const {
    planta_id, area_id,
    riesgo_tecnico, regulacion, madurez, estrategia, complejidad, exposicion,
    comentarios_riesgo, comentarios_regulacion, comentarios_madurez,
    comentarios_estrategia, comentarios_complejidad, comentarios_exposicion,
  } = req.body;

  const dims = { riesgo_tecnico, regulacion, madurez, estrategia, complejidad, exposicion };
  for (const [k, v] of Object.entries(dims)) {
    const n = Number(v);
    if (!n || n < 1 || n > 4) {
      return res.status(400).json({ error: `La dimensión "${k}" debe ser 1, 2, 3 o 4.` });
    }
    dims[k] = n;
  }

  const comentarios = {
    comentarios_riesgo:       comentarios_riesgo      || null,
    comentarios_regulacion:   comentarios_regulacion  || null,
    comentarios_madurez:      comentarios_madurez     || null,
    comentarios_estrategia:   comentarios_estrategia  || null,
    comentarios_complejidad:  comentarios_complejidad || null,
    comentarios_exposicion:   comentarios_exposicion  || null,
  };

  const nivel = calcularNivel(dims);
  const tid   = tenantScope(req) ?? req.body.tenant_id ?? null;

  // data_setup incluye tanto dimensiones numéricas como justificaciones
  const dataSetupCompleto = { ...dims, ...comentarios };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [diag] } = await client.query(
      `INSERT INTO diagnosticos
         (tenant_id, planta_id, area_id, estado, nivel_calculado, paso_actual, data_setup)
       VALUES ($1,$2,$3,'Carga',$4,2,$5) RETURNING id`,
      [tid, planta_id || null, area_id || null, nivel, JSON.stringify(dataSetupCompleto)]
    );
    await client.query(
      `INSERT INTO diagnostico_setup
         (diagnostico_id,
          riesgo_tecnico, regulacion, madurez, estrategia, complejidad, exposicion,
          nivel_calculado,
          comentarios_riesgo, comentarios_regulacion, comentarios_madurez,
          comentarios_estrategia, comentarios_complejidad, comentarios_exposicion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        diag.id,
        dims.riesgo_tecnico, dims.regulacion, dims.madurez,
        dims.estrategia, dims.complejidad, dims.exposicion,
        nivel,
        comentarios.comentarios_riesgo, comentarios.comentarios_regulacion,
        comentarios.comentarios_madurez, comentarios.comentarios_estrategia,
        comentarios.comentarios_complejidad, comentarios.comentarios_exposicion,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ diagnostico_id: diag.id, nivel_calculado: nivel });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[setup] error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/diagnosticos/:id/setup
// ─── Motor de Filtrado Dinámico ──────────────────────────────────────────────

// GET /api/diagnosticos/:id/preguntas
// Devuelve las preguntas filtradas por complejidad <= nivel_calculado.
// Si es la primera vez, fija el alcance en diagnostico_respuestas.
app.get('/api/diagnosticos/:id/preguntas', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    // 1. Obtener nivel_calculado del diagnóstico
    const { rows: [diag] } = await pool.query(
      'SELECT nivel_calculado, estado FROM diagnosticos WHERE id=$1', [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    const nivel = diag.nivel_calculado ?? 1;

    // 2. Ver si ya existe un alcance fijado
    const { rowCount: yaFijado } = await pool.query(
      'SELECT 1 FROM diagnostico_respuestas WHERE diagnostico_id=$1 LIMIT 1', [diagId]
    );

    // 3. Si no hay alcance fijado → crearlo ahora (primera llamada)
    if (!yaFijado) {
      const { rows: candidatas } = await pool.query(
        `SELECT id FROM preguntas
         WHERE complejidad IS NOT NULL AND complejidad <= $1
         ORDER BY complejidad, id`,
        [nivel]
      );
      if (candidatas.length > 0) {
        const vals = candidatas.map((p, i) =>
          `($1, $${i + 2}, ${i + 1})`
        ).join(',');
        const params = [diagId, ...candidatas.map((p) => p.id)];
        await pool.query(
          `INSERT INTO diagnostico_respuestas (diagnostico_id, pregunta_id, orden)
           VALUES ${vals} ON CONFLICT DO NOTHING`,
          params
        );
      }
    }

    // 4. Devolver las preguntas con su respuesta actual, agrupadas por elemento
    const { rows } = await pool.query(
      `SELECT p.*, dr.respuesta, dr.comentario, dr.id AS respuesta_id
       FROM diagnostico_respuestas dr
       JOIN preguntas p ON p.id = dr.pregunta_id
       WHERE dr.diagnostico_id = $1
       ORDER BY dr.orden, p.elemento, p.id`,
      [diagId]
    );

    // Agrupar por elemento (categoría)
    const grupos = {};
    for (const r of rows) {
      const cat = r.elemento || 'General';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(r);
    }

    res.json({
      nivel,
      total: rows.length,
      estado_diagnostico: diag.estado,
      respondidas: rows.filter((r) => r.respuesta).length,
      grupos,
    });
  } catch (err) {
    console.error('[preguntas filtradas]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diagnosticos/:id/progreso-preguntas
// Devuelve total de preguntas en alcance y cuántas tienen calificación con evidencia (IA)
app.get('/api/diagnosticos/:id/progreso-preguntas', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows: [diag] } = await pool.query(
      'SELECT nivel_calculado FROM diagnosticos WHERE id=$1', [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    const nivel = diag.nivel_calculado ?? 1;

    // Crear alcance si no existe (igual que GET /preguntas)
    const { rowCount: yaFijado } = await pool.query(
      'SELECT 1 FROM diagnostico_respuestas WHERE diagnostico_id=$1 LIMIT 1', [diagId]
    );
    if (!yaFijado) {
      const { rows: candidatas } = await pool.query(
        `SELECT id FROM preguntas WHERE complejidad IS NOT NULL AND complejidad <= $1 ORDER BY complejidad, id`,
        [nivel]
      );
      if (candidatas.length > 0) {
        const vals = candidatas.map((p, i) => `($1, $${i + 2}, ${i + 1})`).join(',');
        const params = [diagId, ...candidatas.map((p) => p.id)];
        await pool.query(
          `INSERT INTO diagnostico_respuestas (diagnostico_id, pregunta_id, orden) VALUES ${vals} ON CONFLICT DO NOTHING`,
          params
        );
      }
    }

    const { rows: [totalRow] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM diagnostico_respuestas WHERE diagnostico_id=$1`,
      [diagId]
    );
    const total = totalRow?.total ?? 0;

    const { rows: docs } = await pool.query(
      `SELECT calificaciones FROM diagnostico_documentos
       WHERE diagnostico_id=$1 AND estado='Analizado' AND calificaciones IS NOT NULL`,
      [diagId]
    );
    const preguntasUnicas = new Set();
    for (const doc of docs) {
      const cals = Array.isArray(doc.calificaciones) ? doc.calificaciones : [];
      for (const c of cals) {
        const p = (c.pregunta || '').trim().slice(0, 200);
        if (p) preguntasUnicas.add(p);
      }
    }
    const calificadas_con_evidencia = preguntasUnicas.size;

    res.json({ total, calificadas_con_evidencia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/diagnosticos/:id/respuestas/:preguntaId
// Guarda o actualiza la respuesta a una pregunta del alcance fijado.
app.patch(
  '/api/diagnosticos/:id/respuestas/:preguntaId',
  verificarToken,
  async (req, res) => {
    const diagId    = Number(req.params.id);
    const pregId    = Number(req.params.preguntaId);
    const { respuesta, comentario } = req.body;

    // Bloquear si está Finalizado
    const { rows: [diag] } = await pool.query(
      'SELECT estado FROM diagnosticos WHERE id=$1', [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    if (diag.estado === 'Finalizado') {
      return res.status(403).json({ error: 'El diagnóstico está finalizado.' });
    }

    try {
      await pool.query(
        `UPDATE diagnostico_respuestas
         SET respuesta=$1, comentario=$2, updated_at=NOW()
         WHERE diagnostico_id=$3 AND pregunta_id=$4`,
        [respuesta || null, comentario || null, diagId, pregId]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/diagnosticos/:id/preguntas-para-ia
// Devuelve el resumen de preguntas + respuestas del alcance fijado, para enviar a Gemini.
app.get('/api/diagnosticos/:id/preguntas-para-ia', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT p.elemento, p.pregunta, p.complejidad,
              dr.respuesta, dr.comentario,
              p.guia_suficiente, p.guia_escasa, p.guia_al_menos,
              p.guia_no_evidencia, p.legislacion
       FROM diagnostico_respuestas dr
       JOIN preguntas p ON p.id = dr.pregunta_id
       WHERE dr.diagnostico_id = $1
       ORDER BY dr.orden, p.elemento, p.id`,
      [diagId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diagnosticos/:id/setup', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM diagnostico_setup WHERE diagnostico_id=$1', [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/diagnosticos', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const { estado } = req.query;
    let q = `
      SELECT d.*,
             p.nombre AS planta_nombre, a.nombre AS area_nombre,
             u.nombre AS consultor_nombre
      FROM diagnosticos d
      LEFT JOIN plantas  p ON p.id = d.planta_id
      LEFT JOIN areas    a ON a.id = d.area_id
      LEFT JOIN usuarios u ON u.id = d.consultor_id
    `;
    const params = [];
    const conds = [];
    if (tid)    { params.push(tid);    conds.push(`d.tenant_id = $${params.length}`); }
    if (estado) { params.push(estado); conds.push(`d.estado = $${params.length}`); }
    if (conds.length) q += ' WHERE ' + conds.join(' AND ');
    q += ' ORDER BY d.created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('ERROR EN [/api/diagnosticos]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diagnosticos/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM diagnosticos WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('ERROR EN [/api/diagnosticos/:id]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diagnosticos', verificarToken, async (req, res) => {
  const { planta_id, area_id, escenario, resultado_ia, estado } = req.body;
  const tid = tenantScope(req) ?? req.body.tenant_id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO diagnosticos
         (tenant_id, planta_id, area_id, consultor_id, escenario, resultado_ia, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        tid, planta_id || null, area_id || null,
        req.usuario.id, escenario || '', resultado_ia || '',
        estado || 'Borrador',
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('ERROR EN [POST /api/diagnosticos]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/diagnosticos/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id);
  const { escenario, resultado_ia, hallazgos_validados, estado, planta_id, area_id } = req.body;

  try {
    // RBAC: bloqueo si está Finalizado; Auditor solo edita lo suyo
    const { rows: [diag] } = await pool.query(
      'SELECT estado, consultor_id FROM diagnosticos WHERE id=$1', [id]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    if (diag.estado === 'Finalizado') {
      return res.status(403).json({ error: 'El diagnóstico está finalizado y no puede modificarse.' });
    }
    if (req.usuario.rol === 'Auditor' && diag.consultor_id !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar este diagnóstico.' });
    }

    await pool.query(
      `UPDATE diagnosticos SET
         escenario=$1, resultado_ia=$2, hallazgos_validados=$3, estado=$4,
         planta_id=$5, area_id=$6, updated_at=NOW()
       WHERE id=$7`,
      [escenario, resultado_ia, hallazgos_validados, estado, planta_id || null, area_id || null, id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/diagnosticos/:id/progreso  – guardado parcial de estado y datos
app.patch('/api/diagnosticos/:id/progreso', verificarToken, async (req, res) => {
  const id = Number(req.params.id);
  const { paso_actual, estado, data_setup, puntuacion } = req.body;
  try {
    const setClauses = ['updated_at=NOW()'];
    const params = [];
    let idx = 1;
    if (paso_actual  !== undefined) { setClauses.push(`paso_actual=$${idx++}`);  params.push(paso_actual); }
    if (estado       !== undefined) { setClauses.push(`estado=$${idx++}`);        params.push(estado); }
    if (data_setup   !== undefined) { setClauses.push(`data_setup=$${idx++}`);    params.push(JSON.stringify(data_setup)); }
    if (puntuacion   !== undefined) { setClauses.push(`puntuacion=$${idx++}`);    params.push(puntuacion); }
    if (estado === 'Finalizado')     setClauses.push('fecha_cierre=NOW()');

    params.push(id);
    await pool.query(`UPDATE diagnosticos SET ${setClauses.join(',')} WHERE id=$${idx}`, params);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Gestión Documental – Fase 2 ─────────────────────────────────────────────

const CATEGORIAS_PSM = [
  'Información General',
  'Dirección y Organización',
  'Análisis de Riesgos (HAZOP/LOPA)',
  'Documentos de Proceso (P&IDs)',
  'Desempeño y KPIs',
  'Normativos y Regulatorios',
  'Procedimientos Operacionales',
  'Registros de Mantenimiento',
];

// GET /api/diagnosticos/:id/documentos
// Incluye analisis_ia para que el informe por documento persista tras subir nuevos archivos
app.get('/api/diagnosticos/:id/documentos', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT id, categoria, nombre_original, tamano, tipo_mime, estado,
              analisis_ia, calificaciones, brechas, created_at
       FROM diagnostico_documentos WHERE diagnostico_id=$1 ORDER BY categoria, created_at`,
      [diagId]
    );
    res.json({ documentos: rows, categorias: CATEGORIAS_PSM });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/documentos  – sube 1..N archivos
// multer debe recibir el token ANTES de procesar archivos; usamos orden: verificarToken → upload
app.post(
  '/api/diagnosticos/:id/documentos',
  verificarToken,
  upload.array('archivos', 10),
  async (req, res) => {
    const diagId = Number(req.params.id);
    const { categoria } = req.body;
    if (!categoria || !CATEGORIAS_PSM.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría inválida.' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ error: 'No se recibieron archivos.' });
    }

    const { rows: [diag] } = await pool.query(
      'SELECT tenant_id, planta_id FROM diagnosticos WHERE id=$1', [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado.' });

    const creados = [];
    for (const file of req.files) {
      // Extracción de texto asíncrona (no bloquea la respuesta)
      const texto = await extractText(file.path, file.mimetype);
      const { rows: [doc] } = await pool.query(
        `INSERT INTO diagnostico_documentos
           (diagnostico_id, tenant_id, planta_id, categoria,
            nombre_original, nombre_archivo, ruta, tamano, tipo_mime, texto_extraido)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, nombre_original, categoria, estado`,
        [
          diagId, diag.tenant_id, diag.planta_id, categoria,
          file.originalname, file.filename,
          file.path.replace(__dirname, ''), // ruta relativa
          file.size, file.mimetype, texto,
        ]
      );
      creados.push(doc);
    }
    res.status(201).json({ ok: true, documentos: creados });
  }
);

// DELETE /api/diagnosticos/:id/documentos/:docId
app.delete('/api/diagnosticos/:id/documentos/:docId', verificarToken, async (req, res) => {
  const docId = Number(req.params.docId);
  try {
    const { rows: [doc] } = await pool.query(
      'SELECT ruta FROM diagnostico_documentos WHERE id=$1', [docId]
    );
    if (doc?.ruta) {
      fs.unlink(path.join(__dirname, doc.ruta), () => {});
    }
    await pool.query('DELETE FROM diagnostico_documentos WHERE id=$1', [docId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/documentos/:docId/analizar  – análisis IA por documento
app.post('/api/diagnosticos/:id/documentos/:docId/analizar', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  const docId  = Number(req.params.docId);
  try {
    // Marcar como Procesando
    await pool.query(`UPDATE diagnostico_documentos SET estado='Procesando' WHERE id=$1`, [docId]);

    const { rows: [doc] } = await pool.query(
      'SELECT * FROM diagnostico_documentos WHERE id=$1', [docId]
    );
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { rows: [diag] } = await pool.query(
      'SELECT nivel_calculado FROM diagnosticos WHERE id=$1', [diagId]
    );
    const nivel = diag?.nivel_calculado ?? 1;

    // Preguntas normativas del alcance de este diagnóstico (max 30)
    const { rows: preguntas } = await pool.query(
      `SELECT p.elemento, p.pregunta, p.legislacion
       FROM diagnostico_respuestas dr
       JOIN preguntas p ON p.id = dr.pregunta_id
       WHERE dr.diagnostico_id=$1 ORDER BY dr.orden LIMIT 30`,
      [diagId]
    );
    const preguntasTexto = preguntas.length
      ? preguntas.map(p => `• [${p.elemento ?? 'General'}] ${p.pregunta}${p.legislacion ? ` (${p.legislacion})` : ''}`).join('\n')
      : 'No hay preguntas normativas registradas para este diagnóstico.';

    const textoDoc = doc.texto_extraido
      ? doc.texto_extraido.slice(0, 8000)
      : '(Documento sin texto extraíble — imagen o formato no soportado)';

    const prompt = `Actúa como Consultor Senior certificado en Seguridad de Procesos (PSM) bajo el marco normativo colombiano: Decreto 1347 de 2021 y Resolución 5492 de 2024.

CONTEXTO DEL DIAGNÓSTICO:
- Categoría del documento: ${doc.categoria}
- Nombre del documento: ${doc.nombre_original}
- Nivel de complejidad: N${nivel}/5

METODOLOGÍA DE EVALUACIÓN PSM:
Como consultor senior en seguridad de procesos, debes analizar los procesos, manuales y toda la información contenida en el documento, buscando cumplimiento del marco legal con las preguntas normativas del diagnóstico.

CRITERIOS DE EVALUACIÓN DE EVIDENCIAS:
- **Suficiente (100%)**: Evidencia sistemática y documentada. Gestión completa, procedimientos actualizados, registros históricos consistentes.
- **Escasa (62%)**: Cumplimiento parcial o sin registros históricos. Evidencia desactualizada o incompleta.
- **Al menos una (25%)**: Cumplimiento informal o aislado. Prácticas sin respaldo documental formal.
- **No hay (0%)**: Ausencia total de gestión. No existe política, procedimiento o registro alguno.

REQUISITOS DE ANÁLISIS:
1. **Citar explícitamente** la evidencia analizada indicando la fuente exacta dentro del documento
2. **Describir la situación técnica** identificando brechas y fortalezas específicas
3. **Especificar de dónde proviene** cada información analizada (sección, página, párrafo del documento)
4. **Proporcionar recomendaciones concretas** para alcanzar el nivel de suficiencia
5. **Verificar consistencia interna** entre diferentes secciones del documento

INSTRUCCIONES DE TRIANGULACIÓN:
Al analizar, verifica la consistencia interna del documento y señala:
1. Si los equipos críticos mencionados son coherentes entre sí (inventario vs. P&IDs).
2. Si el análisis de riesgos (HAZOP/LOPA) referencia los mismos escenarios que los P&IDs.
3. Si los procedimientos operacionales corresponden a los riesgos identificados.
4. Si los registros de incidentes están vinculados a los análisis de riesgos.
5. Cualquier contradicción o inconsistencia detectada dentro del documento.

Genera únicamente JSON válido (sin bloques markdown) con esta estructura exacta:
{
  "analisis_tecnico": "Análisis detallado en tercera persona, tono profesional-legal, mínimo 250 palabras. Debe describir la situación técnica, identificar brechas y fortalezas, y citar explícitamente las evidencias encontradas con su ubicación en el documento. Inicia con: 'Se observa que...' o 'El documento evidencia...'",
  "resumen_ejecutivo": "2-3 frases ejecutivas sobre el estado normativo del documento y su nivel de cumplimiento PSM.",
  "evidencias_citadas": [
    {
      "texto_evidencia": "Cita textual o descripción específica de la evidencia encontrada",
      "ubicacion_documento": "Sección, página, párrafo o ubicación específica dentro del documento",
      "tipo_evidencia": "Fortaleza|Brecha|Inconsistencia|Cumplimiento parcial"
    }
  ],
  "inconsistencias": ["Lista de contradicciones o inconsistencias detectadas con su ubicación específica"],
  "calificaciones": [
    { 
      "pregunta": "texto exacto de la pregunta normativa", 
      "calificacion": "Suficiente|Escasa|Al menos una|No hay", 
      "puntaje": 100|62|25|0, 
      "justificacion": "justificación técnica y normativa detallada citando evidencias específicas del documento",
      "evidencia_soporte": "Cita específica del documento que respalda esta calificación",
      "recomendacion": "Acción concreta para alcanzar el nivel de suficiencia"
    }
  ],
  "fortalezas_identificadas": [
    {
      "descripcion": "Fortaleza específica encontrada en el documento",
      "evidencia_soporte": "Cita textual que respalda esta fortaleza",
      "impacto_psm": "Impacto positivo en la gestión de seguridad de procesos"
    }
  ],
  "brechas_identificadas": [
    {
      "descripcion": "Brecha específica identificada en el documento",
      "severidad": "Crítico|Alto|Medio|Bajo",
      "norma_incumplida": "Artículo específico del Decreto 1347 o Resolución 5492",
      "recomendacion_accion": "Acción específica y concreta para cerrar la brecha"
    }
  ],
  "brechas_campo": [
    { "descripcion": "Brecha específica que el auditor debe verificar físicamente en el sitio", "criticidad": "Bajo|Medio|Alto|Crítico", "norma_aplicable": "Artículo del Decreto 1347 o Resolución 5492 relacionado" }
  ]
}

CONTENIDO EXTRAÍDO DEL DOCUMENTO:
${textoDoc}

PREGUNTAS NORMATIVAS DEL ALCANCE (aplica a las más relevantes para esta categoría):
${preguntasTexto}`;

    let rawResponse = '';
    try {
      rawResponse = await geminiAnalizar(prompt);
      // Limpiar posibles bloques markdown que la IA añada
      const clean = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(clean);

      // Calcular efectividad ponderada del documento
      const cals = parsed.calificaciones ?? [];
      const puntajes = cals.map(c => Number(c.puntaje ?? { Suficiente: 100, Escasa: 62, 'Al menos una': 25, 'No hay': 0 }[c.calificacion] ?? 0));
      const efectividad = puntajes.length > 0 ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) : null;

      // Estructura completa del análisis PSM
      const analisisCompleto = {
        analisis_tecnico: parsed.analisis_tecnico ?? rawResponse,
        resumen_ejecutivo: parsed.resumen_ejecutivo ?? '',
        evidencias_citadas: parsed.evidencias_citadas ?? [],
        inconsistencias: parsed.inconsistencias ?? [],
        fortalezas_identificadas: parsed.fortalezas_identificadas ?? [],
        brechas_identificadas: parsed.brechas_identificadas ?? [],
        calificaciones: parsed.calificaciones ?? [],
        brechas_campo: parsed.brechas_campo ?? [],
        efectividad
      };

      await pool.query(
        `UPDATE diagnostico_documentos
         SET estado='Analizado', analisis_ia=$1, calificaciones=$2, brechas=$3
         WHERE id=$4`,
        [
          JSON.stringify(analisisCompleto),
          JSON.stringify({ items: parsed.calificaciones ?? [], efectividad, inconsistencias: parsed.inconsistencias ?? [] }),
          JSON.stringify(parsed.brechas_campo ?? []),
          docId,
        ]
      );
      res.json({ ok: true, analisis: { ...parsed, efectividad } });
    } catch (parseErr) {
      // Si la IA no devolvió JSON válido, guardamos el texto plano
      await pool.query(
        `UPDATE diagnostico_documentos SET estado='Analizado', analisis_ia=$1 WHERE id=$2`,
        [rawResponse, docId]
      );
      res.json({ ok: true, analisis: { analisis_tecnico: rawResponse, calificaciones: [], brechas_campo: [] } });
    }
  } catch (err) {
    await pool.query(`UPDATE diagnostico_documentos SET estado='Error' WHERE id=$1`, [docId]);
    console.error('[analizar doc]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diagnosticos/:id/precalificacion  – genera el JSON de Pre-calificación Documental
app.get('/api/diagnosticos/:id/precalificacion', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows: [diag] } = await pool.query(
      `SELECT d.nivel_calculado, d.estado, p.nombre AS planta_nombre
       FROM diagnosticos d LEFT JOIN plantas p ON p.id=d.planta_id WHERE d.id=$1`,
      [diagId]
    );
    const { rows: docs } = await pool.query(
      `SELECT id, categoria, nombre_original, estado, calificaciones, brechas FROM diagnostico_documentos
       WHERE diagnostico_id=$1 ORDER BY categoria`,
      [diagId]
    );

    // Aplanar calificaciones y brechas
    const todasCalificaciones = [];
    const todasBrechas        = [];
    const cobertura           = {};

    for (const doc of docs) {
      const cat = doc.categoria;
      cobertura[cat] = cobertura[cat] ?? { total: 0, analizados: 0 };
      cobertura[cat].total++;
      if (doc.estado === 'Analizado') cobertura[cat].analizados++;
      if (Array.isArray(doc.calificaciones)) {
        todasCalificaciones.push(...doc.calificaciones.map(c => ({ ...c, documento: doc.nombre_original, categoria: cat })));
      }
      if (Array.isArray(doc.brechas)) {
        todasBrechas.push(...doc.brechas.map(b => ({ ...b, documento: doc.nombre_original, categoria: cat })));
      }
    }

    const payload = {
      diagnostico_id:        diagId,
      nivel:                 diag?.nivel_calculado ?? null,
      planta:                diag?.planta_nombre ?? null,
      estado_diagnostico:    diag?.estado ?? null,
      fecha_generacion:      new Date().toISOString(),
      documentos_total:      docs.length,
      documentos_analizados: docs.filter(d => d.estado === 'Analizado').length,
      cobertura_por_categoria: cobertura,
      calificaciones:        todasCalificaciones,
      brechas_identificadas: todasBrechas,
      brechas_criticas:      todasBrechas.filter(b => b.criticidad === 'Crítico' || b.criticidad === 'Alto'),
    };
    // Guardar informe automáticamente para persistencia (evita endpoint PATCH 404)
    const informeStr = JSON.stringify(payload, null, 2);
    await pool.query(
      `UPDATE diagnosticos SET resultado_ia_fase2=$1, updated_at=NOW() WHERE id=$2`,
      [informeStr, diagId]
    ).catch(() => {});
    res.json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/triangular – análisis cruzado de todos los documentos + entrevistas
app.post('/api/diagnosticos/:id/triangular', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const [{ rows: docs }, { rows: entrevistas }, { rows: preguntas }, { rows: [diag] }] = await Promise.all([
      pool.query(`SELECT categoria, nombre_original, texto_extraido, analisis_ia FROM diagnostico_documentos WHERE diagnostico_id=$1 AND texto_extraido IS NOT NULL`, [diagId]),
      pool.query(`SELECT participante, cargo, transcripcion FROM diagnostico_entrevistas WHERE diagnostico_id=$1 AND transcripcion IS NOT NULL`, [diagId]),
      pool.query(`SELECT p.elemento, p.pregunta, dr.respuesta FROM diagnostico_respuestas dr JOIN preguntas p ON p.id=dr.pregunta_id WHERE dr.diagnostico_id=$1`, [diagId]),
      pool.query(`SELECT nivel_calculado FROM diagnosticos WHERE id=$1`, [diagId]),
    ]);

    const resumenDocs = docs.map(d =>
      `### [${d.categoria}] ${d.nombre_original}\n${(d.analisis_ia ?? d.texto_extraido ?? '').slice(0, 2000)}`
    ).join('\n\n---\n\n');

    const resumenEntrevistas = entrevistas.map(e =>
      `### Entrevista: ${e.participante ?? 'Sin nombre'} (${e.cargo ?? ''})\n${(e.transcripcion ?? '').slice(0, 1500)}`
    ).join('\n\n---\n\n');

    const resumenPreguntas = preguntas.filter(p => p.respuesta).map(p =>
      `• [${p.elemento}] ${p.pregunta} → ${p.respuesta}`
    ).join('\n');

    const prompt = `Actúa como Consultor Senior en Seguridad de Procesos (PSM) bajo Decreto 1347/2021 y Resolución 5492/2024 de Colombia. Realizarás una TRIANGULACIÓN DE EVIDENCIAS PSM.

OBJETIVO: Contrastar y validar la coherencia entre:
1. Documentación técnica cargada (P&IDs, HAZOP, procedimientos, etc.)
2. Declaraciones recogidas en entrevistas de campo
3. Respuestas del cuestionario normativo

REGLAS DE TRIANGULACIÓN:
- ¿Los equipos críticos del inventario aparecen en los P&IDs?
- ¿El HAZOP/LOPA referencia los mismos escenarios que los P&IDs?
- ¿Las declaraciones de los entrevistados contradicen o confirman la documentación?
- ¿Los procedimientos operacionales cubren los riesgos identificados?
- ¿Los registros de incidentes están vinculados a los análisis de riesgos?
- ¿Hay brechas entre lo documentado y lo declarado en entrevistas?

Genera únicamente JSON válido (sin markdown) con esta estructura:
{
  "hallazgos_triangulacion": [
    { "fuentes_comparadas": ["Documento A", "Entrevista B"], "hallazgo": "descripción técnica", "tipo": "Consistencia|Contradicción|Brecha", "criticidad": "Bajo|Medio|Alto|Crítico" }
  ],
  "calificacion_global": { "puntaje": 0-100, "nivel": "Suficiente|Escasa|Al menos una|No hay", "justificacion": "resumen ejecutivo" },
  "brechas_prioritarias": [
    { "descripcion": "brecha específica", "criticidad": "Crítico|Alto|Medio|Bajo", "norma": "artículo aplicable", "accion_recomendada": "acción concreta" }
  ],
  "conclusion_diagnostica": "Párrafo de 3-5 oraciones en tono legal-profesional resumiendo el estado PSM de la organización"
}

DOCUMENTOS ANALIZADOS (${docs.length}):
${resumenDocs || 'Sin documentos cargados.'}

ENTREVISTAS REALIZADAS (${entrevistas.length}):
${resumenEntrevistas || 'Sin entrevistas registradas.'}

CUESTIONARIO NORMATIVO RESPONDIDO:
${resumenPreguntas || 'Sin respuestas en el cuestionario.'}`;

    const rawResponse = await geminiAnalizar(prompt);
    const clean  = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(clean);
    res.json(result);
  } catch (err) {
    console.error('[triangular]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Entrevistas – Fase 4 ─────────────────────────────────────────────────────

// GET /api/diagnosticos/:id/entrevistas
app.get('/api/diagnosticos/:id/entrevistas', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.participante, e.cargo, e.fecha, e.duracion_seg, e.estado,
              e.transcripcion, e.analisis_ia, e.calificaciones, e.brechas,
              e.puntuacion_efectividad, e.tipo_cumplimiento, e.area_id, e.notas_consultor, e.audio_url,
              a.nombre AS area_nombre, e.created_at
       FROM diagnostico_entrevistas e
       LEFT JOIN areas a ON a.id = e.area_id
       WHERE e.diagnostico_id=$1 ORDER BY e.created_at`,
      [diagId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/entrevistas  – crea nueva entrevista
app.post('/api/diagnosticos/:id/entrevistas', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  const { participante, cargo, area_id, transcripcion, duracion_seg, notas_consultor, audio_url } = req.body;
  try {
    const { rows: [ins] } = await pool.query(
      `INSERT INTO diagnostico_entrevistas (diagnostico_id, participante, cargo, area_id, transcripcion, duracion_seg, notas_consultor, audio_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [diagId, participante || null, cargo || null, area_id || null, transcripcion || null, duracion_seg || null, notas_consultor || null, audio_url || null]
    );
    const { rows: [ent] } = await pool.query(
      `SELECT e.*, a.nombre AS area_nombre FROM diagnostico_entrevistas e LEFT JOIN areas a ON a.id=e.area_id WHERE e.id=$1`,
      [ins.id]
    );
    await pool.query(`UPDATE diagnosticos SET paso_actual = 5 WHERE id = $1 AND paso_actual < 5`, [diagId]);
    res.status(201).json(ent || ins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/diagnosticos/:id/entrevistas/:entId  – actualiza entrevista
app.patch('/api/diagnosticos/:id/entrevistas/:entId', verificarToken, async (req, res) => {
  const entId = Number(req.params.entId);
  const { participante, cargo, area_id, transcripcion, duracion_seg, notas_consultor, audio_url } = req.body;
  try {
    await pool.query(
      `UPDATE diagnostico_entrevistas
         SET participante=$1, cargo=$2, area_id=$3, transcripcion=$4, duracion_seg=$5, notas_consultor=$6, audio_url=$7
       WHERE id=$8`,
      [participante || null, cargo || null, area_id || null, transcripcion || null, duracion_seg || null, notas_consultor || null, audio_url || null, entId]
    );
    const { rows: [updated] } = await pool.query(
      `SELECT e.*, a.nombre AS area_nombre FROM diagnostico_entrevistas e LEFT JOIN areas a ON a.id=e.area_id WHERE e.id=$1`,
      [entId]
    );
    res.json(updated || { ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/diagnosticos/:id/entrevistas/:entId
app.delete('/api/diagnosticos/:id/entrevistas/:entId', verificarToken, async (req, res) => {
  const entId = Number(req.params.entId);
  try {
    await pool.query('DELETE FROM diagnostico_entrevistas WHERE id=$1', [entId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Multer para audio de entrevistas
const uploadAudioEntrevista = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const diagId = req.params.id ?? 'misc';
      const tid    = req.usuario?.tenant_id ?? 0;
      const dir    = path.join(UPLOADS_DIR, String(tid), String(diagId), 'entrevistas');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      cb(null, `audio-${Date.now()}-${Math.round(Math.random()*1e6)}${path.extname(file.originalname) || '.webm'}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ['audio/webm','audio/mp3','audio/mpeg','audio/ogg','audio/wav','audio/mp4','audio/x-m4a'].includes(file.mimetype);
    cb(null, ok);
  },
});

// POST /api/diagnosticos/:id/entrevistas/:entId/audio  – sube audio y actualiza audio_url
app.post(
  '/api/diagnosticos/:id/entrevistas/:entId/audio',
  verificarToken,
  uploadAudioEntrevista.single('audio'),
  async (req, res) => {
    const entId = Number(req.params.entId);
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo de audio.' });
    const audioUrl = '/uploads/' + path.relative(UPLOADS_DIR, req.file.path).replace(/\\/g, '/');
    try {
      await pool.query('UPDATE diagnostico_entrevistas SET audio_url=$1 WHERE id=$2', [audioUrl, entId]);
      res.json({ audio_url: audioUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// POST /api/diagnosticos/:id/transcribir  – transcribe audio con Gemini (Whisper-like)
app.post(
  '/api/diagnosticos/:id/transcribir',
  verificarToken,
  uploadAudioEntrevista.single('audio'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo de audio.' });
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY no configurada para transcripción.' });
    try {
      const buf = fs.readFileSync(req.file.path);
      const b64 = buf.toString('base64');
      const mime = req.file.mimetype || 'audio/webm';
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        { inlineData: { mimeType: mime, data: b64 } },
        'Transcribe este audio a texto en español (Colombia). Solo devuelve la transcripción literal, sin comentarios ni resúmenes.',
      ]);
      const text = result?.response?.text?.()?.trim() ?? '';
      res.json({ transcripcion: text });
    } catch (err) {
      console.error('[transcribir]', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/diagnosticos/:id/entrevistas/:entId/analizar  – IA contrasta entrevista vs documentos
app.post('/api/diagnosticos/:id/entrevistas/:entId/analizar', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  const entId  = Number(req.params.entId);
  try {
    const { rows: [ent] } = await pool.query('SELECT * FROM diagnostico_entrevistas WHERE id=$1', [entId]);
    if (!ent?.transcripcion) return res.status(400).json({ error: 'La entrevista no tiene transcripción.' });

    const { rows: docs } = await pool.query(
      `SELECT categoria, nombre_original, analisis_ia FROM diagnostico_documentos
       WHERE diagnostico_id=$1 AND (analisis_ia IS NOT NULL OR texto_extraido IS NOT NULL) LIMIT 8`,
      [diagId]
    );
    const { rows: preguntas } = await pool.query(
      `SELECT p.elemento, p.pregunta FROM diagnostico_respuestas dr
       JOIN preguntas p ON p.id=dr.pregunta_id WHERE dr.diagnostico_id=$1 LIMIT 20`,
      [diagId]
    );
    const { rows: [diag] } = await pool.query('SELECT nivel_calculado FROM diagnosticos WHERE id=$1', [diagId]);

    const docResumen = docs.map(d => `[${d.categoria}] ${d.nombre_original}: ${(d.analisis_ia ?? '').slice(0, 800)}`).join('\n\n');
    const pregResumen = preguntas.map(p => `• [${p.elemento}] ${p.pregunta}`).join('\n');

    const prompt = `Actúa como Consultor Senior en Seguridad de Procesos (PSM) bajo Decreto 1347/2021 y Resolución 5492/2024, con expertise en los 20 elementos CCPS. Analiza la transcripción de entrevista de campo.

═══ REGLAS ESTRICTAS DE ANÁLISIS ═══

1. TIPO DE CUMPLIMIENTO — Clasifica el testimonio en UNA categoría:
   • "Sistemático": el entrevistado demuestra conocimiento procedimentalizado, referencia documentos, fechas, responsables.
   • "Informal": conoce la práctica pero no la documentación/procedimiento; cumplimiento de facto sin respaldo formal.
   • "Desconocimiento": no conoce procedimientos, ubicación de documentos, responsables de elementos PSM clave.

2. DETECCIÓN DE SESGOS:
   • "Sesgo de respuesta social" (dice lo correcto sin evidencia de que lo practica).
   • "Sobrestimación de capacidad" (afirma cumplir sin citar evidencia verificable).

3. TRIANGULACIÓN: Contrasta con documentos de Fase 2 punto por punto. Si el entrevistado afirma X y el documento dice Y, registra la contradicción con cita textual.

4. CALIFICACIÓN POR ELEMENTO CCPS / Decreto 1347:
   • Suficiente (75-100%): Conocimiento sistemático, cita documentos, identifica responsables.
   • Escasa (50-74%): Conocimiento parcial, referencias vagas, sin respaldo documental completo.
   • Al menos una (1-49%): Conocimiento informal o aislado, no procedimentalizado.
   • No hay (0%): Desconocimiento total del elemento.

Responde SOLO JSON válido sin markdown ni texto adicional:
{
  "analisis_tecnico": "Párrafo en tercera persona, tono pericial-legal, mínimo 200 palabras. Cita elementos CCPS y artículos del Decreto 1347/2021.",
  "citas_clave": ["Frases textuales del entrevistado que sustenten la calificación de efectividad (máximo 5 citas)"],
  "tipo_cumplimiento": "Sistemático|Informal|Desconocimiento",
  "tipo_cumplimiento_justificacion": "Breve justificación de la clasificación",
  "sesgos_detectados": ["descripción del sesgo si aplica"],
  "confirmaciones": ["Aspectos donde la entrevista CONFIRMA la documentación"],
  "contradicciones": ["Aspectos donde la entrevista CONTRADICE la documentación — citar textualmente"],
  "conocimiento_informal": ["Prácticas mencionadas sin respaldo documental verificable"],
  "calificaciones": [
    { "elemento_ccps": "nombre del elemento", "pregunta": "pregunta evaluada", "calificacion": "Suficiente|Escasa|Al menos una|No hay", "puntaje": 100, "justificacion": "evidencia textual de la entrevista" }
  ],
  "brechas_campo": [
    { "descripcion": "brecha detectada", "elemento_ccps": "elemento afectado", "criticidad": "Bajo|Medio|Alto|Crítico", "norma_aplicable": "Art. X Decreto 1347/2021", "accion_verificacion": "qué verificar en recorrido" }
  ],
  "recomendacion_seguimiento": "Próxima acción concreta para este cargo/rol"
}

ENTREVISTA A ANALIZAR:
Participante: ${ent.participante ?? 'N/D'} | Cargo: ${ent.cargo ?? 'N/D'}
---
${ent.transcripcion}

DOCUMENTACIÓN TÉCNICA (Fase 2):
${docResumen || 'Sin documentación analizada aún — evaluar solo con base en la entrevista.'}

PREGUNTAS NORMATIVAS DEL DIAGNÓSTICO (contexto):
${pregResumen || 'No disponibles.'}`;

    const rawResponse = await geminiAnalizar(prompt);
    const clean  = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    const cals = parsed.calificaciones ?? [];
    const puntajes = cals.map(c => Number(c.puntaje ?? 0));
    const efectividad = puntajes.length ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) : null;

    await pool.query(
      `UPDATE diagnostico_entrevistas
         SET estado='Analizado', analisis_ia=$1, calificaciones=$2, brechas=$3,
             puntuacion_efectividad=$4, tipo_cumplimiento=$5
       WHERE id=$6`,
      [
        parsed.analisis_tecnico,
        JSON.stringify({
          items:               cals,
          efectividad,
          citas_clave:         parsed.citas_clave,
          confirmaciones:      parsed.confirmaciones,
          contradicciones:     parsed.contradicciones,
          conocimiento_informal: parsed.conocimiento_informal,
          sesgos_detectados:   parsed.sesgos_detectados,
          tipo_cumplimiento_justificacion: parsed.tipo_cumplimiento_justificacion,
        }),
        JSON.stringify(parsed.brechas_campo ?? []),
        efectividad ?? null,
        parsed.tipo_cumplimiento ?? null,
        entId,
      ]
    );
    res.json({ ok: true, analisis: { ...parsed, efectividad } });
  } catch (err) {
    await pool.query(`UPDATE diagnostico_entrevistas SET estado='Error' WHERE id=$1`, [entId]);
    console.error('[analizar entrevista]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Recorrido / Captura Sensorial de Campo ──────────────────────────────────

// Multer específico para fotos de campo (solo imágenes)
const uploadCampo = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const diagId = req.params.id ?? 'misc';
      const tid    = req.usuario?.tenant_id ?? 0;
      const dir    = path.join(UPLOADS_DIR, String(tid), String(diagId), 'campo');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      cb(null, `foto-${Date.now()}-${Math.round(Math.random()*1e6)}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) { cb(null, file.mimetype.startsWith('image/')); },
});

// GET /api/diagnosticos/:id/recorrido
app.get('/api/diagnosticos/:id/recorrido', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM diagnostico_recorrido WHERE diagnostico_id=$1 ORDER BY created_at ASC, id ASC`,
      [diagId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/recorrido  – añade nota de campo
app.post('/api/diagnosticos/:id/recorrido', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  const { area, categoria, observacion, transcripcion, hallazgo, criticidad, orden } = req.body;
  if (!area) return res.status(400).json({ error: 'El campo "area" es obligatorio.' });
  try {
    const { rows: [diag] } = await pool.query('SELECT estado FROM diagnosticos WHERE id=$1', [diagId]);
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado.' });
    if (diag.estado === 'Finalizado') return res.status(403).json({ error: 'Diagnóstico finalizado.' });
    const { rows: [item] } = await pool.query(
      `INSERT INTO diagnostico_recorrido
         (diagnostico_id, area, categoria, observacion, transcripcion, hallazgo, criticidad, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [diagId, area, categoria||'Estado de Equipos', observacion||null,
       transcripcion||null, hallazgo||null, criticidad||null, orden??0]
    );
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/recorrido/triangular  – triangulación global de campo vs Fase 2
app.post('/api/diagnosticos/:id/recorrido/triangular', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows: notas  } = await pool.query(
      `SELECT area, categoria, transcripcion, observacion, hallazgo, criticidad, created_at
       FROM diagnostico_recorrido WHERE diagnostico_id=$1 ORDER BY created_at ASC`, [diagId]);
    const { rows: docs   } = await pool.query(
      `SELECT categoria, nombre_original, analisis_ia, brechas
       FROM diagnostico_documentos WHERE diagnostico_id=$1 AND estado='Analizado'`, [diagId]);
    const { rows: resp   } = await pool.query(
      `SELECT p.elemento, p.pregunta, dr.respuesta
       FROM diagnostico_respuestas dr JOIN preguntas p ON dr.pregunta_id=p.id
       WHERE dr.diagnostico_id=$1 AND dr.respuesta IN ('Escasa','No evidencia') LIMIT 20`, [diagId]);

    const notasCtx = notas.map(n =>
      `[${n.area} / ${n.categoria||'Campo'}] ${n.transcripcion||n.observacion||n.hallazgo||''}`
    ).join('\n');
    const docsCtx  = docs.map(d =>
      `[Fase 2 - ${d.categoria}] ${d.nombre_original}:\n${(d.analisis_ia||'').slice(0,600)}`
    ).join('\n---\n');
    const respCtx  = resp.map(r => `• [${r.elemento}] → ${r.respuesta}`).join('\n');

    const prompt = `Eres un Consultor Senior en PSM (Process Safety Management) bajo el Decreto 1347 de 2021 de Colombia.

OBSERVACIONES DE CAMPO (Fase 3 - Recorrido):
${notasCtx || 'Sin observaciones registradas.'}

DOCUMENTACIÓN FASE 2 (análisis de evidencias documentales):
${docsCtx || 'Sin documentos analizados en Fase 2.'}

PREGUNTAS CON RESPUESTA CRÍTICA (Cuestionario Normativo):
${respCtx || 'Ninguna con calificación crítica.'}

TAREA DE TRIANGULACIÓN:
1. Identifica las principales BRECHAS donde la realidad de campo contradice la documentación.
2. Detecta FORTALEZAS donde el campo confirma lo documentado.
3. Evalúa la CULTURA DE SEGURIDAD observada en las interacciones.
4. Emite una CALIFICACIÓN GLOBAL del sistema PSM: Suficiente / Escasa / Al menos una / No hay.
5. Lista las TOP 5 PRIORIDADES de acción inmediata.

Responde SOLO en JSON válido:
{
  "brechas_criticas": [{"area":"","descripcion":"","severidad":"Alto|Crítico","norma":""}],
  "fortalezas": [{"area":"","descripcion":""}],
  "cultura_seguridad": {"nivel":"Bajo|Medio|Alto","narrativa":""},
  "calificacion_global": "Suficiente|Escasa|Al menos una|No hay",
  "prioridades_accion": ["","","","",""],
  "resumen_ejecutivo": ""
}`;

    const raw = await geminiAnalizar(prompt);
    let resultado;
    try { const m = raw.match(/\{[\s\S]*\}/); resultado = JSON.parse(m?.[0] ?? raw); }
    catch { resultado = { resumen_ejecutivo: raw, brechas_criticas:[], fortalezas:[], prioridades_accion:[], calificacion_global:'Escasa', cultura_seguridad:{nivel:'Medio',narrativa:''} }; }
    res.json(resultado);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/diagnosticos/:id/recorrido/:itemId  – edita nota de campo
app.patch('/api/diagnosticos/:id/recorrido/:itemId', verificarToken, async (req, res) => {
  const itemId = Number(req.params.itemId);
  const { area, categoria, observacion, transcripcion, hallazgo, criticidad } = req.body;
  try {
    await pool.query(
      `UPDATE diagnostico_recorrido
         SET area=$1, categoria=$2, observacion=$3, transcripcion=$4, hallazgo=$5, criticidad=$6
       WHERE id=$7`,
      [area, categoria||'Estado de Equipos', observacion||null,
       transcripcion||null, hallazgo||null, criticidad||null, itemId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/recorrido/:itemId/foto  – sube foto de evidencia
app.post('/api/diagnosticos/:id/recorrido/:itemId/foto', verificarToken, uploadCampo.single('foto'), async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  const fotoPath = req.file.path;
  const fotoUrl  = '/uploads/' + path.relative(UPLOADS_DIR, fotoPath).replace(/\\/g, '/');
  try {
    await pool.query(
      'UPDATE diagnostico_recorrido SET foto_path=$1, foto_url=$2 WHERE id=$3',
      [fotoPath, fotoUrl, itemId]
    );
    res.json({ foto_url: fotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/diagnosticos/:id/recorrido/:itemId/analizar  – análisis IA de nota vs Fase 2
app.post('/api/diagnosticos/:id/recorrido/:itemId/analizar', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  try {
    const { rows:[nota] } = await pool.query(
      'SELECT * FROM diagnostico_recorrido WHERE id=$1 AND diagnostico_id=$2', [itemId, diagId]);
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada.' });

    const { rows: docs  } = await pool.query(
      `SELECT categoria, nombre_original, analisis_ia FROM diagnostico_documentos
       WHERE diagnostico_id=$1 AND estado='Analizado' AND analisis_ia IS NOT NULL`, [diagId]);
    const { rows: resp  } = await pool.query(
      `SELECT p.elemento, p.pregunta, dr.respuesta
       FROM diagnostico_respuestas dr JOIN preguntas p ON dr.pregunta_id=p.id
       WHERE dr.diagnostico_id=$1 AND dr.respuesta IN ('Escasa','No evidencia') LIMIT 15`, [diagId]);

    const textoObservado = nota.transcripcion || nota.observacion || nota.hallazgo || '(sin texto)';
    const docsCtx = docs.length
      ? docs.map(d=>`[${d.categoria}] ${d.nombre_original}:\n${(d.analisis_ia||'').slice(0,700)}`).join('\n---\n')
      : 'No hay documentos de Fase 2 disponibles.';
    const respCtx = resp.length
      ? resp.map(r=>`• [${r.elemento}] "${r.pregunta.slice(0,80)}…" → ${r.respuesta}`).join('\n')
      : '';

    const prompt = `Eres un Consultor Senior PSM bajo el Decreto 1347 de 2021 (Colombia). Analiza esta observación de campo versus la documentación existente.

OBSERVACIÓN DE CAMPO:
Área: ${nota.area}
Categoría: ${nota.categoria||'General'}
Texto del auditor: "${textoObservado}"

DOCUMENTACIÓN FASE 2:
${docsCtx}

${respCtx ? `PREGUNTAS CON HALLAZGOS CRÍTICOS:\n${respCtx}` : ''}

ANÁLISIS REQUERIDO:
1. Identifica INCONSISTENCIAS entre lo observado y lo documentado. Para cada una indica: descripcion, severidad (Bajo/Medio/Alto/Crítico), documento_referencia, norma_aplicable (Decreto 1347 o Resolución 5492).
2. Califica la gestión en esta área: Suficiente (75-100%) / Escasa (50-74%) / Al menos una (1-49%) / No hay (0%).
3. Determina severidad_global: Bajo / Medio / Alto / Crítico.
4. Redacta un hallazgo_narrativo en tercera persona, tono técnico-legal.
5. Si hay interacción con personal, evalúa cultura_seguridad brevemente.

Responde SOLO en JSON válido:
{
  "inconsistencias": [{"descripcion":"","severidad":"","documento_referencia":"","norma_aplicable":""}],
  "calificacion": "Suficiente|Escasa|Al menos una|No hay",
  "severidad_global": "Bajo|Medio|Alto|Crítico",
  "hallazgo_narrativo": "",
  "cultura_seguridad": ""
}`;

    const raw = await geminiAnalizar(prompt);
    let resultado;
    try { const m = raw.match(/\{[\s\S]*\}/); resultado = JSON.parse(m?.[0] ?? raw); }
    catch { resultado = { inconsistencias:[], calificacion:'Escasa', severidad_global:'Medio', hallazgo_narrativo: raw, cultura_seguridad:'' }; }

    await pool.query(
      `UPDATE diagnostico_recorrido
         SET analisis_ia=$1, inconsistencias=$2, severidad_ia=$3, calificacion_ia=$4,
             hallazgo=$5, cultura_seguridad=$6
       WHERE id=$7`,
      [resultado.hallazgo_narrativo, JSON.stringify(resultado.inconsistencias??[]),
       resultado.severidad_global??'Medio', resultado.calificacion??'Escasa',
       (resultado.hallazgo_narrativo??'').slice(0,600), resultado.cultura_seguridad??'', itemId]
    );
    res.json(resultado);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/diagnosticos/:id/recorrido/:itemId  – elimina nota de campo
app.delete('/api/diagnosticos/:id/recorrido/:itemId', verificarToken, async (req, res) => {
  const itemId = Number(req.params.itemId);
  try {
    const { rows:[nota] } = await pool.query(
      'SELECT foto_path FROM diagnostico_recorrido WHERE id=$1', [itemId]);
    if (nota?.foto_path && fs.existsSync(nota.foto_path)) {
      fs.unlinkSync(nota.foto_path);
    }
    await pool.query('DELETE FROM diagnostico_recorrido WHERE id=$1', [itemId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/diagnosticos/:id  – elimina un diagnóstico en curso (no Finalizados)
app.delete('/api/diagnosticos/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows: [diag] } = await pool.query(
      'SELECT estado, tenant_id FROM diagnosticos WHERE id=$1', [id]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado.' });

    // Solo SuperAdmin/Consultor/AdminInquilino pueden borrar; Lector no
    if (req.usuario.rol === 'Lector') {
      return res.status(403).json({ error: 'Sin permiso para eliminar diagnósticos.' });
    }
    // Los diagnósticos Finalizados son inmutables
    if (diag.estado === 'Finalizado' || diag.estado === 'Aprobado') {
      return res.status(403).json({ error: 'No se puede eliminar un diagnóstico ya finalizado.' });
    }
    // Auditor solo puede borrar sus propios diagnósticos del mismo tenant
    const tid = tenantScope(req);
    if (tid && diag.tenant_id !== tid && req.usuario.rol !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Sin permiso sobre este diagnóstico.' });
    }

    await pool.query('DELETE FROM diagnosticos WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE diagnostico]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/setup/hierarchy  – plantas + áreas del tenant del usuario autenticado
app.get('/api/setup/hierarchy', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    let plantasQ = 'SELECT id, nombre, ubicacion, responsable FROM plantas';
    const params = [];
    if (tid) { plantasQ += ' WHERE tenant_id = $1'; params.push(tid); }
    plantasQ += ' ORDER BY nombre ASC';
    const { rows: plantas } = await pool.query(plantasQ, params);

    // Áreas de todas las plantas anteriores
    let areas = [];
    if (plantas.length > 0) {
      const ids = plantas.map((p) => p.id);
      const { rows } = await pool.query(
        `SELECT id, planta_id, nombre, descripcion FROM areas WHERE planta_id = ANY($1) ORDER BY nombre ASC`,
        [ids]
      );
      areas = rows;
    }
    res.json({ plantas, areas });
  } catch (err) {
    console.error('[hierarchy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/diagnosticos/:id/validar  – solo Consultor
app.put(
  '/api/diagnosticos/:id/validar',
  verificarToken,
  verificarRol('Consultor', 'SuperAdmin'),
  async (req, res) => {
    const { hallazgos_validados } = req.body;
    console.log(`[VALIDAR] diagnóstico #${req.params.id} por consultor #${req.usuario.id}`);
    try {
      const { rowCount } = await pool.query(
        `UPDATE diagnosticos
         SET hallazgos_validados=$1, estado='Aprobado', updated_at=NOW()
         WHERE id=$2`,
        [hallazgos_validados || '', req.params.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
      res.json({ ok: true, estado: 'Aprobado' });
    } catch (err) {
      console.error('[VALIDAR] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── Test de conexión ──────────────────────────────────────────────────────

app.get('/api/test-db', async (req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    res.json({
      success: true,
      message: 'Conexión Exitosa: Base de Datos PostgreSQL en Neon está operativa.',
      latency_ms: latency,
    });
  } catch (err) {
    console.error('test-db error:', err);
    let detail = err.message || 'Error desconocido';
    if (err.code === '28P01' || err.code === '28000') detail = 'Error de Autenticación: credenciales inválidas.';
    else if (err.code === 'ECONNREFUSED') detail = 'Servidor No Alcanzado: la base de datos rechazó la conexión.';
    else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') detail = 'Timeout de Red: no se pudo alcanzar el host de la base de datos.';
    res.status(500).json({ success: false, error: detail });
  }
});

// PATCH /api/diagnosticos/:id/validar  – alias REST para el mismo flujo
app.patch(
  '/api/diagnosticos/:id/validar',
  verificarToken,
  verificarRol('Consultor', 'SuperAdmin'),
  async (req, res) => {
    const { hallazgos_validados, estado } = req.body;
    const nuevoEstado = estado || 'Aprobado';
    console.log(`[PATCH VALIDAR] diagnóstico #${req.params.id} → ${nuevoEstado}`);
    try {
      const { rowCount } = await pool.query(
        `UPDATE diagnosticos
         SET hallazgos_validados=$1, estado=$2, updated_at=NOW()
         WHERE id=$3`,
        [hallazgos_validados || '', nuevoEstado, req.params.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
      res.json({ ok: true, estado: nuevoEstado });
    } catch (err) {
      console.error('[PATCH VALIDAR] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── Motor de Clasificación ──────────────────────────────────────────────────

function calcularNivel({ riesgo_tecnico, regulacion, madurez, estrategia, complejidad, exposicion }) {
  const vals = [riesgo_tecnico, regulacion, madurez, estrategia, complejidad, exposicion];
  const promedio = vals.reduce((a, b) => a + b, 0) / vals.length;
  const criticos  = vals.filter(v => v === 4).length;
  if (criticos > 2 || complejidad === 4) return 5;
  if (promedio > 3.5)  return 4;
  if (promedio > 2.5)  return 3;
  if (promedio >= 1.5) return 2;
  return 1;
}

async function ensureDiagnosticoSetup() {
  try {
    // Columnas nuevas en diagnosticos (idempotentes)
    for (const sql of [
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS nivel_calculado INTEGER`,
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS paso_actual     INTEGER DEFAULT 1`,
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS data_setup      JSONB`,
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS puntuacion      INTEGER`,
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS fecha_cierre    TIMESTAMP`,
      `ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS resultado_ia_fase2 TEXT`,
    ]) { await pool.query(sql).catch(() => {}); }

    // Ampliar el CHECK de estado para incluir las fases del workflow
    await pool.query(`ALTER TABLE diagnosticos DROP CONSTRAINT IF EXISTS diagnosticos_estado_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE diagnosticos
        ADD CONSTRAINT diagnosticos_estado_check
        CHECK (estado IN (
          'Borrador','En Validación','Aprobado',
          'Configuracion','Carga','Recorrido','Entrevistas','Validacion','Finalizado'
        ))
    `).catch(() => {});

    // Tabla de observaciones del Recorrido Técnico (Walkthrough) + campos ampliados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_recorrido (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
        area            TEXT    NOT NULL,
        observacion     TEXT,
        hallazgo        TEXT,
        criticidad      TEXT    CHECK (criticidad IN ('Bajo','Medio','Alto','Crítico')),
        orden           INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    // Nuevas columnas de captura sensorial (idempotentes)
    for (const col of [
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS categoria    TEXT    DEFAULT 'Estado de Equipos'`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS transcripcion TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS foto_path     TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS foto_url      TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS analisis_ia   TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS inconsistencias JSONB`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS severidad_ia  TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS calificacion_ia TEXT`,
      `ALTER TABLE diagnostico_recorrido ADD COLUMN IF NOT EXISTS cultura_seguridad TEXT`,
    ]) { await pool.query(col).catch(() => {}); }

    // Tabla de respuestas y alcance fijado por diagnóstico
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_respuestas (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
        pregunta_id     INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
        respuesta       TEXT CHECK (respuesta IN ('Suficiente','Escasa','Al menos','No evidencia','No aplica')),
        comentario      TEXT,
        orden           INTEGER,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(diagnostico_id, pregunta_id)
      )
    `).catch(() => {});

    // Tabla de desglose de dimensiones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_setup (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER REFERENCES diagnosticos(id) ON DELETE CASCADE,
        riesgo_tecnico  INTEGER NOT NULL CHECK (riesgo_tecnico  BETWEEN 1 AND 4),
        regulacion      INTEGER NOT NULL CHECK (regulacion      BETWEEN 1 AND 4),
        madurez         INTEGER NOT NULL CHECK (madurez         BETWEEN 1 AND 4),
        estrategia      INTEGER NOT NULL CHECK (estrategia      BETWEEN 1 AND 4),
        complejidad     INTEGER NOT NULL CHECK (complejidad     BETWEEN 1 AND 4),
        exposicion      INTEGER NOT NULL CHECK (exposicion      BETWEEN 1 AND 4),
        nivel_calculado INTEGER,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    // Columnas de justificación cualitativa (idempotentes)
    for (const col of [
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_riesgo      TEXT`,
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_regulacion   TEXT`,
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_madurez      TEXT`,
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_estrategia   TEXT`,
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_complejidad  TEXT`,
      `ALTER TABLE diagnostico_setup ADD COLUMN IF NOT EXISTS comentarios_exposicion   TEXT`,
    ]) { await pool.query(col).catch(() => {}); }
    // Repositorio documental
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_documentos (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
        tenant_id       INTEGER,
        planta_id       INTEGER,
        categoria       TEXT    NOT NULL,
        nombre_original TEXT    NOT NULL,
        nombre_archivo  TEXT    NOT NULL,
        ruta            TEXT    NOT NULL,
        tamano          INTEGER,
        tipo_mime       TEXT,
        estado          TEXT DEFAULT 'Cargado'
                        CHECK (estado IN ('Cargado','Procesando','Analizado','Error')),
        texto_extraido  TEXT,
        analisis_ia     TEXT,
        calificaciones  JSONB,
        brechas         JSONB,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    // Tabla de entrevistas y captura de voz
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_entrevistas (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
        participante    TEXT,
        cargo           TEXT,
        fecha           TIMESTAMP DEFAULT NOW(),
        transcripcion   TEXT,
        duracion_seg    INTEGER,
        analisis_ia     TEXT,
        calificaciones  JSONB,
        brechas         JSONB,
        estado          TEXT DEFAULT 'Borrador'
                        CHECK (estado IN ('Borrador','Analizado','Error')),
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    // Columnas adicionales entrevistas (idempotentes)
    for (const col of [
      `ALTER TABLE diagnostico_entrevistas ADD COLUMN IF NOT EXISTS puntuacion_efectividad INTEGER`,
      `ALTER TABLE diagnostico_entrevistas ADD COLUMN IF NOT EXISTS tipo_cumplimiento      TEXT`,
      `ALTER TABLE diagnostico_entrevistas ADD COLUMN IF NOT EXISTS area_id                 INTEGER`,
      `ALTER TABLE diagnostico_entrevistas ADD COLUMN IF NOT EXISTS notas_consultor        TEXT`,
      `ALTER TABLE diagnostico_entrevistas ADD COLUMN IF NOT EXISTS audio_url               TEXT`,
    ]) { await pool.query(col).catch(() => {}); }

    // ── Tabla de Pronósticos / Gemelo Digital ─────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pronosticos (
        id              SERIAL PRIMARY KEY,
        tenant_id       INTEGER,
        nombre          TEXT    NOT NULL DEFAULT 'Pronóstico',
        analisis_ia     JSONB,
        acciones_base   JSONB,
        generado_por    INTEGER REFERENCES usuarios(id),
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    // ── Tabla de Plan de Acción ───────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plan_accion_items (
        id                      SERIAL PRIMARY KEY,
        tenant_id               INTEGER,
        diagnostico_id          INTEGER REFERENCES diagnosticos(id) ON DELETE SET NULL,
        nombre                  TEXT    NOT NULL,
        descripcion             TEXT,
        responsable             TEXT,
        responsable_email       TEXT,
        fecha_limite            DATE,
        criticidad              TEXT    NOT NULL DEFAULT 'Medio'
                                CHECK (criticidad IN ('Crítico','Alto','Medio','Bajo')),
        estado                  TEXT    NOT NULL DEFAULT 'Pendiente'
                                CHECK (estado IN ('Pendiente','En Progreso','Completado','Cancelado')),
        notificaciones_activas  BOOLEAN DEFAULT FALSE,
        origen_ia               BOOLEAN DEFAULT FALSE,
        plazo_ia                TEXT,
        elemento_psm            TEXT,
        creado_por              INTEGER REFERENCES usuarios(id),
        created_at              TIMESTAMP DEFAULT NOW(),
        updated_at              TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    // Migración idempotente para ítems existentes
    for (const col of [
      `ALTER TABLE plan_accion_items ADD COLUMN IF NOT EXISTS responsable_email      TEXT`,
      `ALTER TABLE plan_accion_items ADD COLUMN IF NOT EXISTS notificaciones_activas BOOLEAN DEFAULT FALSE`,
    ]) { await pool.query(col).catch(() => {}); }

    // ── Tabla de log de notificaciones enviadas ────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plan_accion_notif_log (
        id              SERIAL PRIMARY KEY,
        item_id         INTEGER NOT NULL REFERENCES plan_accion_items(id) ON DELETE CASCADE,
        dias_restantes  INTEGER NOT NULL,
        enviado_a       TEXT    NOT NULL,
        enviado_en      TIMESTAMP DEFAULT NOW(),
        simulado        BOOLEAN DEFAULT FALSE,
        UNIQUE(item_id, dias_restantes)
      )
    `).catch(() => {});

    // Tabla de validaciones HITL (Fase 5)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnostico_validaciones_hitl (
        id              SERIAL PRIMARY KEY,
        diagnostico_id  INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
        pregunta_id     INTEGER NOT NULL REFERENCES preguntas(id),
        evidencia_docs  JSONB DEFAULT '[]',
        evidencia_entrev JSONB DEFAULT '[]',
        evidencia_campo JSONB DEFAULT '[]',
        calificacion_ia TEXT,
        calificacion_humano TEXT,
        criterio_profesional TEXT,
        override_justificacion TEXT,
        validado_por    INTEGER REFERENCES usuarios(id),
        validado_en     TIMESTAMP DEFAULT NOW(),
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(diagnostico_id, pregunta_id)
      )
    `).catch(() => {});

    console.log('[setup] Tablas de workflow listas.');
  } catch (err) {
    console.warn('[setup] Error en ensureDiagnosticoSetup:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 FASE 5: AUDITORÍA EXPERTA CON TRIANGULACIÓN DE EVIDENCIAS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/diagnosticos/:id/questions - Obtener preguntas filtradas por complejidad
app.get('/api/diagnosticos/:id/questions', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.id);
  const { complexity } = req.query; // level del diagnóstico
  
  try {
    // Obtener el nivel calculado del diagnóstico si no se especifica
    let nivelFiltro = complexity;
    if (!nivelFiltro) {
      const { rows: [diag] } = await pool.query(
        'SELECT nivel_calculado FROM diagnosticos WHERE id = $1', [diagId]
      );
      nivelFiltro = diag?.nivel_calculado || 'Medio';
    }

    // Mapear nivel a complejidad de preguntas
    const complejidadMap = {
      'Bajo': [1],
      'Medio': [1, 2], 
      'Alto': [1, 2, 3]
    };
    const complejidadesPermitidas = complejidadMap[nivelFiltro] || [1, 2];

    // Obtener preguntas filtradas con evidencias trianguladas (sin DISTINCT sobre json)
    const { rows: preguntas } = await pool.query(`
      SELECT
        p.id, p.complejidad, p.elemento, p.pregunta,
        p.evidencia_suficiente, p.evidencia_escasa, p.evidencia_al_menos, p.evidencia_no_evidencia,

        -- Evidencias de documentos (subconsulta para evitar DISTINCT sobre json)
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',        dd.id,
            'tipo',      'documento',
            'fuente',    dd.nombre_original,
            'categoria', dd.categoria,
            'fragmento', LEFT(COALESCE(dd.texto_extraido, ''), 300),
            'analisis',  dd.analisis_ia,
            'estado',    dd.estado
          ))
          FROM diagnostico_documentos dd
          WHERE dd.diagnostico_id = $1
            AND dd.estado = 'Analizado'
            AND (dd.analisis_ia ILIKE '%' || p.elemento || '%'
              OR dd.texto_extraido ILIKE '%' || p.elemento || '%')
        ), '[]'::jsonb) AS evidencia_documentos,

        -- Evidencias de entrevistas
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',        de.id,
            'tipo',      'entrevista',
            'fuente',    COALESCE(de.participante, 'Sin nombre'),
            'cargo',     de.cargo,
            'fragmento', LEFT(COALESCE(de.transcripcion, ''), 300),
            'analisis',  de.analisis_ia,
            'duracion',  de.duracion_seg
          ))
          FROM diagnostico_entrevistas de
          WHERE de.diagnostico_id = $1
            AND (de.analisis_ia ILIKE '%' || p.elemento || '%'
              OR de.transcripcion ILIKE '%' || p.elemento || '%')
        ), '[]'::jsonb) AS evidencia_entrevistas,

        -- Evidencias de campo
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',        dr.id,
            'tipo',      'recorrido',
            'fuente',    COALESCE(dr.area, 'Sin área'),
            'categoria', dr.categoria,
            'fragmento', LEFT(COALESCE(dr.observacion, dr.hallazgo, ''), 300),
            'analisis',  dr.analisis_ia
          ))
          FROM diagnostico_recorrido dr
          WHERE dr.diagnostico_id = $1
            AND (dr.analisis_ia ILIKE '%' || p.elemento || '%'
              OR dr.observacion ILIKE '%' || p.elemento || '%')
        ), '[]'::jsonb) AS evidencia_campo,

        -- Validación HITL existente
        vh.calificacion_ia,
        vh.calificacion_humano,
        vh.criterio_profesional,
        vh.override_justificacion,
        vh.validado_en

      FROM preguntas p
      LEFT JOIN diagnostico_validaciones_hitl vh
        ON vh.diagnostico_id = $1 AND vh.pregunta_id = p.id

      WHERE p.complejidad = ANY($2)
      ORDER BY p.complejidad ASC, p.elemento ASC
    `, [diagId, complejidadesPermitidas]);

    res.json({
      diagnostico_id: diagId,
      nivel_complejidad: nivelFiltro,
      total_preguntas: preguntas.length,
      preguntas: preguntas.map(p => ({
        ...p,
        // Calcular sugerencia de IA basada en evidencias disponibles
        sugerencia_ia: calcularSugerenciaIA(p),
        // Contar evidencias por tipo
        conteo_evidencias: {
          documentos: (p.evidencia_documentos || []).length,
          entrevistas: (p.evidencia_entrevistas || []).length, 
          campo: (p.evidencia_campo || []).length,
          total: (p.evidencia_documentos || []).length + 
                 (p.evidencia_entrevistas || []).length + 
                 (p.evidencia_campo || []).length
        }
      }))
    });

  } catch (error) {
    console.error('[Fase5] Error obteniendo preguntas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/diagnosticos/:id/validate-fase5 - Validación HITL
app.post('/api/diagnosticos/:id/validate-fase5', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.id);
  const { 
    pregunta_id, 
    calificacion_humano, 
    criterio_profesional, 
    override_justificacion,
    evidencias_citadas 
  } = req.body;
  const validadorId = req.usuario.id;

  try {
    // Obtener calificación de IA existente
    const { rows: [pregunta] } = await pool.query(
      'SELECT elemento, pregunta FROM preguntas WHERE id = $1', [pregunta_id]
    );
    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    // Calcular calificación IA basada en evidencias
    const calificacionIA = await calcularCalificacionIA(diagId, pregunta_id);

    // Insertar o actualizar validación HITL
    const { rows: [validacion] } = await pool.query(`
      INSERT INTO diagnostico_validaciones_hitl 
        (diagnostico_id, pregunta_id, calificacion_ia, calificacion_humano, 
         criterio_profesional, override_justificacion, validado_por, evidencia_docs, 
         evidencia_entrev, evidencia_campo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (diagnostico_id, pregunta_id) DO UPDATE SET
        calificacion_humano = $4,
        criterio_profesional = $5, 
        override_justificacion = $6,
        validado_por = $7,
        validado_en = NOW(),
        evidencia_docs = $8,
        evidencia_entrev = $9,
        evidencia_campo = $10
      RETURNING *
    `, [
      diagId, pregunta_id, calificacionIA, calificacion_humano,
      criterio_profesional, override_justificacion, validadorId,
      JSON.stringify(evidencias_citadas?.documentos || []),
      JSON.stringify(evidencias_citadas?.entrevistas || []), 
      JSON.stringify(evidencias_citadas?.campo || [])
    ]);

    // Log de auditoría
    console.log(`[HITL] Usuario ${validadorId} validó pregunta ${pregunta_id} en diagnóstico ${diagId}: ${calificacionIA} → ${calificacion_humano}`);

    res.json({
      success: true,
      validacion: validacion,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Fase5] Error en validación HITL:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/diagnosticos/:id/evidencia/:tipo/:id - Obtener fragmento específico de evidencia
app.get('/api/diagnosticos/:diagId/evidencia/:tipo/:id', verificarToken, async (req, res) => {
  const { diagId, tipo, id } = req.params;
  
  try {
    let query, tabla;
    switch (tipo) {
      case 'documento':
        tabla = 'diagnostico_documentos';
        query = 'SELECT nombre_original, categoria, texto_extraido, analisis_ia, created_at FROM diagnostico_documentos WHERE id = $1 AND diagnostico_id = $2';
        break;
      case 'entrevista':  
        tabla = 'diagnostico_entrevistas';
        query = 'SELECT participante, cargo, transcripcion, analisis_ia, duracion_seg, created_at FROM diagnostico_entrevistas WHERE id = $1 AND diagnostico_id = $2';
        break;
      case 'recorrido':
        tabla = 'diagnostico_recorrido'; 
        query = 'SELECT area, categoria, observacion, hallazgo, analisis_ia, created_at FROM diagnostico_recorrido WHERE id = $1 AND diagnostico_id = $2';
        break;
      default:
        return res.status(400).json({ error: 'Tipo de evidencia no válido' });
    }

    const { rows: [evidencia] } = await pool.query(query, [id, diagId]);
    
    if (!evidencia) {
      return res.status(404).json({ error: 'Evidencia no encontrada' });
    }

    res.json({
      tipo,
      id,
      evidencia: evidencia
    });

  } catch (error) {
    console.error('[Fase5] Error obteniendo evidencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función auxiliar para calcular sugerencia de IA
function calcularSugerenciaIA(pregunta) {
  const evidencias = [
    ...(pregunta.evidencia_documentos || []),
    ...(pregunta.evidencia_entrevistas || []),
    ...(pregunta.evidencia_campo || [])
  ];
  
  if (evidencias.length === 0) return 'No hay evidencia';
  if (evidencias.length >= 3) return 'Suficiente';
  if (evidencias.length >= 2) return 'Escasa';
  return 'Al menos una';
}

// Función auxiliar para calcular calificación IA
async function calcularCalificacionIA(diagId, preguntaId) {
  try {
    // Lógica simplificada - en producción sería más sofisticada
    const { rows: evidencias } = await pool.query(`
      SELECT 
        COUNT(dd.id) as docs,
        COUNT(de.id) as entrevistas, 
        COUNT(dr.id) as campo
      FROM preguntas p
      LEFT JOIN diagnostico_documentos dd ON dd.diagnostico_id = $1 
        AND dd.analisis_ia ILIKE '%' || p.elemento || '%'
      LEFT JOIN diagnostico_entrevistas de ON de.diagnostico_id = $1
        AND de.analisis_ia ILIKE '%' || p.elemento || '%'  
      LEFT JOIN diagnostico_recorrido dr ON dr.diagnostico_id = $1
        AND dr.analisis_ia ILIKE '%' || p.elemento || '%'
      WHERE p.id = $2
      GROUP BY p.id
    `, [diagId, preguntaId]);
    
    const total = (evidencias[0]?.docs || 0) + (evidencias[0]?.entrevistas || 0) + (evidencias[0]?.campo || 0);
    
    if (total === 0) return 'No hay evidencia';
    if (total >= 3) return 'Suficiente';  
    if (total >= 2) return 'Escasa';
    return 'Al menos una';
    
  } catch (error) {
    console.error('[IA] Error calculando calificación:', error);
    return 'Error en cálculo';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 PLAN DE ACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/plan-accion — listar todos los ítems del tenant
app.get('/api/plan-accion', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const { estado, criticidad, diagnostico_id } = req.query;
    let where = ['1=1'];
    const params = [];
    if (tid) { params.push(tid); where.push(`pa.tenant_id = $${params.length}`); }
    if (estado) { params.push(estado); where.push(`pa.estado = $${params.length}`); }
    if (criticidad) { params.push(criticidad); where.push(`pa.criticidad = $${params.length}`); }
    if (diagnostico_id) { params.push(parseInt(diagnostico_id)); where.push(`pa.diagnostico_id = $${params.length}`); }

    const { rows } = await pool.query(`
      SELECT pa.*,
             u.nombre  AS creado_por_nombre,
             d.estado  AS diag_estado,
             p.nombre  AS planta_nombre
      FROM plan_accion_items pa
      LEFT JOIN usuarios  u ON u.id = pa.creado_por
      LEFT JOIN diagnosticos d ON d.id = pa.diagnostico_id
      LEFT JOIN plantas   p ON p.id = d.planta_id
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE pa.criticidad
          WHEN 'Crítico' THEN 1 WHEN 'Alto' THEN 2 WHEN 'Medio' THEN 3 ELSE 4
        END,
        pa.fecha_limite ASC NULLS LAST,
        pa.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/plan-accion — crear ítem manual
app.post('/api/plan-accion', verificarToken, async (req, res) => {
  const { nombre, descripcion, responsable, responsable_email, fecha_limite,
          criticidad, estado, diagnostico_id, origen_ia, plazo_ia, elemento_psm,
          notificaciones_activas } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  try {
    const tid = tenantScope(req);
    const { rows: [item] } = await pool.query(`
      INSERT INTO plan_accion_items
        (tenant_id, diagnostico_id, nombre, descripcion, responsable, responsable_email,
         fecha_limite, criticidad, estado, notificaciones_activas,
         origen_ia, plazo_ia, elemento_psm, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [tid, diagnostico_id || null, nombre.trim(), descripcion || null,
        responsable || null, responsable_email || null, fecha_limite || null,
        criticidad || 'Medio', estado || 'Pendiente', notificaciones_activas || false,
        origen_ia || false, plazo_ia || null, elemento_psm || null, req.usuario.id]);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/plan-accion/importar-ia/:diagId — importar plan_accion del análisis IA
app.post('/api/plan-accion/importar-ia/:diagId', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.diagId);
  try {
    const tid = tenantScope(req);
    const { rows: [diag] } = await pool.query(
      'SELECT analisis_final_ia, planta_id FROM diagnosticos WHERE id=$1', [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado.' });
    if (!diag.analisis_final_ia) return res.status(400).json({ error: 'El diagnóstico no tiene análisis IA generado.' });

    const analisis = typeof diag.analisis_final_ia === 'string'
      ? JSON.parse(diag.analisis_final_ia) : diag.analisis_final_ia;

    const planIA = analisis.plan_accion || [];
    const hallazgos = analisis.hallazgos_criticos || [];

    if (planIA.length === 0) return res.status(400).json({ error: 'El análisis IA no tiene plan de acción.' });

    // Mapear plazo a criticidad
    const plazoCriticidad = {
      'Inmediato': 'Crítico', '30 días': 'Alto', '90 días': 'Medio', '6 meses': 'Bajo'
    };

    const creados = [];
    for (const item of planIA) {
      const criticidad = plazoCriticidad[item.plazo] || 'Medio';
      // Buscar elemento PSM relacionado desde hallazgos
      const hallazgo = hallazgos.find((_, i) => i === (item.prioridad - 1));
      const { rows: [nuevo] } = await pool.query(`
        INSERT INTO plan_accion_items
          (tenant_id, diagnostico_id, nombre, descripcion, responsable, criticidad,
           estado, origen_ia, plazo_ia, elemento_psm, notificaciones_activas, creado_por)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [tid, diagId, `Acción ${item.prioridad}: ${item.accion?.substring(0, 80)}`,
          item.accion, item.responsable || null, criticidad,
          'Pendiente', true, item.plazo || null,
          hallazgo?.elemento || null, false, req.usuario.id]);
      creados.push(nuevo);
    }
    res.json({ importados: creados.length, items: creados });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/plan-accion/:id — actualizar ítem
app.patch('/api/plan-accion/:id', verificarToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, descripcion, responsable, responsable_email, fecha_limite,
          criticidad, estado, elemento_psm, notificaciones_activas } = req.body;
  try {
    const { rows: [item] } = await pool.query(`
      UPDATE plan_accion_items
      SET nombre=$1, descripcion=$2, responsable=$3, responsable_email=$4,
          fecha_limite=$5, criticidad=$6, estado=$7, elemento_psm=$8,
          notificaciones_activas=$9, updated_at=NOW()
      WHERE id=$10
      RETURNING *
    `, [nombre, descripcion || null, responsable || null, responsable_email || null,
        fecha_limite || null, criticidad, estado, elemento_psm || null,
        notificaciones_activas ?? false, id]);
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado.' });
    // Si se desactivaron notificaciones, limpiar log para reenviar cuando se reactive
    if (!notificaciones_activas) {
      await pool.query('DELETE FROM plan_accion_notif_log WHERE item_id=$1', [id]).catch(() => {});
    }
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/plan-accion/notificaciones/enviar — ejecutar ciclo de notificaciones manualmente
app.post('/api/plan-accion/notificaciones/enviar', verificarToken, async (req, res) => {
  try {
    const resultado = await ejecutarNotificaciones();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/plan-accion/:id — eliminar ítem
app.delete('/api/plan-accion/:id', verificarToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM plan_accion_items WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/plan-accion/diagnosticos-finalizados — lista de diags con análisis IA para importar
app.get('/api/plan-accion/diagnosticos-finalizados', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const { rows } = await pool.query(`
      SELECT d.id, d.estado, d.nivel_calculado, d.analisis_generado_en,
             d.analisis_final_ia,
             p.nombre AS planta_nombre, a.nombre AS area_nombre
      FROM diagnosticos d
      LEFT JOIN plantas p ON p.id = d.planta_id
      LEFT JOIN areas   a ON a.id = d.area_id
      WHERE d.estado IN ('Finalizado','Aprobado')
        AND d.analisis_final_ia IS NOT NULL
        ${tid ? 'AND d.tenant_id = $1' : ''}
      ORDER BY d.analisis_generado_en DESC NULLS LAST
    `, tid ? [tid] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 ANÁLISIS FINAL IA + CIERRE DE DIAGNÓSTICO
// POST /api/diagnosticos/:id/finalizar  → genera análisis IA y cierra el diagnóstico
// GET  /api/diagnosticos/:id/analisis   → devuelve análisis IA ya guardado
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/diagnosticos/:id/analisis', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.id);
  try {
    const { rows: [diag] } = await pool.query(
      `SELECT id, estado, nivel_calculado, analisis_final_ia, analisis_generado_en,
              planta_nombre, area_nombre
       FROM diagnosticos d
       LEFT JOIN plantas p ON p.id = d.planta_id
       LEFT JOIN areas   a ON a.id = d.area_id
       WHERE d.id = $1`, [diagId]
    );
    if (!diag) return res.status(404).json({ error: 'No encontrado' });
    res.json({ analisis: diag.analisis_final_ia || null, generado_en: diag.analisis_generado_en });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diagnosticos/:id/finalizar', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.id);
  try {
    // ── Recopilar todo el contexto del diagnóstico ─────────────────────────
    const { rows: [diag] } = await pool.query(`
      SELECT d.*, p.nombre AS planta_nombre, a.nombre AS area_nombre,
             t.nombre AS empresa_nombre
      FROM diagnosticos d
      LEFT JOIN plantas  p ON p.id = d.planta_id
      LEFT JOIN areas    a ON a.id = d.area_id
      LEFT JOIN tenants  t ON t.id = d.tenant_id
      WHERE d.id = $1
    `, [diagId]);
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });

    // Preguntas con validaciones HITL
    const { rows: preguntas } = await pool.query(`
      SELECT p.elemento, p.pregunta, p.complejidad,
             dr.respuesta, dr.comentario,
             vh.calificacion_humano, vh.calificacion_ia, vh.criterio_profesional
      FROM preguntas p
      LEFT JOIN diagnostico_respuestas dr ON dr.pregunta_id = p.id AND dr.diagnostico_id = $1
      LEFT JOIN diagnostico_validaciones_hitl vh ON vh.pregunta_id = p.id AND vh.diagnostico_id = $1
      ORDER BY p.complejidad, p.elemento
    `, [diagId]);

    // No conformidades
    const noConf = preguntas.filter(p => {
      const cal = p.calificacion_humano || p.calificacion_ia || p.respuesta;
      return ['Al menos una', 'No hay evidencia', 'No evidencia'].includes(cal);
    });

    // Resumen cuantitativo
    const total     = preguntas.length;
    const cumple    = preguntas.filter(p => (p.calificacion_humano || p.calificacion_ia) === 'Suficiente').length;
    const parcial   = preguntas.filter(p => (p.calificacion_humano || p.calificacion_ia) === 'Escasa').length;
    const nocumple  = noConf.length;
    const puntaje   = total > 0 ? Math.round(((cumple + parcial * 0.5) / total) * 100) : 0;

    // Agrupar no conformidades por elemento
    const porElemento = {};
    noConf.forEach(p => {
      if (!porElemento[p.elemento]) porElemento[p.elemento] = [];
      porElemento[p.elemento].push(`- ${p.pregunta}${p.criterio_profesional ? ` [Criterio: ${p.criterio_profesional}]` : ''}`);
    });
    const noConfResumen = Object.entries(porElemento)
      .map(([el, items]) => `**${el}** (${items.length} no conformidades):\n${items.slice(0,5).join('\n')}`)
      .join('\n\n');

    const prompt = `Actúa como Auditor Senior en Seguridad de Procesos (PSM) bajo Decreto 1347 de 2021 (Colombia) y los 20 elementos CCPS.

DATOS DEL DIAGNÓSTICO:
- Empresa: ${diag.empresa_nombre || 'No especificada'}
- Planta: ${diag.planta_nombre || 'No especificada'} / Área: ${diag.area_nombre || 'No especificada'}
- Nivel de Complejidad: ${diag.nivel_calculado || 'No calculado'}
- Total preguntas evaluadas: ${total}
- Cumple (Suficiente): ${cumple} (${total > 0 ? Math.round(cumple/total*100) : 0}%)
- Cumple Parcial (Escasa): ${parcial} (${total > 0 ? Math.round(parcial/total*100) : 0}%)
- No Cumple: ${nocumple} (${total > 0 ? Math.round(nocumple/total*100) : 0}%)
- Puntaje global: ${puntaje}%

NO CONFORMIDADES IDENTIFICADAS (${nocumple} total, agrupadas por elemento PSM):
${noConfResumen || 'Ninguna no conformidad registrada.'}

INSTRUCCIÓN: Genera un análisis ejecutivo profesional en español con los siguientes bloques:

1. **DIAGNÓSTICO GENERAL**: Párrafo de 3-4 oraciones sobre el estado de madurez PSM de la organización basado en el puntaje (${puntaje}%).

2. **HALLAZGOS CRÍTICOS**: Lista de los 3-5 elementos PSM más críticos identificados, con su nivel de riesgo (Alto/Medio/Bajo) y descripción del impacto.

3. **BRECHAS NORMATIVAS**: Lista de los incumplimientos específicos del Decreto 1347/2021 y Resolución 5492/2024 detectados.

4. **FORTALEZAS IDENTIFICADAS**: 2-3 áreas donde la organización demuestra buen nivel de cumplimiento.

5. **PLAN DE ACCIÓN PRIORITARIO**: Los 5 pasos más urgentes que la organización debe tomar, ordenados por prioridad, con plazo sugerido (inmediato/30 días/90 días/6 meses).

6. **CONCLUSIÓN**: Párrafo de cierre con la calificación general del diagnóstico.

Responde SOLO en JSON con esta estructura exacta:
{
  "diagnostico_general": "texto...",
  "hallazgos_criticos": [{"elemento": "...", "riesgo": "Alto|Medio|Bajo", "descripcion": "...", "impacto": "..."}],
  "brechas_normativas": ["texto brecha 1", "texto brecha 2"],
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "plan_accion": [{"prioridad": 1, "accion": "...", "plazo": "Inmediato|30 días|90 días|6 meses", "responsable": "..."}],
  "conclusion": "texto...",
  "puntaje_global": ${puntaje},
  "nivel_riesgo_general": "Alto|Medio|Bajo|Crítico"
}`;

    const raw = await geminiAnalizar(prompt);
    let analisis;
    try {
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      analisis = JSON.parse(m?.[0] ?? clean);
    } catch {
      analisis = {
        diagnostico_general: raw,
        hallazgos_criticos: [],
        brechas_normativas: [],
        fortalezas: [],
        plan_accion: [],
        conclusion: '',
        puntaje_global: puntaje,
        nivel_riesgo_general: puntaje >= 75 ? 'Bajo' : puntaje >= 50 ? 'Medio' : 'Alto',
      };
    }

    // Persistir análisis y cambiar estado a Finalizado
    await pool.query(`
      ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS analisis_final_ia JSONB
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS analisis_generado_en TIMESTAMP
    `).catch(() => {});

    await pool.query(`
      UPDATE diagnosticos
      SET estado = 'Finalizado',
          analisis_final_ia = $1,
          analisis_generado_en = NOW(),
          updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(analisis), diagId]);

    console.log(`[FINALIZAR] Diagnóstico #${diagId} finalizado — puntaje ${puntaje}%`);
    res.json({ success: true, analisis, puntaje });

  } catch (err) {
    console.error('[FINALIZAR] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 GENERACIÓN DE DOCUMENTO DE DIAGNÓSTICO (Word / PDF)
// GET /api/diagnosticos/:id/reporte
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/diagnosticos/:id/reporte', verificarToken, async (req, res) => {
  const diagId = parseInt(req.params.id);
  try {
    // ── 1. Datos del diagnóstico ───────────────────────────────────────────
    const { rows: [diag] } = await pool.query(`
      SELECT d.*, p.nombre AS planta_nombre, a.nombre AS area_nombre,
             u.nombre AS creado_por_nombre, u.email AS creado_por_email,
             t.nombre AS empresa_nombre, t.nit
      FROM diagnosticos d
      LEFT JOIN plantas p ON p.id = d.planta_id
      LEFT JOIN areas   a ON a.id = d.area_id
      LEFT JOIN usuarios u ON u.id = d.consultor_id
      LEFT JOIN tenants  t ON t.id = d.tenant_id
      WHERE d.id = $1
    `, [diagId]);
    if (!diag) return res.status(404).json({ error: 'Diagnóstico no encontrado' });

    // ── 2. Preguntas con respuestas y validaciones HITL ───────────────────
    const { rows: preguntas } = await pool.query(`
      SELECT
        p.id, p.complejidad, p.elemento, p.pregunta,
        p.evidencia_suficiente, p.evidencia_escasa, p.evidencia_al_menos, p.evidencia_no_evidencia,
        dr.respuesta, dr.comentario,
        vh.calificacion_ia, vh.calificacion_humano, vh.criterio_profesional,
        vh.override_justificacion, vh.validado_en
      FROM preguntas p
      LEFT JOIN diagnostico_respuestas dr ON dr.pregunta_id = p.id AND dr.diagnostico_id = $1
      LEFT JOIN diagnostico_validaciones_hitl vh ON vh.pregunta_id = p.id AND vh.diagnostico_id = $1
      ORDER BY p.complejidad ASC, p.elemento ASC, p.id ASC
    `, [diagId]);

    // ── 3. Calcular métricas de no conformidades ──────────────────────────
    const calMap = { 'Suficiente': 'Cumple', 'Escasa': 'Cumple Parcial', 'Al menos una': 'No Cumple', 'No hay evidencia': 'No Cumple' };
    const total       = preguntas.length;
    const cumple      = preguntas.filter(p => (p.calificacion_humano || p.calificacion_ia) === 'Suficiente').length;
    const parcial     = preguntas.filter(p => (p.calificacion_humano || p.calificacion_ia) === 'Escasa').length;
    const noConforme  = preguntas.filter(p => ['Al menos una','No hay evidencia'].includes(p.calificacion_humano || p.calificacion_ia)).length;
    const sinValidar  = preguntas.filter(p => !p.calificacion_humano && !p.calificacion_ia).length;
    const puntaje     = total > 0 ? Math.round(((cumple + parcial * 0.5) / total) * 100) : 0;

    // ── 4. Agrupar no conformidades por elemento PSM ───────────────────────
    const noConformesMap = {};
    preguntas.forEach(p => {
      const cal = p.calificacion_humano || p.calificacion_ia || '';
      if (['Al menos una','No hay evidencia'].includes(cal) || p.respuesta === 'No evidencia') {
        if (!noConformesMap[p.elemento]) noConformesMap[p.elemento] = [];
        noConformesMap[p.elemento].push(p);
      }
    });

    const fechaDoc = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });

    // ── 5. Helpers de formato ──────────────────────────────────────────────
    const texto = (t, opts = {}) => new TextRun({ text: String(t || ''), ...opts });
    const parrafo = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts });
    const espacio = () => parrafo('');

    const celda = (content, opts = {}) => new TableCell({
      children: [parrafo(content, { alignment: AlignmentType.LEFT })],
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        left:   { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        right:  { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      },
    });

    const celdaHeader = (text, width) => new TableCell({
      children: [parrafo(texto(text, { bold: true, size: 18, color: 'FFFFFF' }))],
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.SOLID, color: '1B5E20' },
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 1, color: '1B5E20' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '1B5E20' },
        left:   { style: BorderStyle.SINGLE, size: 1, color: '1B5E20' },
        right:  { style: BorderStyle.SINGLE, size: 1, color: '1B5E20' },
      },
    });

    const badgeCal = (cal) => {
      const color = {
        'Suficiente':    '2E7D32',
        'Escasa':        'F57F17',
        'Al menos una':  'E65100',
        'No hay evidencia': 'B71C1C',
      }[cal] || '757575';
      return texto(cal || 'Sin calificar', { color, bold: true, size: 18 });
    };

    // ── 6. Construir tabla completa de 188 preguntas ───────────────────────
    const filasPreguntas = preguntas.map((p, idx) => {
      const calFinal  = p.calificacion_humano || p.calificacion_ia || 'Sin calificar';
      const respuesta = p.respuesta || '—';
      const criterio  = p.criterio_profesional || p.comentario || '—';
      const rowShading = ['Al menos una','No hay evidencia'].includes(calFinal) ? 'FFF3E0' : 'FFFFFF';

      return new TableRow({
        children: [
          celda(texto(String(idx + 1), { size: 16 }), { width: 4, shading: rowShading }),
          celda(texto(p.elemento || '—', { size: 16 }), { width: 14, shading: rowShading }),
          celda(texto(p.pregunta || '—', { size: 16 }), { width: 40, shading: rowShading }),
          new TableCell({
            children: [parrafo(badgeCal(calFinal))],
            width: { size: 14, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: rowShading },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              left:   { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              right:  { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
            },
          }),
          celda(texto(criterio, { size: 15, italics: criterio === '—' }), { width: 28, shading: rowShading }),
        ],
      });
    });

    // ── 7. Sección de no conformidades agrupadas por elemento ─────────────
    const seccionNoConformes = [];
    Object.entries(noConformesMap).forEach(([elemento, items]) => {
      seccionNoConformes.push(
        parrafo(texto(`Elemento: ${elemento}`, { bold: true, size: 22, color: 'B71C1C' }), { spacing: { before: 300, after: 100 } })
      );
      items.forEach((item, i) => {
        const cal = item.calificacion_humano || item.calificacion_ia || 'Sin calificar';
        seccionNoConformes.push(
          parrafo([
            texto(`  ${i + 1}. `, { bold: true, size: 18 }),
            texto(item.pregunta || '—', { size: 18 }),
          ], { spacing: { after: 80 } })
        );
        seccionNoConformes.push(
          parrafo([
            texto('     Calificación: ', { bold: true, size: 17 }),
            badgeCal(cal),
          ], { spacing: { after: 60 } })
        );
        if (item.criterio_profesional) {
          seccionNoConformes.push(
            parrafo([
              texto('     Criterio Experto: ', { bold: true, size: 17, color: '1565C0' }),
              texto(item.criterio_profesional, { size: 17, color: '1565C0' }),
            ], { spacing: { after: 120 } })
          );
        }
      });
    });

    // ── 8. Construir documento completo ───────────────────────────────────
    const doc = new Document({
      numbering: { config: [] },
      sections: [{
        properties: {},
        headers: {
          default: new Header({
            children: [
              parrafo([
                texto('SKUDO PSM Expert System  |  ', { size: 16, color: '888888' }),
                texto(`Diagnóstico #${diagId}  |  ${diag.empresa_nombre || ''}`, { size: 16, color: '888888' }),
              ], { alignment: AlignmentType.RIGHT }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              parrafo([
                texto('Documento generado el ' + fechaDoc + '  —  Confidencial', { size: 15, color: 'AAAAAA' }),
              ], { alignment: AlignmentType.CENTER }),
            ],
          }),
        },
        children: [
          // ── PORTADA ────────────────────────────────────────────────────
          parrafo(texto('INFORME DE DIAGNÓSTICO PSM', { bold: true, size: 56, color: '1B5E20' }), {
            heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 200 },
          }),
          parrafo(texto('Gestión de Seguridad de Procesos — Decreto 1347 de 2021', { size: 28, color: '555555' }), {
            alignment: AlignmentType.CENTER, spacing: { after: 600 },
          }),

          // Tabla de datos del diagnóstico
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [
                celdaHeader('Campo', 30), celdaHeader('Información', 70),
              ]}),
              new TableRow({ children: [ celda(texto('Empresa', { bold: true })), celda(texto(diag.empresa_nombre || '—')) ]}),
              new TableRow({ children: [ celda(texto('NIT', { bold: true })), celda(texto(diag.nit || '—')) ]}),
              new TableRow({ children: [ celda(texto('Planta', { bold: true })), celda(texto(diag.planta_nombre || '—')) ]}),
              new TableRow({ children: [ celda(texto('Área', { bold: true })), celda(texto(diag.area_nombre || '—')) ]}),
              new TableRow({ children: [ celda(texto('Nivel de Complejidad', { bold: true })), celda(texto(diag.nivel_calculado || '—')) ]}),
              new TableRow({ children: [ celda(texto('Estado', { bold: true })), celda(texto(diag.estado || '—')) ]}),
              new TableRow({ children: [ celda(texto('Elaborado por', { bold: true })), celda(texto(diag.creado_por_nombre || '—')) ]}),
              new TableRow({ children: [ celda(texto('Fecha de Reporte', { bold: true })), celda(texto(fechaDoc)) ]}),
            ],
          }),

          espacio(),
          parrafo(new PageBreak()),

          // ── RESUMEN EJECUTIVO ──────────────────────────────────────────
          parrafo(texto('1. Resumen Ejecutivo', { bold: true, size: 36, color: '1B5E20' }), {
            heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [
                celdaHeader('Indicador', 50), celdaHeader('Valor', 50),
              ]}),
              new TableRow({ children: [ celda(texto('Total de preguntas evaluadas', { bold: true })), celda(texto(String(total))) ]}),
              new TableRow({ children: [ celda(texto('Cumple (Suficiente)', { bold: true, color: '2E7D32' })), celda(texto(`${cumple}  (${total > 0 ? Math.round(cumple/total*100) : 0}%)`)) ]}),
              new TableRow({ children: [ celda(texto('Cumple Parcial (Escasa)', { bold: true, color: 'F57F17' })), celda(texto(`${parcial}  (${total > 0 ? Math.round(parcial/total*100) : 0}%)`)) ]}),
              new TableRow({ children: [ celda(texto('No Cumple', { bold: true, color: 'B71C1C' })), celda(texto(`${noConforme}  (${total > 0 ? Math.round(noConforme/total*100) : 0}%)`)) ]}),
              new TableRow({ children: [ celda(texto('Sin Validar', { bold: true, color: '757575' })), celda(texto(String(sinValidar))) ]}),
              new TableRow({ children: [ celda(texto('Puntaje Global de Cumplimiento', { bold: true })), celda(texto(`${puntaje}%`, { bold: true, size: 22, color: puntaje >= 75 ? '2E7D32' : puntaje >= 50 ? 'F57F17' : 'B71C1C' })) ]}),
            ],
          }),

          espacio(),
          parrafo(texto('Síntesis Ejecutiva', { bold: true, size: 24 }), { spacing: { before: 200, after: 100 } }),
          parrafo(
            texto(`El diagnóstico PSM de ${diag.empresa_nombre || 'la empresa'} (${diag.planta_nombre || 'planta no especificada'}) ` +
              `registra un puntaje global de cumplimiento del ${puntaje}%. Se identificaron ${noConforme} no conformidades ` +
              `sobre un total de ${total} requisitos evaluados, distribuidas en ${Object.keys(noConformesMap).length} elementos PSM. ` +
              `Se requiere un plan de acción para cerrar las brechas identificadas antes de la próxima evaluación.`,
              { size: 20 }),
            { spacing: { after: 200 } }
          ),

          espacio(),
          parrafo(new PageBreak()),

          // ── NO CONFORMIDADES DETALLADAS ────────────────────────────────
          parrafo(texto('2. No Conformidades Identificadas', { bold: true, size: 36, color: 'B71C1C' }), {
            heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 },
          }),
          parrafo(texto(`Se identificaron ${noConforme} no conformidades agrupadas por Elemento PSM:`, { size: 20 }), { spacing: { after: 200 } }),

          Object.keys(noConformesMap).length === 0
            ? parrafo(texto('✓ No se registraron no conformidades en este diagnóstico.', { color: '2E7D32', size: 22, bold: true }))
            : new Paragraph({}),  // placeholder que se reemplaza abajo
          ...seccionNoConformes,

          espacio(),
          parrafo(new PageBreak()),

          // ── MATRIZ COMPLETA DE 188 PREGUNTAS ──────────────────────────
          parrafo(texto('3. Matriz Completa de Evaluación PSM', { bold: true, size: 36, color: '1B5E20' }), {
            heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 },
          }),
          parrafo(texto(`Total de preguntas evaluadas: ${total} | Decreto 1347 de 2021 — Colombia`, { size: 18, color: '555555' }), {
            spacing: { after: 300 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  celdaHeader('#',   4),
                  celdaHeader('Elemento PSM', 14),
                  celdaHeader('Pregunta Normativa', 40),
                  celdaHeader('Calificación', 14),
                  celdaHeader('Criterio / Comentario', 28),
                ],
              }),
              ...filasPreguntas,
            ],
          }),

          espacio(),
          parrafo(new PageBreak()),

          // ── FIRMA ────────────────────────────────────────────────────
          parrafo(texto('4. Declaración y Firma', { bold: true, size: 36, color: '1B5E20' }), {
            heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 400 },
          }),
          parrafo(
            texto(`El presente informe fue elaborado con base en la metodología CCPS y los requisitos del ` +
              `Decreto 1347 de 2021 y la Resolución 5492. El diagnóstico fue conducido por ${diag.creado_por_nombre || 'el consultor asignado'} ` +
              `y los resultados reflejan el estado de cumplimiento a la fecha ${fechaDoc}.`,
              { size: 20 }),
            { spacing: { after: 600 } }
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [
                celda(texto('Consultor Responsable', { bold: true })),
                celda(texto('Firma'), {}),
                celda(texto('Fecha', { bold: true })),
              ]}),
              new TableRow({ children: [
                celda(texto(diag.creado_por_nombre || '____________________')),
                celda(texto('____________________')),
                celda(texto(fechaDoc)),
              ]}),
            ],
          }),
        ],
      }],
    });

    // ── 9. Serializar y enviar ─────────────────────────────────────────────
    const buffer = await Packer.toBuffer(doc);
    const filename = `Diagnostico_PSM_${diagId}_${new Date().toISOString().slice(0,10)}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    console.log(`[REPORTE] Documento generado: ${filename} (${buffer.length} bytes)`);

  } catch (err) {
    console.error('[REPORTE] Error generando documento:', err.message);
    res.status(500).json({ error: `Error al generar el reporte: ${err.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 DASHBOARD — RADAR DE MADUREZ PSM
// GET /api/dashboard/madurez — puntaje por elemento PSM del último diagnóstico
app.get('/api/dashboard/madurez', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const { planta_id } = req.query;

    // Buscar el diagnóstico más reciente finalizado (o el último con respuestas)
    let diagQuery = `
      SELECT d.id, d.nivel_calculado, d.analisis_final_ia,
             p.nombre AS planta_nombre, a.nombre AS area_nombre
      FROM diagnosticos d
      LEFT JOIN plantas p ON p.id = d.planta_id
      LEFT JOIN areas   a ON a.id = d.area_id
      WHERE 1=1
        ${tid      ? 'AND d.tenant_id = $1'  : ''}
        ${planta_id ? `AND d.planta_id = $${tid ? 2 : 1}` : ''}
      ORDER BY
        CASE WHEN d.estado IN ('Finalizado','Aprobado') THEN 0 ELSE 1 END,
        d.updated_at DESC
      LIMIT 1
    `;
    const diagParams = [tid, planta_id].filter(Boolean);
    const { rows: [diag] } = await pool.query(diagQuery, diagParams);

    // Calcular puntajes por elemento PSM desde respuestas
    let elementosPuntaje = [];
    if (diag) {
      // Puntajes desde validaciones HITL (más precisos)
      const { rows: hitl } = await pool.query(`
        SELECT p.elemento,
               COUNT(*) AS total,
               SUM(CASE WHEN COALESCE(vh.calificacion_humano, vh.calificacion_ia) = 'Suficiente'    THEN 3
                        WHEN COALESCE(vh.calificacion_humano, vh.calificacion_ia) = 'Escasa'         THEN 2
                        WHEN COALESCE(vh.calificacion_humano, vh.calificacion_ia) = 'Al menos una'   THEN 1
                        ELSE 0 END) AS puntos
        FROM preguntas p
        LEFT JOIN diagnostico_validaciones_hitl vh
          ON vh.pregunta_id = p.id AND vh.diagnostico_id = $1
        WHERE p.elemento IS NOT NULL AND p.elemento != ''
        GROUP BY p.elemento
        ORDER BY p.elemento
      `, [diag.id]);

      if (hitl.length > 0) {
        elementosPuntaje = hitl.map(r => ({
          elemento: r.elemento,
          puntaje:  r.total > 0 ? Math.round((r.puntos / (r.total * 3)) * 100) : 0,
          total:    parseInt(r.total),
          puntos:   parseInt(r.puntos),
        }));
      } else {
        // Fallback: desde respuestas del cuestionario
        const { rows: resp } = await pool.query(`
          SELECT p.elemento,
                 COUNT(*) AS total,
                 SUM(CASE WHEN dr.respuesta = 'Suficiente'  THEN 3
                          WHEN dr.respuesta = 'Escasa'       THEN 2
                          WHEN dr.respuesta = 'Al menos una' THEN 1
                          ELSE 0 END) AS puntos
          FROM preguntas p
          LEFT JOIN diagnostico_respuestas dr
            ON dr.pregunta_id = p.id AND dr.diagnostico_id = $1
          WHERE p.elemento IS NOT NULL AND p.elemento != ''
          GROUP BY p.elemento
          ORDER BY p.elemento
        `, [diag.id]);

        elementosPuntaje = resp.map(r => ({
          elemento: r.elemento,
          puntaje:  r.total > 0 ? Math.round((r.puntos / (r.total * 3)) * 100) : 0,
          total:    parseInt(r.total),
          puntos:   parseInt(r.puntos),
        }));
      }
    }

    // Si no hay datos de diagnóstico, devolver elementos PSM con puntaje 0
    if (elementosPuntaje.length === 0) {
      const { rows: elementos } = await pool.query(
        `SELECT DISTINCT elemento FROM preguntas
         WHERE elemento IS NOT NULL AND elemento != ''
         ORDER BY elemento`
      );
      elementosPuntaje = elementos.map(e => ({ elemento: e.elemento, puntaje: 0, total: 0, puntos: 0 }));
    }

    // Calcular índice global de madurez
    const totalPuntos  = elementosPuntaje.reduce((s, e) => s + e.puntos, 0);
    const maxPosible   = elementosPuntaje.reduce((s, e) => s + e.total * 3, 0);
    const madurezGlobal = maxPosible > 0 ? Math.round((totalPuntos / maxPosible) * 100) : 0;

    // Nivel de madurez semántico
    const nivelMadurez =
      madurezGlobal >= 80 ? 'Optimizado'   :
      madurezGlobal >= 60 ? 'Gestionado'   :
      madurezGlobal >= 40 ? 'Definido'     :
      madurezGlobal >= 20 ? 'En Desarrollo':
                            'Inicial';

    res.json({
      diagnostico_id:  diag?.id || null,
      planta:          diag?.planta_nombre || null,
      area:            diag?.area_nombre   || null,
      nivel_calculado: diag?.nivel_calculado || null,
      madurez_global:  madurezGlobal,
      nivel_madurez:   nivelMadurez,
      elementos:       elementosPuntaje,
      total_elementos: elementosPuntaje.length,
    });
  } catch (err) {
    console.error('ERROR EN [/api/dashboard/madurez]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/stats — contadores rápidos para el dashboard
app.get('/api/dashboard/stats', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const p   = tid ? [tid] : [];
    const w   = tid ? 'WHERE tenant_id = $1' : '';

    const [diags, acciones, pronosticos] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE estado IN ('Finalizado','Aprobado')) AS finalizados,
        COUNT(*) FILTER (WHERE estado NOT IN ('Finalizado','Aprobado')) AS en_curso
        FROM diagnosticos ${w}`, p),
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE criticidad = 'Crítico' AND estado NOT IN ('Completado','Cancelado')) AS criticas_pendientes,
        COUNT(*) FILTER (WHERE estado = 'Completado') AS completadas
        FROM plan_accion_items ${w}`, p),
      pool.query(`SELECT COUNT(*) AS total FROM pronosticos ${w}`, p),
    ]);

    res.json({
      diagnosticos: {
        finalizados: parseInt(diags.rows[0].finalizados),
        en_curso:    parseInt(diags.rows[0].en_curso),
      },
      acciones: {
        total:             parseInt(acciones.rows[0].total),
        criticas_pendientes: parseInt(acciones.rows[0].criticas_pendientes),
        completadas:       parseInt(acciones.rows[0].completadas),
      },
      pronosticos: parseInt(pronosticos.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔮 PRONÓSTICO — GEMELO DIGITAL (Digital Twin)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/pronostico — listar pronósticos generados
app.get('/api/pronostico', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);
    const { rows } = await pool.query(`
      SELECT pr.id, pr.nombre, pr.created_at,
             u.nombre AS generado_por_nombre,
             pr.analisis_ia->'resumen_ejecutivo' AS resumen,
             pr.analisis_ia->'indice_riesgo_global' AS indice_riesgo,
             pr.analisis_ia->'nivel_alerta' AS nivel_alerta,
             jsonb_array_length(COALESCE(pr.acciones_base, '[]'::jsonb)) AS total_acciones
      FROM pronosticos pr
      LEFT JOIN usuarios u ON u.id = pr.generado_por
      ${tid ? 'WHERE pr.tenant_id = $1' : ''}
      ORDER BY pr.created_at DESC
      LIMIT 20
    `, tid ? [tid] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/pronostico/:id — detalle completo
app.get('/api/pronostico/:id', verificarToken, async (req, res) => {
  try {
    const { rows: [pr] } = await pool.query(
      'SELECT * FROM pronosticos WHERE id = $1', [parseInt(req.params.id)]
    );
    if (!pr) return res.status(404).json({ error: 'Pronóstico no encontrado.' });
    res.json(pr);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/pronostico/:id
app.delete('/api/pronostico/:id', verificarToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM pronosticos WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pronostico/generar — genera análisis IA del gemelo digital
app.post('/api/pronostico/generar', verificarToken, async (req, res) => {
  try {
    const tid = tenantScope(req);

    // ── 1. Recopilar acciones del plan ───────────────────────────────────
    const { rows: acciones } = await pool.query(`
      SELECT pa.id, pa.nombre, pa.descripcion, pa.responsable, pa.fecha_limite,
             pa.criticidad, pa.estado, pa.elemento_psm, pa.plazo_ia, pa.origen_ia,
             p.nombre AS planta_nombre
      FROM plan_accion_items pa
      LEFT JOIN diagnosticos d ON d.id = pa.diagnostico_id
      LEFT JOIN plantas       p ON p.id = d.planta_id
      WHERE pa.estado NOT IN ('Completado','Cancelado')
        ${tid ? 'AND pa.tenant_id = $1' : ''}
      ORDER BY
        CASE pa.criticidad WHEN 'Crítico' THEN 1 WHEN 'Alto' THEN 2
          WHEN 'Medio' THEN 3 ELSE 4 END,
        pa.fecha_limite ASC NULLS LAST
    `, tid ? [tid] : []);

    // ── 2. Recopilar último análisis de diagnóstico ───────────────────────
    const { rows: [ultimoDiag] } = await pool.query(`
      SELECT d.nivel_calculado, d.analisis_final_ia,
             p.nombre AS planta_nombre, a.nombre AS area_nombre,
             t.nombre AS empresa_nombre
      FROM diagnosticos d
      LEFT JOIN plantas p ON p.id = d.planta_id
      LEFT JOIN areas   a ON a.id = d.area_id
      LEFT JOIN tenants t ON t.id = d.tenant_id
      WHERE d.estado IN ('Finalizado','Aprobado')
        AND d.analisis_final_ia IS NOT NULL
        ${tid ? 'AND d.tenant_id = $1' : ''}
      ORDER BY d.analisis_generado_en DESC NULLS LAST
      LIMIT 1
    `, tid ? [tid] : []);

    if (acciones.length === 0) {
      return res.status(400).json({ error: 'No hay acciones pendientes en el Plan de Acción para generar un pronóstico.' });
    }

    // ── 3. Preparar contexto para la IA ──────────────────────────────────
    const hoy       = new Date();
    const empresa   = ultimoDiag?.empresa_nombre || 'la organización';
    const planta    = ultimoDiag?.planta_nombre  || 'la instalación';
    const nivelDiag = ultimoDiag?.nivel_calculado || 'No determinado';

    const accionesPorCriticidad = {
      Crítico: acciones.filter(a => a.criticidad === 'Crítico'),
      Alto:    acciones.filter(a => a.criticidad === 'Alto'),
      Medio:   acciones.filter(a => a.criticidad === 'Medio'),
      Bajo:    acciones.filter(a => a.criticidad === 'Bajo'),
    };

    const formatAcciones = (arr) => arr.map(a => {
      const diasRestantes = a.fecha_limite
        ? Math.ceil((new Date(a.fecha_limite) - hoy) / 86400000)
        : null;
      const vencido = diasRestantes !== null && diasRestantes < 0;
      return `• [${a.criticidad}] ${a.nombre}
        Elemento PSM: ${a.elemento_psm || 'No especificado'}
        Responsable: ${a.responsable || 'Sin asignar'}
        Fecha límite: ${a.fecha_limite ? new Date(a.fecha_limite).toLocaleDateString('es-CO') : 'Sin fecha'}
        Días restantes: ${diasRestantes !== null ? (vencido ? `VENCIDA hace ${Math.abs(diasRestantes)} días` : `${diasRestantes} días`) : 'Sin plazo'}
        Estado: ${a.estado}`;
    }).join('\n\n');

    const contextoAcciones = `
ACCIONES CRÍTICAS (${accionesPorCriticidad.Crítico.length}):
${formatAcciones(accionesPorCriticidad.Crítico) || 'Ninguna'}

ACCIONES ALTAS (${accionesPorCriticidad.Alto.length}):
${formatAcciones(accionesPorCriticidad.Alto) || 'Ninguna'}

ACCIONES MEDIAS (${accionesPorCriticidad.Medio.length}):
${formatAcciones(accionesPorCriticidad.Medio) || 'Ninguna'}

ACCIONES BAJAS (${accionesPorCriticidad.Bajo.length}):
${formatAcciones(accionesPorCriticidad.Bajo) || 'Ninguna'}`;

    const contextoIA = ultimoDiag?.analisis_final_ia
      ? `\nHallazgos del último diagnóstico (nivel ${nivelDiag}):\n${
          (ultimoDiag.analisis_final_ia.hallazgos_criticos || [])
            .map(h => `- [${h.riesgo}] ${h.elemento}: ${h.descripcion}`).join('\n')
        }\nBrechas normativas: ${(ultimoDiag.analisis_final_ia.brechas_normativas || []).join('; ')}`
      : '';

    const prompt = `Eres un Experto Senior en Seguridad de Procesos (PSM) y Análisis de Riesgos bajo el Decreto 1347 de 2021 (Colombia), con expertise en modelado de escenarios de accidentes mayores, análisis de fallas tipo HAZOP/LOPA y consecuencias.

ORGANIZACIÓN: ${empresa}
INSTALACIÓN: ${planta}
NIVEL DE MADUREZ PSM: ${nivelDiag}
FECHA DE ANÁLISIS: ${hoy.toLocaleDateString('es-CO')}

ACCIONES CORRECTIVAS PENDIENTES EN EL PLAN DE ACCIÓN:
${contextoAcciones}
${contextoIA}

MISIÓN: Actúa como el "Gemelo Digital" de esta instalación industrial. Simula qué ocurriría si las acciones correctivas NO son cumplidas dentro de sus plazos establecidos.

Para cada grupo de acciones críticas, modela:
1. La cadena de fallos que se activaría (bow-tie simplificado)
2. Los escenarios de accidente que podrían materializarse
3. El incremento de probabilidad de incidente por cada semana de demora
4. El impacto en personas, ambiente, activos y reputación
5. La normativa que quedaría incumplida

Genera un análisis estructurado con:
- Índice de Riesgo Global (0-100, donde 100 = catástrofe inminente)
- Nivel de alerta: Verde (<30) / Amarillo (30-59) / Naranja (60-79) / Rojo (≥80)
- Proyección temporal del riesgo a 30, 60 y 90 días si se mantiene el incumplimiento
- Escenarios específicos de consecuencias por elemento PSM

Responde SOLO en JSON con esta estructura exacta:
{
  "indice_riesgo_global": 0-100,
  "nivel_alerta": "Verde|Amarillo|Naranja|Rojo",
  "resumen_ejecutivo": "párrafo ejecutivo...",
  "proyeccion_riesgo": {
    "hoy": número,
    "dias_30": número,
    "dias_60": número,
    "dias_90": número
  },
  "escenarios_incumplimiento": [
    {
      "id": "E1",
      "titulo": "nombre del escenario",
      "elemento_psm": "elemento PSM afectado",
      "criticidad": "Crítico|Alto|Medio|Bajo",
      "accion_incumplida": "nombre de la acción que no se cumplió",
      "cadena_fallos": ["fallo 1", "fallo 2", "fallo 3"],
      "consecuencias": {
        "personas": "descripción de impacto en personas",
        "ambiente": "descripción de impacto ambiental",
        "activos": "descripción de impacto en activos y producción",
        "reputacion": "descripción de impacto reputacional/legal"
      },
      "probabilidad_ocurrencia": "Muy Alta|Alta|Moderada|Baja",
      "tiempo_materializacion": "plazo estimado si no se actúa",
      "normativa_incumplida": ["norma 1", "norma 2"],
      "accion_emergencia": "qué hacer de inmediato"
    }
  ],
  "factores_agravantes": ["factor 1", "factor 2"],
  "factores_mitigantes": ["factor 1", "factor 2"],
  "recomendacion_urgente": "acción más urgente que debe tomarse hoy",
  "indicadores_alerta_temprana": [
    { "indicador": "descripción del KPI a monitorear", "umbral": "valor de disparo", "frecuencia": "diaria|semanal" }
  ]
}`;

    const raw = await geminiAnalizar(prompt);
    let analisis;
    try {
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      analisis = JSON.parse(m?.[0] ?? clean);
    } catch {
      analisis = {
        indice_riesgo_global: 50,
        nivel_alerta: 'Amarillo',
        resumen_ejecutivo: raw,
        proyeccion_riesgo: { hoy: 50, dias_30: 60, dias_60: 70, dias_90: 80 },
        escenarios_incumplimiento: [],
        factores_agravantes: [],
        factores_mitigantes: [],
        recomendacion_urgente: 'Revisar el análisis completo con el equipo técnico.',
        indicadores_alerta_temprana: [],
      };
    }

    // ── 4. Guardar en BD ─────────────────────────────────────────────────
    const nombre = `Pronóstico ${hoy.toLocaleDateString('es-CO')} — ${analisis.nivel_alerta}`;
    const { rows: [pronostico] } = await pool.query(`
      INSERT INTO pronosticos (tenant_id, nombre, analisis_ia, acciones_base, generado_por)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tid, nombre, JSON.stringify(analisis), JSON.stringify(acciones), req.usuario.id]);

    console.log(`[PRONOSTICO] Generado #${pronostico.id} — Riesgo ${analisis.indice_riesgo_global}% (${analisis.nivel_alerta})`);
    res.json({ pronostico_id: pronostico.id, analisis, acciones_analizadas: acciones.length });

  } catch (err) {
    console.error('[PRONOSTICO] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔔 MOTOR DE NOTIFICACIONES — cron diario 8:00 AM
// ═══════════════════════════════════════════════════════════════════════════════

async function ejecutarNotificaciones() {
  const DIAS_ALERTA = [10, 5, 3, 2];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Obtener ítems con notificaciones activas, email configurado, fecha límite futura
  const { rows: items } = await pool.query(`
    SELECT pa.id, pa.nombre, pa.responsable, pa.responsable_email,
           pa.fecha_limite, pa.criticidad
    FROM plan_accion_items pa
    WHERE pa.notificaciones_activas = TRUE
      AND pa.responsable_email IS NOT NULL
      AND pa.responsable_email != ''
      AND pa.fecha_limite IS NOT NULL
      AND pa.estado NOT IN ('Completado','Cancelado')
      AND pa.fecha_limite >= NOW()
  `);

  const resumen = { procesados: 0, enviados: 0, errores: 0, detalle: [] };

  for (const item of items) {
    const fechaLimite = new Date(item.fecha_limite);
    fechaLimite.setHours(0, 0, 0, 0);
    const diffMs   = fechaLimite.getTime() - hoy.getTime();
    const diasRest = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (!DIAS_ALERTA.includes(diasRest)) continue;

    // Verificar si ya se envió esta notificación
    const { rows: [yaEnviado] } = await pool.query(
      'SELECT 1 FROM plan_accion_notif_log WHERE item_id=$1 AND dias_restantes=$2',
      [item.id, diasRest]
    );
    if (yaEnviado) continue;

    resumen.procesados++;
    try {
      const resultado = await enviarEmailNotificacion({
        to:            item.responsable_email,
        nombre:        item.responsable,
        accion:        item.nombre,
        fecha_limite:  item.fecha_limite,
        diasRestantes: diasRest,
        criticidad:    item.criticidad,
      });

      await pool.query(
        `INSERT INTO plan_accion_notif_log (item_id, dias_restantes, enviado_a, simulado)
         VALUES ($1,$2,$3,$4) ON CONFLICT (item_id, dias_restantes) DO NOTHING`,
        [item.id, diasRest, item.responsable_email, resultado.simulado || false]
      );

      resumen.enviados++;
      resumen.detalle.push({ id: item.id, email: item.responsable_email, dias: diasRest, ok: true });
      console.log(`[NOTIF] ✓ Email ${resultado.simulado ? 'simulado' : 'enviado'} → ${item.responsable_email} (${diasRest} días)`);

    } catch (err) {
      resumen.errores++;
      resumen.detalle.push({ id: item.id, email: item.responsable_email, dias: diasRest, ok: false, error: err.message });
      console.error(`[NOTIF] ✗ Error enviando a ${item.responsable_email}:`, err.message);
    }
  }

  console.log(`[NOTIF] Ciclo completado: ${resumen.enviados} enviados, ${resumen.errores} errores`);
  return resumen;
}

// Cron job: todos los días a las 8:00 AM
cron.schedule('0 8 * * *', () => {
  console.log('[CRON] Iniciando ciclo de notificaciones de Plan de Acción…');
  ejecutarNotificaciones().catch(err => console.error('[CRON] Error en notificaciones:', err.message));
}, { timezone: 'America/Bogota' });

console.log('[NOTIF] Cron de notificaciones registrado — ejecuta diariamente a las 8:00 AM (Bogotá)');

// Middleware de error global: captura next(err) y loguea el stack completo
app.use((err, req, res, next) => {
  console.error('[API] Error no manejado:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3002;
const TIMEOUT_SERVIDOR_MS = 120000; // Keep-Alive: conexión abierta mientras Gemini procesa Fase 5 / pronóstico

Promise.all([ensureTable(), ensureQuestionsTable(), ensureDiagnosticoSetup()])
  .then(() => ensureMainTablesExist())
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
    server.timeout = TIMEOUT_SERVIDOR_MS;
    server.keepAliveTimeout = 120000; // Full-Bridge: evita cierre de conexión durante triangulación
    server.headersTimeout = TIMEOUT_SERVIDOR_MS + 1000;
  })
  .catch((err) => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
