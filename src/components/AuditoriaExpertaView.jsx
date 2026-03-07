import { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import NavegacionFases from './NavegacionFases';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  MapPin,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Save,
  Eye,
  Clock,
  AlertCircle,
  Download,
  Sparkles,
} from 'lucide-react';

const CALIFICACIONES = {
  'Suficiente':     { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', icon: CheckCircle },
  'Escasa':         { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle },
  'Al menos una':   { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertTriangle },
  'No hay evidencia':{ color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   icon: XCircle },
};

const ICONOS_EVIDENCIA = {
  documento:  { icon: FileText, color: 'text-blue-600',   bg: 'bg-blue-50'   },
  entrevista: { icon: Users,    color: 'text-purple-600', bg: 'bg-purple-50' },
  recorrido:  { icon: MapPin,   color: 'text-green-600',  bg: 'bg-green-50'  },
};

export default function AuditoriaExpertaView({
  diagnosticoId,
  faseActual = 6,
  onNavegar,
  onCerrar,
  onSiguiente,
}) {
  const [preguntas, setPreguntas]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');
  const [expandedRows, setExpandedRows]         = useState(new Set());
  const [drawerData, setDrawerData]             = useState(null);
  const [validando, setValidando]               = useState(false);
  const [progreso, setProgreso]                 = useState({ validadas: 0, total: 0 });
  const [filtroCalificacion, setFiltroCalificacion] = useState('');
  const [filtroElemento, setFiltroElemento] = useState('');
  const [nivelComplejidad, setNivelComplejidad] = useState('');
  const [descargando, setDescargando]           = useState(false);
  const [finalizando, setFinalizando]           = useState(false);
  const [validandoTodas, setValidandoTodas]    = useState(false);

  useEffect(() => {
    if (diagnosticoId) cargarPreguntas();
  }, [diagnosticoId]);

  useEffect(() => {
    const validadas = preguntas.filter(p => p.calificacion_humano).length;
    setProgreso({ validadas, total: preguntas.length });
  }, [preguntas]);

  async function cargarPreguntas() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.fetchPreguntasFase5(diagnosticoId);
      setPreguntas(data.preguntas || []);
      setNivelComplejidad(data.nivel_complejidad || '');
    } catch (err) {
      setError(`No se pudieron cargar las preguntas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleValidacion(preguntaId, calificacionHumano, criterioProfesional, justificacion) {
    setValidando(true);
    try {
      await apiService.validarPreguntaFase5(diagnosticoId, {
        pregunta_id: preguntaId,
        calificacion_humano: calificacionHumano || null,
        criterio_profesional: criterioProfesional,
        override_justificacion: justificacion,
      });
      setPreguntas(prev => prev.map(p =>
        p.id === preguntaId
          ? {
              ...p,
              calificacion_humano:     calificacionHumano,
              criterio_profesional:    criterioProfesional,
              override_justificacion:  justificacion,
              validado_en:             new Date().toISOString(),
            }
          : p
      ));
    } catch (err) {
      const msg = err.message || '';
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        alert('No se pudo conectar con el servidor. Compruebe que el backend esté en marcha (puerto 3001) y que la URL en el frontend sea correcta.');
      } else {
        alert(`Error al guardar la validación: ${msg}`);
      }
    } finally {
      setValidando(false);
    }
  }

  async function handleAceptarTodasSugerenciasIA() {
    if (!window.confirm('¿Aceptar todas las Sugerencias IA como validadas? Se marcará cada pregunta con la calificación sugerida por la IA.')) return;
    setValidandoTodas(true);
    try {
      const data = await apiService.validarTodasSugerenciasIA(diagnosticoId);
      const totalValidadas = data.validadas ?? preguntas.length;
      // Actualización optimista: marcar todas como validadas con la sugerencia IA para que el contador y la tabla se actualicen al instante
      const ahora = new Date().toISOString();
      setPreguntas(prev => prev.map(p => ({
        ...p,
        calificacion_humano: p.sugerencia_ia || p.calificacion_ia || 'No hay evidencia',
        criterio_profesional: p.criterio_profesional || 'Aceptada sugerencia IA (validación automática)',
        validado_en: ahora,
      })));
      alert(`Se aceptaron ${totalValidadas} preguntas según la sugerencia IA.`);
      // Recargar desde el servidor (con cache-bust) para confirmar y tener datos consistentes
      setLoading(true);
      try {
        const data = await apiService.fetchPreguntasFase5(diagnosticoId, null, true);
        setPreguntas(data.preguntas || []);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setValidandoTodas(false);
    }
  }

  async function handleFinalizar() {
    if (!window.confirm('¿Finalizar el diagnóstico? Se generará el análisis IA y el diagnóstico quedará cerrado.')) return;
    setFinalizando(true);
    try {
      await apiService.finalizarDiagnostico(diagnosticoId);
      alert('¡Diagnóstico finalizado! El análisis IA está disponible en el Dashboard.');
      onSiguiente && onSiguiente(diagnosticoId);
    } catch (err) {
      alert(`Error al finalizar: ${err.message}`);
    } finally {
      setFinalizando(false);
    }
  }

  async function handleDescargarReporte() {
    setDescargando(true);
    try {
      await apiService.descargarReporte(diagnosticoId);
    } catch (err) {
      alert(`Error al generar el reporte: ${err.message}`);
    } finally {
      setDescargando(false);
    }
  }

  async function abrirEvidencia(tipo, id) {
    try {
      const evidencia = await apiService.fetchEvidenciaDetalle(diagnosticoId, tipo, id);
      setDrawerData({ tipo, id, ...evidencia });
    } catch (err) {
      alert(`Error al cargar la evidencia: ${err.message}`);
    }
  }

  function toggleExpanded(preguntaId) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(preguntaId) ? next.delete(preguntaId) : next.add(preguntaId);
      return next;
    });
  }

  const elementosUnicos = [...new Set(preguntas.map(p => (p.elemento || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const preguntasFiltradas = preguntas.filter(p => {
    if (filtroCalificacion && (p.calificacion_humano || p.sugerencia_ia) !== filtroCalificacion) return false;
    if (filtroElemento && (p.elemento || '').trim() !== filtroElemento) return false;
    return true;
  });

  // ── Estado de carga (persistente: preguntas + análisis IA pueden tardar con muchos documentos) ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Cargando preguntas y análisis de IA…</p>
          <p className="text-gray-500 text-sm mt-2">
            La IA está analizando múltiples fuentes de evidencia, esto puede tomar hasta un minuto.
          </p>
        </div>
      </div>
    );
  }

  // ── Estado de error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-lg text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Error al cargar la Fase 6</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onCerrar} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Volver
            </button>
            <button onClick={cargarPreguntas} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista principal ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ejecutivo sticky ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Fase 6 — Auditoría Experta</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Validación humana y triangulación de evidencias
                {nivelComplejidad && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs">
                    Nivel {nivelComplejidad}
                  </span>
                )}
              </p>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-700">{progreso.validadas} / {progreso.total}</p>
                <p className="text-xs text-gray-400">preguntas validadas</p>
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progreso.total > 0 ? (progreso.validadas / progreso.total) * 100 : 0}%` }}
                />
              </div>
              <button
                onClick={handleFinalizar}
                disabled={finalizando}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 transition-colors"
                title="Finalizar diagnóstico y generar análisis IA"
              >
                {finalizando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Finalizando…</>
                  : <><Sparkles className="w-4 h-4" /> Finalizar y Generar Análisis</>
                }
              </button>
              <button
                onClick={handleDescargarReporte}
                disabled={descargando}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 transition-colors"
                title="Generar informe Word con todas las no conformidades"
              >
                {descargando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando…</>
                  : <><Download className="w-4 h-4" /> Descargar Reporte</>
                }
              </button>
              <button
                onClick={onCerrar}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Navegación entre fases + barra de progreso de preguntas con evidencia ─────────────────────────────────────────── */}
        <NavegacionFases
          faseActual={6}
          onNavegar={(f) => onNavegar && onNavegar(f)}
          diagnosticoId={diagnosticoId}
          refreshKey={`${progreso.total}-${progreso.validadas}`}
        />

        {/* ── Botón temporal: Aceptar todas las sugerencias IA ───────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            <strong>Temporal:</strong> Validar todas las preguntas aceptando la Sugerencia IA como calificación humana.
          </p>
          <button
            type="button"
            onClick={handleAceptarTodasSugerenciasIA}
            disabled={validandoTodas || preguntas.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validandoTodas ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Validando…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Aceptar todas las Sugerencias IA
              </>
            )}
          </button>
        </div>

        {/* ── Barra de filtros y leyenda ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Filtrar por:</span>
              <select
                value={filtroCalificacion}
                onChange={e => setFiltroCalificacion(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Todas las calificaciones</option>
                <option value="Suficiente">Suficiente</option>
                <option value="Escasa">Escasa</option>
                <option value="Al menos una">Al menos una</option>
                <option value="No hay evidencia">Sin evidencia</option>
              </select>
              <select
                value={filtroElemento}
                onChange={e => setFiltroElemento(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[180px]"
                title="Filtrar por elemento PSM"
              >
                <option value="">Todos los elementos</option>
                {elementosUnicos.map(el => (
                  <option key={el} value={el}>{el}</option>
                ))}
              </select>
              {(filtroCalificacion || filtroElemento) && (
                <button
                  type="button"
                  onClick={() => { setFiltroCalificacion(''); setFiltroElemento(''); }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Leyenda de tipos de evidencia */}
            <div className="flex items-center gap-5 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-500" /> Documentos</div>
              <div className="flex items-center gap-1.5"><Users    className="w-4 h-4 text-purple-500" /> Entrevistas</div>
              <div className="flex items-center gap-1.5"><MapPin   className="w-4 h-4 text-green-500" /> Recorrido</div>
            </div>
          </div>
        </div>

        {/* ── Matriz de preguntas ─────────────────────────────────────────────── */}
        {preguntasFiltradas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <Eye className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay preguntas con ese filtro</p>
            <p className="text-gray-400 text-sm mt-1">Prueba con otras calificaciones o elementos, o pulsa &quot;Limpiar filtros&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {preguntasFiltradas.map(pregunta => (
              <PreguntaAccordion
                key={pregunta.id}
                pregunta={pregunta}
                expanded={expandedRows.has(pregunta.id)}
                onToggle={() => toggleExpanded(pregunta.id)}
                onValidar={handleValidacion}
                onAbrirEvidencia={abrirEvidencia}
                validando={validando}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Drawer de evidencia ─────────────────────────────────────────────── */}
      {drawerData && (
        <EvidenciaDrawer data={drawerData} onClose={() => setDrawerData(null)} />
      )}
    </div>
  );
}

// ── Accordion de Pregunta ────────────────────────────────────────────────────
function PreguntaAccordion({ pregunta, expanded, onToggle, onValidar, onAbrirEvidencia, validando }) {
  const [calificacionLocal,    setCalificacionLocal]    = useState(pregunta.calificacion_humano || '');
  const [criterioLocal,        setCriterioLocal]        = useState(pregunta.criterio_profesional || '');
  const [justificacionLocal,   setJustificacionLocal]   = useState(pregunta.override_justificacion || '');
  const [mostrarFormulario,    setMostrarFormulario]    = useState(false);

  // Sincronizar estado local cuando la pregunta se actualiza (p. ej. tras "Aceptar todas las Sugerencias IA")
  useEffect(() => {
    setCalificacionLocal(pregunta.calificacion_humano || '');
    setCriterioLocal(pregunta.criterio_profesional || '');
    setJustificacionLocal(pregunta.override_justificacion || '');
  }, [pregunta.calificacion_humano, pregunta.criterio_profesional, pregunta.override_justificacion]);

  // Si el consultor cambió la calificación respecto a la IA, el criterio es obligatorio
  const requiereJustificacion = calificacionLocal !== '' && calificacionLocal !== pregunta.sugerencia_ia;
  const esValidado = !!pregunta.validado_en;
  const calificacionMostrada  = calificacionLocal || pregunta.sugerencia_ia || 'No hay evidencia';

  async function handleGuardar() {
    if (requiereJustificacion && !criterioLocal.trim()) {
      alert('El criterio profesional es obligatorio cuando se modifica la calificación sugerida por la IA.');
      return;
    }
    await onValidar(pregunta.id, calificacionLocal, criterioLocal, justificacionLocal);
    setMostrarFormulario(false);
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-colors overflow-hidden
      ${esValidado ? 'border-green-200' : 'border-gray-100'}`}>

      {/* Cabecera clickeable */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors select-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {expanded
                ? <ChevronDown  className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Complejidad {pregunta.complejidad} · {pregunta.elemento}
              </span>
              {esValidado && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <CheckCircle className="w-3 h-3" /> Validado
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-gray-900 leading-snug pr-4">
              {pregunta.pregunta}
            </p>

            {/* Linaje de prueba */}
            <div className="mt-2.5">
              <TriangulacionEvidencias evidencias={pregunta} />
            </div>
          </div>

          {/* Badge calificación */}
          <CalificacionBadge
            calificacion={calificacionMostrada}
            esIA={!calificacionLocal}
          />
        </div>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/70 p-5 space-y-4">
          <DetalleEvidencias pregunta={pregunta} onAbrirEvidencia={onAbrirEvidencia} />

          {/* Panel HITL */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 text-sm">Intervención del Experto</h4>
              {!mostrarFormulario && (
                <button
                  onClick={e => { e.stopPropagation(); setMostrarFormulario(true); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {esValidado ? 'Modificar' : 'Validar'}
                </button>
              )}
            </div>

            {mostrarFormulario ? (
              <FormularioValidacion
                calificacionIA={pregunta.sugerencia_ia}
                calificacion={calificacionLocal}
                criterio={criterioLocal}
                justificacion={justificacionLocal}
                onCalificacionChange={setCalificacionLocal}
                onCriterioChange={setCriterioLocal}
                onJustificacionChange={setJustificacionLocal}
                onGuardar={handleGuardar}
                onCancelar={() => setMostrarFormulario(false)}
                validando={validando}
                requiereJustificacion={requiereJustificacion}
              />
            ) : (
              <ResumenValidacion
                pregunta={pregunta}
                calificacionLocal={calificacionLocal}
                criterioLocal={criterioLocal}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Triangulación de evidencias ─────────────────────────────────────────────
function TriangulacionEvidencias({ evidencias }) {
  const conteos = evidencias.conteo_evidencias || {};
  const tipos = [
    { key: 'documentos',  tipo: 'documento',  label: 'Docs'         },
    { key: 'entrevistas', tipo: 'entrevista', label: 'Entrevistas'  },
    { key: 'campo',       tipo: 'recorrido',  label: 'Campo'        },
  ];

  const hayEvidencia = conteos.total > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 font-medium">Linaje:</span>
      {tipos.map(({ key, tipo, label }) => {
        const count = conteos[key] || 0;
        const cfg   = ICONOS_EVIDENCIA[tipo];
        if (count === 0) return null;
        return (
          <div key={key} className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${cfg.bg}`}>
            <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
            <span className={`text-xs font-bold ${cfg.color}`}>{count} {label}</span>
          </div>
        );
      })}
      {!hayEvidencia && (
        <span className="text-xs text-gray-400 italic">Sin evidencias asociadas</span>
      )}
    </div>
  );
}

