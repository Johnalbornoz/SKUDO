import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-2.5-flash';
const PROVIDER = 'gemini';

const DEFAULT_SYSTEM_PROMPT =
  'Actúa como un experto en Seguridad de Procesos (PSM). Analiza este escenario y dame 3 recomendaciones breves:';

async function analyzeWithGemini(promptText, systemPrompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'pega_tu_llave_aqui') {
    throw new Error('Configura tu API key en el archivo .env (VITE_GEMINI_API_KEY).');
  }

  const trimmed = (promptText ?? '').trim();

  if (!trimmed) {
    throw new Error('Escribe un escenario o problema de seguridad antes de analizar.');
  }

  const context = (systemPrompt ?? '').trim() || DEFAULT_SYSTEM_PROMPT;
  const fullPrompt = `${context}\n\n${trimmed}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();
  return `${text}\n\n---\n*Análisis listo para validación por el Consultor SKUDO.*`;
}

/** Mapa de claves a etiquetas legibles */
const DIM_LABELS = {
  riesgo_tecnico: 'Riesgo Técnico',
  regulacion:     'Regulación',
  madurez:        'Madurez del SGS',
  estrategia:     'Estrategia',
  complejidad:    'Complejidad Operacional',
  exposicion:     'Exposición Financiera',
};
const NIVEL_LABELS = { 1: 'Bajo', 2: 'Medio', 3: 'Alto', 4: 'Crítico' };

/**
 * Construye el bloque de contexto de clasificación PSM (Fase 1).
 * Incluye dimensiones numéricas y, si existen, las justificaciones del consultor.
 * @param {object} dataSetup - data_setup del diagnóstico (dims + comentarios)
 * @param {number} nivel     - nivel_calculado
 */
function buildClasificacionContext(dataSetup, nivel) {
  if (!dataSetup || !nivel) return '';

  const NIVELES_DIAG = {
    1: 'Exploratorio', 2: 'Básico', 3: 'Estándar', 4: 'Avanzado', 5: 'Crítico-Excepcional',
  };

  const filas = Object.entries(DIM_LABELS).map(([key, label]) => {
    const val      = dataSetup[key];
    const comentKey = `comentarios_${key}`;
    const coment   = dataSetup[comentKey] || '';
    if (!val) return null;
    return `| ${label} | ${NIVEL_LABELS[val] ?? val} | ${coment || '—'} |`;
  }).filter(Boolean);

  const tieneJustificaciones = Object.keys(DIM_LABELS).some(
    (k) => dataSetup[`comentarios_${k}`]
  );

  let ctx = `\n\n---\n## Perfil de Clasificación PSM — Fase 1\n`;
  ctx += `**Nivel calculado: ${nivel} (${NIVELES_DIAG[nivel] ?? ''}).**\n\n`;
  ctx += `| Dimensión | Nivel | Justificación del Consultor |\n`;
  ctx += `|---|---|---|\n`;
  ctx += filas.join('\n');

  if (tieneJustificaciones) {
    ctx += `\n\n> **Instrucción para la IA:** Las justificaciones del consultor son datos cualitativos de alta confiabilidad. `;
    ctx += `Úsalos para ponderar los hallazgos: si una dimensión tiene justificación crítica (ej: alta rotación de personal, `;
    ctx += `presencia de sustancias de alto peligro), profundiza en esa área durante las fases de entrevistas y recorrido. `;
    ctx += `Cita estas notas en tu análisis cuando sean relevantes.`;
  }

  return ctx;
}

/**
 * Construye la sección de cuestionario para incluir en el prompt de la IA.
 * @param {Array} preguntas - Resultado de fetchPreguntasParaIA
 */
function buildCuestionarioContext(preguntas) {
  if (!preguntas?.length) return '';
  const respondidas = preguntas.filter((p) => p.respuesta && p.respuesta !== 'No aplica');
  if (!respondidas.length) return '';
  const lines = respondidas.map((p) =>
    `• [${p.elemento ?? 'General'}] ${p.pregunta} → ${p.respuesta}${p.comentario ? ` (${p.comentario})` : ''}`
  );
  return `\n\n---\n## Resultados del Cuestionario Normativo (${respondidas.length} preguntas auditadas)\n\n${lines.join('\n')}\n\nBasa tu análisis en estos hallazgos reales. Prioriza los elementos con respuesta "No evidencia" o "Escasa".`;
}

const aiService = {
  /**
   * Analiza riesgos de PSM para un escenario dado.
   * @param {string} promptText       - Escenario descrito por el usuario.
   * @param {string} systemPrompt     - Prompt de sistema editable desde Configuración.
   * @param {Array}  [preguntas]      - Preguntas filtradas del diagnóstico.
   * @param {object} [clasificacion]  - { dataSetup, nivel } de la Fase 1.
   */
  async analyzeRisk(promptText, systemPrompt, preguntas, clasificacion) {
    const clasificacionCtx = buildClasificacionContext(
      clasificacion?.dataSetup, clasificacion?.nivel
    );
    const cuestionarioCtx  = buildCuestionarioContext(preguntas);
    const enrichedPrompt   = (promptText ?? '') + clasificacionCtx + cuestionarioCtx;
    switch (PROVIDER) {
      case 'gemini':
      default:
        return analyzeWithGemini(enrichedPrompt, systemPrompt);
    }
  },

  buildClasificacionContext,
};

export default aiService;

