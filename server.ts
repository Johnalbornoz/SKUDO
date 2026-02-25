import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initDb, getPool } from "./src/db.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Test de conexión
  app.get("/api/db-test", async (req, res) => {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      return res.status(400).json({ 
        status: "error", 
        message: "FALTA CONFIGURACIÓN: La variable DATABASE_URL no está definida en los Secrets de AI Studio." 
      });
    }

    try {
      const pool = getPool();
      const result = await pool.query("SELECT NOW() as time, current_database() as db");
      
      // Mask the password in the URL for security
      const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':***@');

      res.json({ 
        status: "success", 
        message: "Conexión a PostgreSQL exitosa", 
        data: result.rows[0],
        database_url: maskedUrl
      });
    } catch (err: any) {
      res.status(500).json({ 
        status: "error", 
        message: "Error de red o credenciales", 
        error: err.message 
      });
    }
  });

  // Obtener todas las sesiones
  app.get("/api/sessions", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM diagnosis_sessions ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener sesiones" });
    }
  });

  // --- QUESTIONS ---
  app.get("/api/questions", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM questions ORDER BY id ASC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener preguntas" });
    }
  });

  app.post("/api/questions", async (req, res) => {
    const { id, text, category, applicable_levels } = req.body;
    try {
      const pool = getPool();
      await pool.query(
        "INSERT INTO questions (id, text, category, applicable_levels) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET text = $2, category = $3, applicable_levels = $4",
        [id, text, category, applicable_levels]
      );
      res.json({ message: "Pregunta guardada" });
    } catch (err) {
      res.status(500).json({ error: "Error al guardar pregunta" });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const pool = getPool();
      await pool.query("DELETE FROM questions WHERE id = $1", [req.params.id]);
      res.json({ message: "Pregunta eliminada" });
    } catch (err) {
      res.status(500).json({ error: "Error al eliminar pregunta" });
    }
  });

  // --- CRITERIA ---
  app.get("/api/criteria", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM effectiveness_criteria ORDER BY min_score DESC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener criterios" });
    }
  });

  app.post("/api/criteria", async (req, res) => {
    const { id, level_name, min_score, max_score, description } = req.body;
    try {
      const pool = getPool();
      if (id) {
        await pool.query(
          "UPDATE effectiveness_criteria SET level_name = $1, min_score = $2, max_score = $3, description = $4 WHERE id = $5",
          [level_name, min_score, max_score, description, id]
        );
      } else {
        await pool.query(
          "INSERT INTO effectiveness_criteria (level_name, min_score, max_score, description) VALUES ($1, $2, $3, $4)",
          [level_name, min_score, max_score, description]
        );
      }
      res.json({ message: "Criterio guardado" });
    } catch (err) {
      res.status(500).json({ error: "Error al guardar criterio" });
    }
  });

  // --- USERS ---
  app.get("/api/users", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM users ORDER BY name ASC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const { id, email, name, role } = req.body;
    try {
      const pool = getPool();
      await pool.query(
        "INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, role = $4",
        [id || `u${Math.random().toString(36).substr(2, 5)}`, email, name, role]
      );
      res.json({ message: "Usuario guardado" });
    } catch (err) {
      res.status(500).json({ error: "Error al guardar usuario" });
    }
  });

  // Crear una nueva sesión
  app.post("/api/sessions", async (req, res) => {
    const { id, userId, installationName, level, sector, substances, staffCount, age, status } = req.body;
    try {
      const pool = getPool();
      await pool.query(
        "INSERT INTO diagnosis_sessions (id, user_id, installation_name, level, sector, substances, staff_count, age, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [id, userId || 'u1', installationName, level, sector, substances, staffCount, age, status]
      );
      res.status(201).json({ message: "Sesión creada" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al crear sesión" });
    }
  });

  // Guardar respuestas de diagnóstico
  app.post("/api/sessions/:id/responses", async (req, res) => {
    const sessionId = req.params.id;
    const { responses } = req.body; // Array de DiagnosisResponse
    
    try {
      const pool = getPool();
      // Usamos una transacción para guardar todas las respuestas
      await pool.query("BEGIN");
      
      // Eliminar respuestas previas para evitar duplicados
      await pool.query("DELETE FROM diagnosis_responses WHERE session_id = $1", [sessionId]);

      for (const resp of responses) {
        await pool.query(
          `INSERT INTO diagnosis_responses 
          (session_id, question_id, score, effectiveness, situation, evidence, recommendation, triangulation, expert_id) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            sessionId, 
            resp.questionId, 
            resp.score, 
            resp.effectiveness, 
            resp.finding.situation, 
            resp.finding.evidence, 
            resp.finding.recommendation,
            JSON.stringify(resp.triangulation),
            resp.expertId || 'u1'
          ]
        );
      }
      
      await pool.query("COMMIT");
      res.json({ message: "Respuestas guardadas" });
    } catch (err) {
      console.error("Error saving responses:", err);
      const pool = getPool();
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Error al guardar respuestas" });
    }
  });

  // Obtener configuración del sistema
  app.get("/api/config", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM system_config WHERE id = 'default'");
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener configuración" });
    }
  });

  // Actualizar configuración del sistema
  app.post("/api/config", async (req, res) => {
    const { systemPrompt } = req.body;
    try {
      const pool = getPool();
      await pool.query(
        "UPDATE system_config SET system_prompt = $1, updated_at = NOW() WHERE id = 'default'",
        [systemPrompt]
      );
      res.json({ message: "Configuración actualizada" });
    } catch (err) {
      res.status(500).json({ error: "Error al actualizar configuración" });
    }
  });

  // --- ACTIONS ---
  app.get("/api/sessions/:id/actions", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM diagnosis_actions WHERE session_id = $1", [req.params.id]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener acciones" });
    }
  });

  app.post("/api/sessions/:id/actions", async (req, res) => {
    const { id } = req.params;
    const { actions } = req.body;
    try {
      const pool = getPool();
      await pool.query("BEGIN");
      await pool.query("DELETE FROM diagnosis_actions WHERE session_id = $1", [id]);
      for (const a of actions) {
        await pool.query(
          "INSERT INTO diagnosis_actions (session_id, question_id, action_text, priority, status, responsible, deadline) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [id, a.questionId, a.actionText, a.priority, a.status || 'Pendiente', a.responsible, a.deadline]
        );
      }
      await pool.query("COMMIT");
      res.json({ message: "Acciones guardadas" });
    } catch (err) {
      const pool = getPool();
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Error al guardar acciones" });
    }
  });

  app.get("/api/sessions/:id/plan-summary", async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM view_action_plan_summary WHERE session_id = $1", [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener resumen del plan" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor Skudo PSM corriendo en http://localhost:${PORT}`);
    
    // Inicializar DB en segundo plano para no bloquear el inicio del servidor
    console.log("Iniciando conexión con la base de datos...");
    initDb().catch(err => {
      console.error("Error crítico al inicializar la base de datos:", err);
    });
  });
}

startServer();