// ── Badge de calificación ───────────────────────────────────────────────────
function CalificacionBadge({ calificacion, esIA }) {
  const cfg = CALIFICACIONES[calificacion] || CALIFICACIONES['No hay evidencia'];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shrink-0 ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-4 h-4 ${cfg.color}`} />
      <span className={`text-xs font-bold ${cfg.color}`}>{calificacion}</span>
      {esIA && <span className="text-xs text-gray-400">(IA)</span>}
    </div>
  );
}

// ── Detalle de evidencias (3 columnas) ─────────────────────────────────────
function DetalleEvidencias({ pregunta, onAbrirEvidencia }) {
  const cols = [
    { key: 'evidencia_documentos',  label: 'Documentos',      tipo: 'documento'  },
    { key: 'evidencia_entrevistas', label: 'Entrevistas',      tipo: 'entrevista' },
    { key: 'evidencia_campo',       label: 'Recorrido de Campo', tipo: 'recorrido'  },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {cols.map(({ key, label, tipo }) => {
        const items = pregunta[key] || [];
        const cfg   = ICONOS_EVIDENCIA[tipo];
        return (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <span className="text-xs text-gray-400 ml-auto">{items.length}</span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin evidencias</p>
            ) : (
              <div className="space-y-2">
                {items.slice(0, 3).map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => onAbrirEvidencia(ev.tipo, ev.id)}
                    className="w-full text-left p-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 truncate">{ev.fuente}</span>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-500 shrink-0" />
                    </div>
                    {ev.fragmento && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {ev.fragmento.substring(0, 120)}…
                      </p>
                    )}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{items.length - 3} más
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Formulario de validación HITL ───────────────────────────────────────────
function FormularioValidacion({
  calificacionIA, calificacion, criterio, justificacion,
  onCalificacionChange, onCriterioChange, onJustificacionChange,
  onGuardar, onCancelar, validando, requiereJustificacion,
}) {
  return (
    <div className="space-y-4">
      {/* Comparación IA ↔ Experto */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg text-sm">
        <span className="text-gray-600">
          Sugerencia IA: <strong className="text-blue-700">{calificacionIA || 'Sin calificación'}</strong>
        </span>
        <span className="text-gray-400">→</span>
        <span className="text-gray-600">Tu decisión:</span>
        <select
          value={calificacion}
          onChange={e => onCalificacionChange(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Aceptar sugerencia IA</option>
          <option value="Suficiente">Suficiente</option>
          <option value="Escasa">Escasa</option>
          <option value="Al menos una">Al menos una</option>
          <option value="No hay evidencia">No hay evidencia</option>
        </select>
      </div>

      {/* Criterio profesional — obligatorio si difiere de IA */}
      {requiereJustificacion && (
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
            Criterio Profesional <span className="text-red-500">*</span>
          </label>
          <textarea
            value={criterio}
            onChange={e => onCriterioChange(e.target.value)}
            rows={4}
            placeholder="Describe el razonamiento técnico, normativa aplicable y evidencia que sustenta esta decisión…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Soporta Markdown.</p>
        </div>
      )}

      {/* Notas adicionales — siempre opcionales */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          Notas adicionales <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          value={justificacion}
          onChange={e => onJustificacionChange(e.target.value)}
          rows={2}
          placeholder="Referencias cruzadas, observaciones complementarias…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          onClick={onCancelar}
          disabled={validando}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onGuardar}
          disabled={validando || (requiereJustificacion && !criterio.trim())}
          className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {validando && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          <Save className="w-4 h-4" />
          Guardar validación
        </button>
      </div>
    </div>
  );
}

// ── Resumen de validación ───────────────────────────────────────────────────
function ResumenValidacion({ pregunta, calificacionLocal, criterioLocal }) {
  if (!pregunta.validado_en) {
    return (
      <div className="text-center py-4 text-gray-500">
        <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Pendiente de validación experta</p>
      </div>
    );
  }

  const calFinal = calificacionLocal || pregunta.sugerencia_ia || 'No hay evidencia';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <CalificacionBadge calificacion={calFinal} esIA={false} />
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          {new Date(pregunta.validado_en).toLocaleString('es-CO')}
        </div>
      </div>

      {criterioLocal && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Criterio Profesional</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{criterioLocal}</p>
        </div>
      )}

      {pregunta.override_justificacion && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Notas Adicionales</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {pregunta.override_justificacion}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Drawer lateral de evidencia ─────────────────────────────────────────────
function EvidenciaDrawer({ data, onClose }) {
  const cfg = ICONOS_EVIDENCIA[data.tipo] || ICONOS_EVIDENCIA['documento'];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header drawer */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cfg.bg}`}>
              <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 capitalize">{data.tipo}</h3>
              <p className="text-xs text-gray-500">Fragmento de evidencia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-auto p-6">
          <ContenidoEvidencia data={data} />
        </div>
      </div>
    </div>
  );
}

