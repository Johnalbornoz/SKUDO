import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("DATABASE_URL no está definida. Las funciones de base de datos fallarán.");
    }
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000, // 5 segundos de timeout
      ssl: {
        rejectUnauthorized: false // Necesario para la mayoría de servicios cloud como Supabase/Neon
      }
    });
  }
  return pool;
}

export async function initDb() {
  const p = getPool();
  try {
    // Crear tablas si no existen
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL, -- 'admin', 'consultant', 'viewer'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY, -- Will use codes like 'PSM-001'
        text TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        applicable_levels INTEGER[] NOT NULL,
        action_plan_scarce TEXT,
        action_plan_at_least_one TEXT,
        action_plan_none TEXT,
        evidence_sufficient TEXT,
        evidence_scarce TEXT,
        evidence_at_least_one TEXT,
        evidence_none TEXT,
        evidence_not_applicable TEXT,
        auditor_guide_sufficient TEXT,
        auditor_guide_scarce TEXT,
        auditor_guide_at_least_one TEXT,
        auditor_guide_none TEXT,
        auditor_guide_not_applicable TEXT,
        legislation TEXT,
        tech_tool TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS diagnosis_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        installation_name TEXT NOT NULL,
        level INTEGER NOT NULL,
        sector TEXT,
        substances TEXT,
        staff_count INTEGER,
        age INTEGER,
        status TEXT NOT NULL,
        field_notes JSONB DEFAULT '[]',
        interviews JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS diagnosis_responses (
        id SERIAL PRIMARY KEY,
        session_id TEXT REFERENCES diagnosis_sessions(id) ON DELETE CASCADE,
        question_id TEXT REFERENCES questions(id),
        score INTEGER NOT NULL,
        effectiveness TEXT NOT NULL,
        situation TEXT,
        evidence TEXT,
        recommendation TEXT,
        triangulation JSONB,
        expert_id TEXT REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS diagnosis_actions (
        id SERIAL PRIMARY KEY,
        session_id TEXT REFERENCES diagnosis_sessions(id) ON DELETE CASCADE,
        question_id TEXT REFERENCES questions(id),
        action_text TEXT NOT NULL,
        priority TEXT NOT NULL, -- 'Alta', 'Media', 'Baja'
        status TEXT DEFAULT 'Pendiente',
        responsible TEXT,
        deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- View for Action Plan Summary
      CREATE OR REPLACE VIEW view_action_plan_summary AS
      SELECT 
        s.id as session_id,
        s.installation_name,
        COUNT(a.id) as total_actions,
        COUNT(CASE WHEN a.priority = 'Alta' THEN 1 END) as high_priority_actions,
        COUNT(CASE WHEN a.status = 'Pendiente' THEN 1 END) as pending_actions
      FROM diagnosis_sessions s
      LEFT JOIN diagnosis_actions a ON s.id = a.session_id
      GROUP BY s.id, s.installation_name;

      CREATE TABLE IF NOT EXISTS system_config (
        id TEXT PRIMARY KEY,
        system_prompt TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default prompt if not exists
      INSERT INTO system_config (id, system_prompt)
      VALUES ('default', 'Actúa como un Consultor Senior en Seguridad de Procesos (PSM) encargado de realizar el Diagnóstico de Fase I bajo la metodología CCPS.

TU OBJETIVO:
Procesar evidencias técnicas para dar respuesta a un log de 188 preguntas normativas y redactar hallazgos con rigor técnico.

METODOLOGÍA DE ANÁLISIS (TRIANGULACIÓN):
Debes contrastar siempre tres fuentes de datos:
1. DOCUMENTACIÓN TÉCNICA: Análisis de procesos, manuales, P&IDs y PHAs.
2. OBSERVACIÓN EN CAMPO (VOCES): Realidad operativa detectada en recorridos.
3. TESTIMONIOS (ENTREVISTAS): Nivel de cultura y conocimiento real del personal.

REGLAS DE RESPUESTA:
- Tono: Tercera persona, profesional, técnico y legal.
- Marco Legal: Basado en el Decreto 1347 de 2021 (Colombia) y Resolución 5492 de 2024.
- Calificación de Efectividad:
  * Suficiente (75-100%): Evidencia sólida, sistemática y documentada.
  * Escasa (50-74%): Cumplimiento parcial o sin registros históricos.
  * Al menos una (1-49%): Cumplimiento informal o aislado.
  * No hay (0%): Ausencia total de gestión.

ESTRUCTURA DE CADA HALLAZGO:
1. Situación Encontrada: Descripción técnica de la brecha o fortaleza.
2. Evidencia Analizada: Citar explícitamente si proviene de documento, entrevista o visita.
3. Recomendación de Mejora: Acción concreta para alcanzar el nivel "Suficiente".')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Sembrar preguntas desde JSON
    try {
      const fs = await import('fs');
      const path = await import('path');
      const questionsPath = path.resolve('./src/data/questions.json');
      if (fs.existsSync(questionsPath)) {
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
        console.log(`Sembrando ${questions.length} preguntas desde JSON...`);
        
        for (const q of questions) {
          await p.query(`
            INSERT INTO questions (
              id, text, category, applicable_levels,
              action_plan_scarce, action_plan_at_least_one, action_plan_none,
              evidence_sufficient, evidence_scarce, evidence_at_least_one, evidence_none, evidence_not_applicable,
              auditor_guide_sufficient, auditor_guide_scarce, auditor_guide_at_least_one, auditor_guide_none, auditor_guide_not_applicable,
              legislation, tech_tool
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) ON CONFLICT (id) DO UPDATE SET
              text = EXCLUDED.text,
              category = EXCLUDED.category,
              applicable_levels = EXCLUDED.applicable_levels,
              action_plan_scarce = EXCLUDED.action_plan_scarce,
              action_plan_at_least_one = EXCLUDED.action_plan_at_least_one,
              action_plan_none = EXCLUDED.action_plan_none,
              evidence_sufficient = EXCLUDED.evidence_sufficient,
              evidence_scarce = EXCLUDED.evidence_scarce,
              evidence_at_least_one = EXCLUDED.evidence_at_least_one,
              evidence_none = EXCLUDED.evidence_none,
              evidence_not_applicable = EXCLUDED.evidence_not_applicable,
              auditor_guide_sufficient = EXCLUDED.auditor_guide_sufficient,
              auditor_guide_scarce = EXCLUDED.auditor_guide_scarce,
              auditor_guide_at_least_one = EXCLUDED.auditor_guide_at_least_one,
              auditor_guide_none = EXCLUDED.auditor_guide_none,
              auditor_guide_not_applicable = EXCLUDED.auditor_guide_not_applicable,
              legislation = EXCLUDED.legislation,
              tech_tool = EXCLUDED.tech_tool
          `, [
            q.id, q.text, q.category, q.applicable_levels,
            q.action_plan_scarce, q.action_plan_at_least_one, q.action_plan_none,
            q.evidence_sufficient, q.evidence_scarce, q.evidence_at_least_one, q.evidence_none, q.evidence_not_applicable,
            q.auditor_guide_sufficient, q.auditor_guide_scarce, q.auditor_guide_at_least_one, q.auditor_guide_none, q.auditor_guide_not_applicable,
            q.legislation, q.tech_tool
          ]);
        }
        console.log("Preguntas sembradas correctamente.");
      }
    } catch (err) {
      console.error("Error sembrando preguntas:", err);
    }

    console.log("Base de datos PostgreSQL inicializada correctamente.");
  } catch (err) {
    console.error("Error inicializando la base de datos:", err);
  }
}
