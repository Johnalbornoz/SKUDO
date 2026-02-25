const API_URL = import.meta.env.PROD ? 'https://skudo.onrender.com/api' : 'http://localhost:3000/api';
export { API_URL as API_BASE_URL }; // Alias para componentes que lo importan

// ── Auth helpers ──────────────────────────────────────────────────────────

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

async function http(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });

  // Token expirado o inválido → forzar logout
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

// ── Autenticación ─────────────────────────────────────────────────────────

export async function login(email, password) {
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
}

export async function fetchMe() {
  return http(`${API_URL}/auth/me`);
}

// ── Configuración ─────────────────────────────────────────────────────────

export async function fetchConfig() {
  return http(`${API_URL}/config`);
}

export async function saveConfig(data) {
  return http(`${API_URL}/config`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function testDatabaseConnection() {
  return http(`${API_URL}/test-db`);
}

// ── Preguntas CRUD ────────────────────────────────────────────────────────

export async function fetchPreguntas(search = '') {
  const url = search
    ? `${API_URL}/preguntas?search=${encodeURIComponent(search)}`
    : `${API_URL}/preguntas`;
  return http(url);
}

export async function fetchPregunta(id) {
  return http(`${API_URL}/preguntas/${id}`);
}

export async function createPregunta(data) {
  return http(`${API_URL}/preguntas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePregunta(id, data) {
  return http(`${API_URL}/preguntas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePregunta(id) {
  return http(`${API_URL}/preguntas/${id}`, { method: 'DELETE' });
}

// ── Tenants ───────────────────────────────────────────────────────────────

export async function fetchTenants() {
  return http(`${API_URL}/tenants`);
}

export async function createTenant(data) {
  return http(`${API_URL}/tenants`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTenant(id, data) {
  return http(`${API_URL}/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── Plantas ───────────────────────────────────────────────────────────────

export async function fetchPlantas() {
  return http(`${API_URL}/plantas`);
}

export async function createPlanta(data) {
  return http(`${API_URL}/plantas`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePlanta(id, data) {
  return http(`${API_URL}/plantas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePlanta(id) {
  return http(`${API_URL}/plantas/${id}`, { method: 'DELETE' });
}

// ── Áreas ─────────────────────────────────────────────────────────────────

export async function fetchAreas(planta_id) {
  const url = planta_id
    ? `${API_URL}/areas?planta_id=${planta_id}`
    : `${API_URL}/areas`;
  return http(url);
}

export async function createArea(data) {
  return http(`${API_URL}/areas`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateArea(id, data) {
  return http(`${API_URL}/areas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteArea(id) {
  return http(`${API_URL}/areas/${id}`, { method: 'DELETE' });
}

// ── Usuarios ──────────────────────────────────────────────────────────────

export async function fetchUsuarios() {
  return http(`${API_URL}/usuarios`);
}

export async function createUsuario(data) {
  return http(`${API_URL}/usuarios`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateUsuario(id, data) {
  return http(`${API_URL}/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── Diagnósticos ──────────────────────────────────────────────────────────

export async function fetchDiagnosticos(estado) {
  const url = estado
    ? `${API_URL}/diagnosticos?estado=${encodeURIComponent(estado)}`
    : `${API_URL}/diagnosticos`;
  return http(url);
}

export async function fetchDiagnostico(id) {
  return http(`${API_URL}/diagnosticos/${id}`);
}

export async function createDiagnostico(data) {
  return http(`${API_URL}/diagnosticos`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDiagnostico(id, data) {
  return http(`${API_URL}/diagnosticos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function validarDiagnostico(id, hallazgos_validados) {
  return http(`${API_URL}/diagnosticos/${id}/validar`, {
    method: 'PUT',
    body: JSON.stringify({ hallazgos_validados }),
  });
}

export async function deleteUsuario(id) {
  return http(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
}

export async function changePassword(password_actual, password_nuevo) {
  return http(`${API_URL}/auth/me/password`, {
    method: 'PUT',
    body: JSON.stringify({ password_actual, password_nuevo }),
  });
}

export async function fetchHierarchy() {
  return http(`${API_URL}/setup/hierarchy`);
}

export async function fetchEntrevistas(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/entrevistas`);
}
export async function crearEntrevista(diagId, data) {
  return http(`${API_URL}/diagnosticos/${diagId}/entrevistas`, { method: 'POST', body: JSON.stringify(data) });
}
export async function analizarEntrevista(diagId, entId) {
  return http(`${API_URL}/diagnosticos/${diagId}/entrevistas/${entId}/analizar`, { method: 'POST' });
}
export async function triangularDiagnostico(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/triangular`, { method: 'POST' });
}

export async function fetchDocumentos(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/documentos`);
}

export async function analizarDocumento(diagId, docId) {
  return http(`${API_URL}/diagnosticos/${diagId}/documentos/${docId}/analizar`, { method: 'POST' });
}

export async function eliminarDocumento(diagId, docId) {
  return http(`${API_URL}/diagnosticos/${diagId}/documentos/${docId}`, { method: 'DELETE' });
}

export async function fetchPrecalificacion(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/precalificacion`);
}

export async function deleteDiagnostico(id) {
  return http(`${API_URL}/diagnosticos/${id}`, { method: 'DELETE' });
}

export async function fetchPreguntasDiagnostico(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/preguntas`);
}

export async function responderPregunta(diagId, preguntaId, respuesta, comentario) {
  return http(`${API_URL}/diagnosticos/${diagId}/respuestas/${preguntaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ respuesta, comentario }),
  });
}

export async function fetchPreguntasParaIA(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/preguntas-para-ia`);
}

export async function patchProgreso(id, data) {
  return http(`${API_URL}/diagnosticos/${id}/progreso`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Recorrido / Captura Sensorial de Campo ────────────────────────────────────

export async function fetchNotasCampo(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido`);
}

export async function crearNotaCampo(diagId, data) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function actualizarNotaCampo(diagId, itemId, data) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function eliminarNotaCampo(diagId, itemId) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}`, {
    method: 'DELETE',
  });
}

export async function subirFotoCampo(diagId, itemId, file) {
  const token = localStorage.getItem('skudo_token');
  const form  = new FormData();
  form.append('foto', file);
  const res = await fetch(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}/foto`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
  return res.json();
}

export async function analizarNotaCampo(diagId, itemId) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido/${itemId}/analizar`, {
    method: 'POST',
  });
}

export async function triangularCampo(diagId) {
  return http(`${API_URL}/diagnosticos/${diagId}/recorrido/triangular`, {
    method: 'POST',
  });
}

export async function setupDiagnostico(data) {
  return http(`${API_URL}/diagnosticos/setup`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Export default (retrocompatible) ─────────────────────────────────────

const apiService = {
  login, fetchMe,
  fetchConfig, saveConfig, testDatabaseConnection,
  fetchPreguntas, fetchPregunta, createPregunta, updatePregunta, deletePregunta,
  fetchTenants, createTenant, updateTenant,
  fetchPlantas, createPlanta, updatePlanta, deletePlanta,
  fetchAreas, createArea, updateArea, deleteArea,
  fetchUsuarios, createUsuario, updateUsuario, deleteUsuario,
  fetchDiagnosticos, fetchDiagnostico, createDiagnostico, updateDiagnostico, validarDiagnostico,
  fetchHierarchy, changePassword, setupDiagnostico, patchProgreso,
  fetchEntrevistas, crearEntrevista, analizarEntrevista, triangularDiagnostico,
  fetchDocumentos, analizarDocumento, eliminarDocumento, fetchPrecalificacion,
  deleteDiagnostico,
  fetchPreguntasDiagnostico, responderPregunta, fetchPreguntasParaIA,
  fetchNotasCampo, crearNotaCampo, actualizarNotaCampo, eliminarNotaCampo,
  subirFotoCampo, analizarNotaCampo, triangularCampo,
};

export default apiService;
