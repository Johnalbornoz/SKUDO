// Full-Bridge: en dev usamos proxy Vite (/api → localhost:3001) para evitar CORS y "Failed to fetch"
const API_URL = (import.meta.env.PROD
  ? 'https://skudo.onrender.com/api'
  : '/api').replace(/\/$/, '');

export const API_BASE_URL = API_URL;

/** Timeout para operaciones que usan IA (triangulación Fase 5, pronóstico). Debe ser < timeout del servidor (120s). */
const TIMEOUT_IA_MS = 115000;

function getToken() {
  return localStorage.getItem('skudo_token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// No usar mode: 'no-cors' — impide leer el cuerpo de la respuesta y provoca "Failed to fetch"
async function http(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    localStorage.removeItem('skudo_token');
    localStorage.removeItem('skudo_usuario');
    window.location.reload();
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

/**
 * Peticiones de larga duración (IA: triangulación Fase 5, generación de pronóstico).
 * Usa API_URL y timeout extendido; en caso de tiempo de espera devuelve mensaje claro.
 */
async function httpLong(url, options = {}, timeoutMs = TIMEOUT_IA_MS) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...authHeaders(), ...options.headers },
      // Sin mode: 'no-cors' para poder leer la respuesta
    });
    clearTimeout(to);
    if (res.status === 401) {
      localStorage.removeItem('skudo_token');
      localStorage.removeItem('skudo_usuario');
      window.location.reload();
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(to);
    const isTimeout = err.name === 'AbortError' || /timeout|abort|failed to fetch/i.test(err.message || '');
    if (isTimeout) {
      throw new Error('El servidor está procesando la triangulación, por favor espera un momento e intenta de nuevo.');
    }
    throw err;
  }
}

