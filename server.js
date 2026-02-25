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
const { Pool } = pkg;
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const _require   = createRequire(import.meta.url);
const pdfParse   = _require('pdf-parse');

const JWT_SECRET = process.env.JWT_SECRET || 'skudo-dev-secret-changeme';

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

const cors = require('cors');

// Lista de dominios permitidos
const allowedOrigins = [
  'https://skudo.vercel.app',            // Tu dominio principal de producción
  'http://localhost:5173',               // Tu entorno local de Vite
  'http://localhost:3000'                // Tu puerto de backend local
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman o apps móviles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Origen bloqueado por CORS:", origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Importante: Asegúrate de que esto esté ANTES de tus rutas
app.use(express.json());
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
  ssl: { rejectUnauthorized: false },
});

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
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/diagnosticos/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM diagnosticos WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
app.get('/api/diagnosticos/:id/documentos', verificarToken, async (req, res) => {
  const diagId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT id, categoria, nombre_original, tamano, tipo_mime, estado,
              analisis_ia IS NOT NULL AS tiene_analisis, calificaciones, brechas, created_at
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

REGLAS DE CALIFICACIÓN NORMATIVA (aplica estrictamente):
- Suficiente (75-100%): Evidencia sólida, sistemática, documentada y actualizada que cumple íntegramente la normativa.
- Escasa (50-74%): Cumplimiento parcial, sin registros históricos completos o evidencia desactualizada.
- Al menos una (1-49%): Cumplimiento informal, aislado o sin respaldo documental formal.
- No hay (0%): Ausencia total de gestión, política, procedimiento o registro.

INSTRUCCIONES DE TRIANGULACIÓN:
Al analizar, verifica la consistencia interna del documento y señala:
1. Si los equipos críticos mencionados son coherentes entre sí (inventario vs. P&IDs).
2. Si el análisis de riesgos (HAZOP/LOPA) referencia los mismos escenarios que los P&IDs.
3. Si los procedimientos operacionales corresponden a los riesgos identificados.
4. Si los registros de incidentes están vinculados a los análisis de riesgos.
5. Cualquier contradicción o inconsistencia detectada dentro del documento.

Genera únicamente JSON válido (sin bloques markdown) con esta estructura exacta:
{
  "analisis_tecnico": "Análisis en tercera persona, tono profesional-legal, mínimo 200 palabras. Inicia con: 'Se observa que...' o 'El documento evidencia...'",
  "resumen_ejecutivo": "2-3 frases ejecutivas sobre el estado normativo del documento.",
  "inconsistencias": ["Lista de contradicciones o inconsistencias detectadas"],
  "calificaciones": [
    { "pregunta": "texto exacto de la pregunta normativa", "calificacion": "Suficiente|Escasa|Al menos una|No hay", "puntaje": 100|62|25|0, "justificacion": "justificación técnica y normativa breve" }
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

      await pool.query(
        `UPDATE diagnostico_documentos
         SET estado='Analizado', analisis_ia=$1, calificaciones=$2, brechas=$3
         WHERE id=$4`,
        [
          parsed.analisis_tecnico ?? rawResponse,
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

    res.json({
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
    });
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

    console.log('[setup] Tablas de workflow listas.');
  } catch (err) {
    console.warn('[setup] Error en ensureDiagnosticoSetup:', err.message);
  }
}

const PORT = 3000;
Promise.all([ensureTable(), ensureQuestionsTable(), ensureDiagnosticoSetup()])
  .then(() => {
    app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
