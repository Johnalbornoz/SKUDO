const API_URL = import.meta.env.PROD
  ? 'https://skudo.onrender.com/api'
  : 'http://localhost:3000/api';

export const API_BASE_URL = API_URL;

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
};

export default apiService;