const apiService = {
  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Credenciales incorrectas');
    }
    return res.json();
  },

  async fetchMe() {
    return http(`${API_URL}/auth/me`);
  },

  async fetchConfig() {
    return http(`${API_URL}/config`);
  },

  async saveConfig(data) {
    return http(`${API_URL}/config`, { method: 'POST', body: JSON.stringify(data) });
  },

  async testDatabaseConnection() {
    return http(`${API_URL}/test-db`);
  },

  async fetchPreguntas(search = '') {
    const url = search ? `${API_URL}/preguntas?search=${encodeURIComponent(search)}` : `${API_URL}/preguntas`;
    return http(url);
  },

  async fetchPregunta(id) {
    return http(`${API_URL}/preguntas/${id}`);
  },

  async createPregunta(data) {
    return http(`${API_URL}/preguntas`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updatePregunta(id, data) {
    return http(`${API_URL}/preguntas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deletePregunta(id) {
    return http(`${API_URL}/preguntas/${id}`, { method: 'DELETE' });
  },

  async fetchTenants() {
    return http(`${API_URL}/tenants`);
  },

  async createTenant(data) {
    return http(`${API_URL}/tenants`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateTenant(id, data) {
    return http(`${API_URL}/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async fetchPlantas() {
    return http(`${API_URL}/plantas`);
  },

  async createPlanta(data) {
    return http(`${API_URL}/plantas`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updatePlanta(id, data) {
    return http(`${API_URL}/plantas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deletePlanta(id) {
    return http(`${API_URL}/plantas/${id}`, { method: 'DELETE' });
  },

  async fetchAreas(planta_id) {
    const url = planta_id ? `${API_URL}/areas?planta_id=${planta_id}` : `${API_URL}/areas`;
    return http(url);
  },

  async createArea(data) {
    return http(`${API_URL}/areas`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateArea(id, data) {
    return http(`${API_URL}/areas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteArea(id) {
    return http(`${API_URL}/areas/${id}`, { method: 'DELETE' });
  },

  async fetchUsuarios() {
    return http(`${API_URL}/usuarios`);
  },

  async createUsuario(data) {
    return http(`${API_URL}/usuarios`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateUsuario(id, data) {
    return http(`${API_URL}/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteUsuario(id) {
    return http(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
  },

  async fetchDiagnosticos(estado) {
    const url = estado ? `${API_URL}/diagnosticos?estado=${encodeURIComponent(estado)}` : `${API_URL}/diagnosticos`;
    return http(url);
  },

  async fetchDiagnostico(id) {
    return http(`${API_URL}/diagnosticos/${id}`);
  },

  async createDiagnostico(data) {
    return http(`${API_URL}/diagnosticos`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updateDiagnostico(id, data) {
    return http(`${API_URL}/diagnosticos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async validarDiagnostico(id, hallazgos_validados) {
    return http(`${API_URL}/diagnosticos/${id}/validar`, {
      method: 'PUT',
      body: JSON.stringify({ hallazgos_validados }),
    });
  },

  async changePassword(password_actual, password_nuevo) {
    return http(`${API_URL}/auth/me/password`, {
      method: 'PUT',
      body: JSON.stringify({ password_actual, password_nuevo }),
    });
  },

  async fetchHierarchy() {
    return http(`${API_URL}/setup/hierarchy`);
  },

  async fetchEntrevistas(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/entrevistas`);
  },

  async crearEntrevista(diagId, data) {
    return http(`${API_URL}/diagnosticos/${diagId}/entrevistas`, { method: 'POST', body: JSON.stringify(data) });
  },

  async analizarEntrevista(diagId, entId) {
    return http(`${API_URL}/diagnosticos/${diagId}/entrevistas/${entId}/analizar`, { method: 'POST' });
  },

  async triangularDiagnostico(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/triangular`, { method: 'POST' });
  },

  async fetchDocumentos(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/documentos`);
  },

  async analizarDocumento(diagId, docId) {
    return http(`${API_URL}/diagnosticos/${diagId}/documentos/${docId}/analizar`, { method: 'POST' });
  },

  async eliminarDocumento(diagId, docId) {
    return http(`${API_URL}/diagnosticos/${diagId}/documentos/${docId}`, { method: 'DELETE' });
  },

  async fetchPrecalificacion(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/precalificacion`);
  },

  async deleteDiagnostico(id) {
    return http(`${API_URL}/diagnosticos/${id}`, { method: 'DELETE' });
  },

  async fetchPreguntasDiagnostico(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/preguntas`);
  },

  async responderPregunta(diagId, preguntaId, respuesta, comentario) {
    return http(`${API_URL}/diagnosticos/${diagId}/respuestas/${preguntaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ respuesta, comentario }),
    });
  },

  async fetchPreguntasParaIA(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/preguntas-para-ia`);
  },

  async fetchProgresoPreguntas(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/progreso-preguntas`);
  },

  async patchProgreso(id, data) {
    return http(`${API_URL}/diagnosticos/${id}/progreso`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async fetchNotasCampo(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido`);
  },

  async crearNotaCampo(diagId, data) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido`, { method: 'POST', body: JSON.stringify(data) });
  },

  async actualizarNotaCampo(diagId, itemId, data) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async eliminarNotaCampo(diagId, itemId) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}`, { method: 'DELETE' });
  },

  async subirFotoCampo(diagId, itemId, file) {
    const token = localStorage.getItem('skudo_token');
    const form = new FormData();
    form.append('foto', file);
    const res = await fetch(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}/foto`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `Error ${res.status}`);
    }
    return res.json();
  },

  async analizarNotaCampo(diagId, itemId) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}/analizar`, { method: 'POST' });
  },

  async triangularCampo(diagId) {
    return http(`${API_URL}/diagnosticos/${diagId}/recorrido/triangular`, { method: 'POST' });
  },

  async setupDiagnostico(data) {
    return http(`${API_URL}/diagnosticos/setup`, { method: 'POST', body: JSON.stringify(data) });
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 FASE 5: AUDITORÍA EXPERTA CON TRIANGULACIÓN DE EVIDENCIAS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Obtener preguntas filtradas por complejidad para Fase 5
  async fetchPreguntasFase5(diagnosticoId, complexity = null) {
    const url = complexity 
      ? `${API_URL}/diagnosticos/${diagnosticoId}/questions?complexity=${complexity}`
      : `${API_URL}/diagnosticos/${diagnosticoId}/questions`;
      
    const response = await fetch(url, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  // Validar pregunta en Fase 5 (HITL) – servidor consulta BD y puede usar IA; timeout largo
  async validarPreguntaFase5(diagnosticoId, validacionData) {
    return httpLong(`${API_URL}/diagnosticos/${diagnosticoId}/validate-fase5`, {
      method: 'POST',
      body: JSON.stringify(validacionData),
    });
  },

  // Obtener detalle de evidencia específica
  async fetchEvidenciaDetalle(diagnosticoId, tipo, evidenciaId) {
    const response = await fetch(`${API_URL}/diagnosticos/${diagnosticoId}/evidencia/${tipo}/${evidenciaId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  // Finalizar diagnóstico + generar análisis IA
  async finalizarDiagnostico(diagnosticoId) {
    return http(`${API_URL}/diagnosticos/${diagnosticoId}/finalizar`, { method: 'POST' });
  },

  // Obtener análisis IA ya guardado
  async fetchAnalisisDiagnostico(diagnosticoId) {
    return http(`${API_URL}/diagnosticos/${diagnosticoId}/analisis`);
  },

  // ── Plan de Acción ────────────────────────────────────────────────────────

  async fetchPlanAccion({ criticidad, estado, diagnostico_id } = {}) {
    const p = new URLSearchParams();
    if (criticidad)     p.set('criticidad',     criticidad);
    if (estado)         p.set('estado',         estado);
    if (diagnostico_id) p.set('diagnostico_id', diagnostico_id);
    const qs = p.toString() ? `?${p}` : '';
    return http(`${API_URL}/plan-accion${qs}`);
  },

  async createPlanAccionItem(data) {
    return http(`${API_URL}/plan-accion`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updatePlanAccionItem(id, data) {
    return http(`${API_URL}/plan-accion/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async deletePlanAccionItem(id) {
    return http(`${API_URL}/plan-accion/${id}`, { method: 'DELETE' });
  },

  async importarPlanIA(diagnosticoId) {
    return http(`${API_URL}/plan-accion/importar-ia/${diagnosticoId}`, { method: 'POST' });
  },

  async fetchDiagnosticosFinalizados() {
    return http(`${API_URL}/plan-accion/diagnosticos-finalizados`);
  },

  async enviarNotificacionesPlan() {
    return http(`${API_URL}/plan-accion/notificaciones/enviar`, { method: 'POST' });
  },

  // ── Pronóstico / Gemelo Digital ───────────────────────────────────────────

  async fetchPronosticos() {
    return http(`${API_URL}/pronostico`);
  },

  async fetchPronostico(id) {
    return http(`${API_URL}/pronostico/${id}`);
  },

  async generarPronostico() {
    return httpLong(`${API_URL}/pronostico/generar`, { method: 'POST' });
  },

  async eliminarPronostico(id) {
    return http(`${API_URL}/pronostico/${id}`, { method: 'DELETE' });
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async fetchMadurezDashboard(plantaId = null) {
    const qs = plantaId ? `?planta_id=${plantaId}` : '';
    return http(`${API_URL}/dashboard/madurez${qs}`);
  },

  async fetchDashboardStats() {
    return http(`${API_URL}/dashboard/stats`);
  },

  // Descargar reporte Word del diagnóstico
  async descargarReporte(diagnosticoId) {
    const token = getToken();
    const response = await fetch(`${API_URL}/diagnosticos/${diagnosticoId}/reporte`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Diagnostico_PSM_${diagnosticoId}_${new Date().toISOString().slice(0,10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

export default apiService;