// ── Contenido del drawer según tipo ────────────────────────────────────────
function ContenidoEvidencia({ data }) {
  const ev = data.evidencia;
  if (!ev) return <p className="text-gray-500 text-sm">No se pudo cargar el detalle.</p>;

  const seccion = (titulo, contenido, estilo = 'bg-gray-50') => (
    <div>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h4>
      <div className={`rounded-lg border border-gray-200 p-4 ${estilo} max-h-72 overflow-auto`}>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
          {contenido}
        </pre>
      </div>
    </div>
  );

  const metaDatos = {
    documento:  [['Archivo', ev.nombre_original], ['Categoría', ev.categoria]],
    entrevista: [['Participante', ev.participante], ['Cargo', ev.cargo], ['Duración', `${Math.floor((ev.duracion_seg || 0) / 60)} min`]],
    recorrido:  [['Área', ev.area], ['Categoría', ev.categoria]],
  }[data.tipo] || [];

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
        {metaDatos.map(([k, v]) => (
          <p key={k} className="text-sm">
            <span className="font-semibold text-gray-600">{k}: </span>
            <span className="text-gray-800">{v || '—'}</span>
          </p>
        ))}
        {ev.created_at && (
          <p className="text-sm">
            <span className="font-semibold text-gray-600">Fecha: </span>
            <span className="text-gray-800">{new Date(ev.created_at).toLocaleDateString('es-CO')}</span>
          </p>
        )}
      </div>

      {/* Texto / transcripción / observación */}
      {(ev.texto_extraido || ev.transcripcion || ev.observacion) &&
        seccion(
          data.tipo === 'documento' ? 'Texto extraído' : data.tipo === 'entrevista' ? 'Transcripción' : 'Observación',
          (ev.texto_extraido || ev.transcripcion || ev.observacion || '').substring(0, 3000),
          'bg-white'
        )
      }

      {/* Hallazgo (sólo recorrido) */}
      {ev.hallazgo && seccion('Hallazgo registrado', ev.hallazgo, 'bg-yellow-50')}

      {/* Análisis IA */}
      {ev.analisis_ia && seccion('Análisis de IA', ev.analisis_ia, 'bg-blue-50')}
    </div>
  );
}
