import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../src/data/Preguntas.csv');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Columnas del CSV por índice (0-based), omitiendo el encabezado
// 0: id | 1: Complejidad | 2: Elemento | 3: Pregunta
// 4: Plan-Escasa | 5: Plan-AlMenos | 6: Plan-NoEvidencia
// 7: Ev-Suficiente | 8: Ev-Escasa | 9: Ev-AlMenos | 10: Ev-NoEv | 11: Ev-NoAplica
// 12: Guia-Suficiente | 13: Guia-Escasa | 14: Guia-AlMenos | 15: Guia-NoEv | 16: Guia-NoAplica
// 17: Legislacion | 18: Herramienta

async function seed() {
  const client = await pool.connect();
  try {
    console.log('📦 Creando tabla preguntas si no existe...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id               INTEGER PRIMARY KEY,
        complejidad      INTEGER,
        elemento         TEXT,
        pregunta         TEXT,
        plan_escasa      TEXT,
        plan_al_menos    TEXT,
        plan_no_evidencia TEXT,
        evidencia_suficiente TEXT,
        evidencia_escasa     TEXT,
        evidencia_al_menos   TEXT,
        evidencia_no_evidencia TEXT,
        evidencia_no_aplica  TEXT,
        guia_suficiente  TEXT,
        guia_escasa      TEXT,
        guia_al_menos    TEXT,
        guia_no_evidencia TEXT,
        guia_no_aplica   TEXT,
        legislacion      TEXT,
        herramienta      TEXT
      )
    `);

    console.log('📄 Leyendo CSV...');
    const content = readFileSync(CSV_PATH, 'utf-8');

    const records = parse(content, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      from_line: 2, // Omitir encabezado
    });

    console.log(`🔄 Procesando ${records.length} filas...`);
    let insertadas = 0;
    let omitidas = 0;

    for (const r of records) {
      const id = parseInt(r[0]);
      if (!id || isNaN(id)) { omitidas++; continue; }

      await client.query(
        `INSERT INTO preguntas (
           id, complejidad, elemento, pregunta,
           plan_escasa, plan_al_menos, plan_no_evidencia,
           evidencia_suficiente, evidencia_escasa, evidencia_al_menos,
           evidencia_no_evidencia, evidencia_no_aplica,
           guia_suficiente, guia_escasa, guia_al_menos,
           guia_no_evidencia, guia_no_aplica,
           legislacion, herramienta
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          parseInt(r[1]) || 1,
          r[2] ?? '',
          r[3] ?? '',
          r[4] ?? '',
          r[5] ?? '',
          r[6] ?? '',
          r[7] ?? '',
          r[8] ?? '',
          r[9] ?? '',
          r[10] ?? '',
          r[11] ?? '',
          r[12] ?? '',
          r[13] ?? '',
          r[14] ?? '',
          r[15] ?? '',
          r[16] ?? '',
          r[17] ?? '',
          r[18] ?? '',
        ]
      );
      insertadas++;
    }

    console.log(`✅ Seed completado: ${insertadas} insertadas, ${omitidas} omitidas.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
