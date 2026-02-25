import 'dotenv/config';
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Ejecutando migración multi-tenant SKUDO v2...');

    // ── 1. Tenants ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id         SERIAL PRIMARY KEY,
        nombre     TEXT NOT NULL,
        nit        TEXT UNIQUE,
        logo_url   TEXT,
        plan_tipo  TEXT DEFAULT 'Básico'
                   CHECK (plan_tipo IN ('Básico', 'Profesional', 'Enterprise')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── 2. Plantas ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS plantas (
        id          SERIAL PRIMARY KEY,
        tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nombre      TEXT NOT NULL,
        ubicacion   TEXT,
        responsable TEXT
      )
    `);

    // ── 3. Áreas ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id          SERIAL PRIMARY KEY,
        planta_id   INTEGER NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
        nombre      TEXT NOT NULL,
        descripcion TEXT
      )
    `);

    // ── 4. Usuarios ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            SERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nombre        TEXT NOT NULL,
        rol           TEXT NOT NULL
                      CHECK (rol IN ('SuperAdmin','Consultor','AdminInquilino','Auditor','Lector')),
        tenant_id     INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        activo        BOOLEAN DEFAULT TRUE,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── 5. Diagnósticos ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS diagnosticos (
        id                  SERIAL PRIMARY KEY,
        tenant_id           INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        planta_id           INTEGER REFERENCES plantas(id) ON DELETE SET NULL,
        area_id             INTEGER REFERENCES areas(id) ON DELETE SET NULL,
        consultor_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        escenario           TEXT,
        resultado_ia        TEXT,
        hallazgos_validados TEXT,
        estado              TEXT DEFAULT 'Borrador'
                            CHECK (estado IN ('Borrador','En Validación','Aprobado')),
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Todas las tablas creadas/verificadas.');

    // ── SuperAdmin por defecto ─────────────────────────────────────────────
    const { rows: admins } = await client.query(
      `SELECT id FROM usuarios WHERE rol = 'SuperAdmin' LIMIT 1`
    );
    if (admins.length === 0) {
      const hash = await bcrypt.hash('Admin123!', 12);
      await client.query(
        `INSERT INTO usuarios (email, password_hash, nombre, rol, tenant_id)
         VALUES ($1, $2, $3, 'SuperAdmin', NULL)`,
        ['admin@skudo.app', hash, 'Super Administrador']
      );
      console.log('👤 SuperAdmin creado → admin@skudo.app  /  Admin123!');
      console.log('   ⚠  Cambia la contraseña en producción.');
    } else {
      console.log('ℹ️  SuperAdmin ya existe, no se recreó.');
    }

    console.log('\n🎉 Migración completada.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('❌ Error en migración:', err.message);
  process.exit(1);
});
