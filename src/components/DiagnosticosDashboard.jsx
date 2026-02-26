import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, ChevronRight, FileText, Filter, RefreshCw, Trash2, AlertTriangle,
  Shield, Gavel, BarChart2, Target, Network, DollarSign, ChevronDown, ChevronUp,
  MessageSquare, Plus, Brain, Download, AlertCircle, TrendingUp, TrendingDown,
  CheckSquare, Clock, Loader2, Sparkles,
} from 'lucide-react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// ─── Configuración de fases ───────────────────────────────────────────────────
const FASES = [
  { paso: 1, label: 'Clasificación' },
  { paso: 2, label: 'Cuestionario'  },
  { paso: 3, label: 'Documentos'    },
  { paso: 4, label: 'Recorrido'     },
  { paso: 5, label: 'Entrevistas'   },
  { paso: 6, label: 'Validación'    },
];

function estadoAPaso(estado) {
  const map = {
    Configuracion: 1, Carga: 2, Recorrido: 3, Entrevistas: 4, Validacion: 5, Finalizado: 6,
    Borrador: 2, 'En Validación': 5, Aprobado: 6,
  };
  return map[estado] ?? 1;
}

function esFinalizado(estado) {
  return estado === 'Finalizado' || estado === 'Aprobado';
}

// ─── Badges de nivel ──────────────────────────────────────────────────────────
const NIVEL_COLORS = {
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-blue-100  text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100   text-red-700',
};
const NIVEL_LABELS = { 1: 'Exploratorio', 2: 'Básico', 3: 'Estándar', 4: 'Avanzado', 5: 'Crítico' };

function NivelBadge({ nivel }) {
  if (!nivel) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${NIVEL_COLORS[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
      N{nivel} · {NIVEL_LABELS[nivel] ?? '?'}
    </span>
  );
}

// ─── Progress timeline ────────────────────────────────────────────────────────
function ProgressTimeline({ paso }) {
  const pct = Math.round(((Math.min(paso, 6) - 1) / 5) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {FASES.map(({ paso: p, label }) => {
          const done = p < paso; const current = p === paso;
          return (
            <div key={p} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done    ? 'bg-green-500 border-green-500 text-white'
                : current ? 'bg-white border-green-500 text-green-600'
                :           'bg-white border-gray-200 text-gray-400'}`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : p}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block leading-tight text-center
                ${done ? 'text-green-600' : current ? 'text-green-700' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
        <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Panel de análisis IA ─────────────────────────────────────────────────────
const RIESGO_COLORS = {
  Crítico: 'text-red-700 bg-red-50 border-red-200',
  Alto:    'text-orange-700 bg-orange-50 border-orange-200',
  Medio:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  Bajo:    'text-green-700 bg-green-50 border-green-200',
};

function PanelAnalisisIA({ diagnosticoId, analisisInicial, onFinalizar }) {
  const [analisis,    setAnalisis]    = useState(analisisInicial);
  const [cargando,    setCargando]    = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error,       setError]       = useState('');

  async function generarAnalisis() {
    setCargando(true);
    setError('');
    try {
      const data = await apiService.finalizarDiagnostico(diagnosticoId);
      setAnalisis(data.analisis);
      onFinalizar && onFinalizar(diagnosticoId, data.analisis);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function descargar() {
    setDescargando(true);
    try { await apiService.descargarReporte(diagnosticoId); }
    catch (err) { alert(`Error: ${err.message}`); }
    finally { setDescargando(false); }
  }

  // Sin análisis aún — mostrar CTA
  if (!analisis) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-dashed border-blue-200 bg-blue-50 text-center">
        <Brain className="w-8 h-8 text-blue-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-blue-800 mb-1">Análisis IA pendiente</p>
        <p className="text-xs text-blue-600 mb-3">
          Genera el análisis ejecutivo con todas las no conformidades y el plan de acción.
        </p>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button
          onClick={generarAnalisis}
          disabled={cargando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
        >
          {cargando
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando con IA…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Generar Análisis IA</>
          }
        </button>
      </div>
    );
  }

  // Con análisis — mostrar resultados
  const puntaje     = analisis.puntaje_global ?? 0;
  const nivelRiesgo = analisis.nivel_riesgo_general ?? 'Medio';
  const colorPuntaje = puntaje >= 75 ? 'text-green-600' : puntaje >= 50 ? 'text-yellow-600' : 'text-red-600';
  const bgPuntaje    = puntaje >= 75 ? 'bg-green-50 border-green-200' : puntaje >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="mt-4 space-y-4">
      {/* Header con puntaje */}
      <div className={`flex items-center justify-between p-4 rounded-xl border ${bgPuntaje}`}>
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-blue-600" />
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Análisis IA — Resultado Final</p>
            <p className={`text-2xl font-black ${colorPuntaje}`}>{puntaje}% cumplimiento</p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${RIESGO_COLORS[nivelRiesgo] ?? RIESGO_COLORS.Medio}`}>
          Riesgo {nivelRiesgo}
        </div>
      </div>

      {/* Diagnóstico general */}
      {analisis.diagnostico_general && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <BarChart2 className="w-3 h-3" /> Diagnóstico General
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{analisis.diagnostico_general}</p>
        </div>
      )}

      {/* Hallazgos críticos */}
      {analisis.hallazgos_criticos?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-500" /> Hallazgos Críticos ({analisis.hallazgos_criticos.length})
          </p>
          <div className="space-y-2">
            {analisis.hallazgos_criticos.map((h, i) => (
              <div key={i} className={`p-3 rounded-lg border ${RIESGO_COLORS[h.riesgo] ?? RIESGO_COLORS.Medio}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{h.elemento}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60">{h.riesgo}</span>
                </div>
                <p className="text-xs leading-relaxed">{h.descripcion}</p>
                {h.impacto && <p className="text-[11px] mt-1 opacity-80">Impacto: {h.impacto}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brechas normativas */}
      {analisis.brechas_normativas?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <Gavel className="w-3 h-3 text-red-500" /> Brechas Normativas
          </p>
          <ul className="space-y-1">
            {analisis.brechas_normativas.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg p-2">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fortalezas */}
      {analisis.fortalezas?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" /> Fortalezas Identificadas
          </p>
          <ul className="space-y-1">
            {analisis.fortalezas.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg p-2">
                <CheckSquare className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan de acción */}
      {analisis.plan_accion?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <Target className="w-3 h-3 text-blue-500" /> Plan de Acción Prioritario
          </p>
          <div className="space-y-2">
            {analisis.plan_accion.map((p, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  {p.prioridad ?? i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-900 leading-relaxed">{p.accion}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {p.plazo && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                        <Clock className="w-2.5 h-2.5" /> {p.plazo}
                      </span>
                    )}
                    {p.responsable && (
                      <span className="text-[10px] text-blue-500">{p.responsable}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conclusión */}
      {analisis.conclusion && (
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Conclusión del Auditor IA</p>
          <p className="text-sm text-gray-100 leading-relaxed">{analisis.conclusion}</p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={generarAnalisis}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Regenerar
        </button>
        <button
          onClick={descargar}
          disabled={descargando}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
        >
          {descargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Descargar Word
        </button>
      </div>
    </div>
  );
}

// ─── Perfil de clasificación Fase 1 ──────────────────────────────────────────
const DIM_META = [
  { key: 'riesgo_tecnico',  comentKey: 'comentarios_riesgo',     label: 'Riesgo Técnico',        Icon: Shield     },
  { key: 'regulacion',      comentKey: 'comentarios_regulacion', label: 'Regulación',            Icon: Gavel      },
  { key: 'madurez',         comentKey: 'comentarios_madurez',    label: 'Madurez SGS',           Icon: BarChart2  },
  { key: 'estrategia',      comentKey: 'comentarios_estrategia', label: 'Estrategia',            Icon: Target     },
  { key: 'complejidad',     comentKey: 'comentarios_complejidad',label: 'Complejidad',           Icon: Network    },
  { key: 'exposicion',      comentKey: 'comentarios_exposicion', label: 'Exposición Financiera', Icon: DollarSign },
];
const NIVEL_VAL_LABELS = { 1: 'Bajo', 2: 'Medio', 3: 'Alto', 4: 'Crítico' };
const VAL_COLORS = {
  1: 'text-green-700 bg-green-50 border-green-100',
  2: 'text-amber-700 bg-amber-50 border-amber-100',
  3: 'text-orange-700 bg-orange-50 border-orange-100',
  4: 'text-red-700 bg-red-50 border-red-100',
};

function PerfilClasificacion({ dataSetup }) {
  if (!dataSetup) return null;
  const tieneJustif = DIM_META.some(d => dataSetup[d.comentKey]);
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        <MessageSquare className="w-3 h-3" /> Perfil de Clasificación — Fase 1
      </p>
      {DIM_META.map(({ key, comentKey, label, Icon }) => {
        const val = dataSetup[key]; const coment = dataSetup[comentKey];
        if (!val) return null;
        return (
          <div key={key} className={`rounded-lg border px-2.5 py-2 ${VAL_COLORS[val] ?? 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 opacity-60 shrink-0" />
              <span className="text-[11px] font-medium flex-1">{label}</span>
              <span className="text-[10px] font-bold">{NIVEL_VAL_LABELS[val] ?? val}</span>
            </div>
            {coment && <p className="mt-1 ml-4 text-[11px] text-gray-600 leading-relaxed">{coment}</p>}
          </div>
        );
      })}
      {!tieneJustif && <p className="text-[11px] text-gray-400 mt-1 ml-1">Sin justificaciones documentadas.</p>}
    </div>
  );
}

// ─── Tarjeta diagnóstico EN CURSO ─────────────────────────────────────────────
function DiagnosticoCard({ diag, onContinuar, onEliminar }) {
  const paso       = diag.paso_actual ?? estadoAPaso(diag.estado);
  const finalizado = esFinalizado(diag.estado);
  const titulo     = diag.planta_nombre
    ? `${diag.planta_nombre}${diag.area_nombre ? ' / ' + diag.area_nombre : ''}`
    : `Diagnóstico #${diag.id}`;
  const [confirmar, setConfirmar] = useState(false);
  const [borrando,  setBorrando]  = useState(false);

  async function handleEliminar() {
    setBorrando(true);
    try { await onEliminar(diag.id); }
    finally { setBorrando(false); setConfirmar(false); }
  }

  return (
    <div className={`rounded-xl border p-4 bg-white transition-shadow hover:shadow-md ${finalizado ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{titulo}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Creado {new Date(diag.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <NivelBadge nivel={diag.nivel_calculado} />
          {!finalizado && !confirmar && (
            <button type="button" onClick={() => setConfirmar(true)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {confirmar && !finalizado && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-semibold">¿Eliminar este diagnóstico?</p>
          </div>
          <p className="text-[11px] text-red-600 mb-3">Acción irreversible. Se borran todas las respuestas y progreso.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmar(false)} disabled={borrando}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={handleEliminar} disabled={borrando}
              className="flex-1 px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60">
              {borrando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}

      <ProgressTimeline paso={finalizado ? 6 : paso} />

      {diag.data_setup && (
        <PerfilClasificacionCard dataSetup={diag.data_setup} />
      )}

      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          finalizado ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {finalizado ? '✓ Finalizado' : `Fase ${paso}: ${FASES.find(f => f.paso === paso)?.label ?? '—'}`}
        </span>
        <button type="button" onClick={() => onContinuar(diag)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            finalizado
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
          }`}>
          {finalizado ? <><FileText className="w-3.5 h-3.5" /> Ver</>
                      : <><ChevronRight className="w-3.5 h-3.5" /> Continuar</>}
        </button>
      </div>
    </div>
  );
}

function PerfilClasificacionCard({ dataSetup }) {
  const [abierto, setAbierto] = useState(false);
  const tieneJustif = DIM_META.some(d => dataSetup[d.comentKey]);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setAbierto(p => !p)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
          tieneJustif ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}>
        <MessageSquare className="w-3 h-3" />
        <span className="flex-1 text-left">{tieneJustif ? 'Ver perfil con justificaciones' : 'Ver perfil de clasificación'}</span>
        {abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {abierto && <PerfilClasificacion dataSetup={dataSetup} />}
    </div>
  );
}

// ─── Fila del HISTÓRICO expandible ──────────────────────────────────────────
function HistoricoRow({ d, onContinuar, onActualizar }) {
  const [expandido,   setExpandido]   = useState(false);
  const [analisis,    setAnalisis]    = useState(d.analisis_final_ia ?? null);
  const [cargandoAI,  setCargandoAI]  = useState(false);
  const dataSetup = d.data_setup ?? null;

  // Cargar análisis desde API la primera vez que se expande
  async function handleExpandir() {
    const abriendo = !expandido;
    setExpandido(abriendo);
    if (abriendo && !analisis) {
      setCargandoAI(true);
      try {
        const data = await apiService.fetchAnalisisDiagnostico(d.id);
        if (data?.analisis) setAnalisis(data.analisis);
      } catch { /* silencioso */ }
      finally { setCargandoAI(false); }
    }
  }

  const puntaje     = analisis?.puntaje_global ?? d.puntuacion;
  const nivelRiesgo = analisis?.nivel_riesgo_general;
  const colorPunt   = puntaje >= 75 ? 'text-green-600' : puntaje >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <>
      {/* Fila principal */}
      <tr className="hover:bg-gray-50/60 transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="font-semibold text-gray-800">
              {d.planta_nombre ?? `Diagnóstico #${d.id}`}
              {d.area_nombre && <span className="text-gray-400 font-normal"> / {d.area_nombre}</span>}
            </p>
            <p className="text-xs text-gray-400">
              Iniciado {new Date(d.created_at).toLocaleDateString('es-CO')}
            </p>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {d.analisis_generado_en
            ? new Date(d.analisis_generado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            : d.fecha_cierre
              ? new Date(d.fecha_cierre).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
        </td>
        <td className="px-4 py-3 text-center">
          <NivelBadge nivel={d.nivel_calculado} />
        </td>
        <td className="px-4 py-3 text-center">
          {puntaje != null
            ? <span className={`font-bold text-sm ${colorPunt}`}>{puntaje}%</span>
            : <span className="text-gray-400 text-sm">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{d.consultor_nombre ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {/* Botón expandir análisis IA */}
            <button type="button" onClick={handleExpandir}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                expandido
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}>
              <Brain className="w-3.5 h-3.5" />
              {cargandoAI ? 'Cargando…' : expandido ? 'Ocultar' : 'Ver Análisis'}
              {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {/* Botón descargar */}
            <button type="button" onClick={() => apiService.descargarReporte(d.id).catch(e => alert(e.message))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700">
              <Download className="w-3.5 h-3.5" /> Word
            </button>
          </div>
        </td>
      </tr>

      {/* Fila expandida — Análisis IA completo */}
      {expandido && (
        <tr className="bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <td colSpan={6} className="px-6 pb-6 pt-2">
            {cargandoAI ? (
              <div className="flex items-center gap-2 py-6 text-sm text-blue-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando análisis de inteligencia artificial…
              </div>
            ) : (
              <PanelAnalisisIA
                diagnosticoId={d.id}
                analisisInicial={analisis}
                onFinalizar={(_, newAnalisis) => {
                  setAnalisis(newAnalisis);
                  onActualizar && onActualizar(d.id);
                }}
              />
            )}
            {/* Perfil de clasificación al final */}
            {dataSetup && (
              <div className="mt-4">
                <PerfilClasificacionCard dataSetup={dataSetup} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DiagnosticosDashboard({ onContinuar, onNuevoDiagnostico, ocultarBotonNuevo = false }) {
  const { usuario } = useAuth();
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [plantas,      setPlantas]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroPl,     setFiltroPl]     = useState('');
  const [filtroAr,     setFiltroAr]     = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.fetchDiagnosticos();
      setDiagnosticos(data);
    } catch { setDiagnosticos([]); }
    finally { setLoading(false); }
  }, []);

  async function handleEliminar(id) {
    try {
      await apiService.deleteDiagnostico(id);
      setDiagnosticos(prev => prev.filter(d => d.id !== id));
    } catch (e) { alert('Error al eliminar: ' + (e.message ?? 'Intenta de nuevo.')); }
  }

  function handleActualizarDiag(id) {
    // Refresca solo el diagnóstico actualizado
    apiService.fetchDiagnosticos().then(data => setDiagnosticos(data)).catch(() => {});
  }

  useEffect(() => {
    cargar();
    apiService.fetchHierarchy().then(({ plantas = [] }) => setPlantas(plantas)).catch(() => {});
  }, [cargar]);

  const enCurso   = diagnosticos.filter(d => !esFinalizado(d.estado));
  const historico = diagnosticos.filter(d =>  esFinalizado(d.estado));

  const historicoFiltrado = historico.filter(d => {
    if (filtroPl && String(d.planta_id) !== filtroPl) return false;
    if (filtroAr && String(d.area_id)   !== filtroAr) return false;
    return true;
  });

  const areasDeFiltroPl = filtroPl
    ? diagnosticos
        .filter(d => esFinalizado(d.estado) && String(d.planta_id) === filtroPl && d.area_id)
        .map(d => ({ id: d.area_id, nombre: d.area_nombre }))
        .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    : [];

  return (
    <div className="mt-10 space-y-10">

      {/* ─── Encabezado con botón Nuevo Diagnóstico ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {diagnosticos.length} diagnóstico{diagnosticos.length !== 1 ? 's' : ''} registrado{diagnosticos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={cargar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          {!ocultarBotonNuevo && (
            <button
              type="button"
              onClick={onNuevoDiagnostico}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Nuevo Diagnóstico
            </button>
          )}
        </div>
      </div>

      {/* ─── En Curso ────────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-base font-semibold text-gray-700 mb-3">
          En Progreso
          {enCurso.length > 0 && (
            <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {enCurso.length}
            </span>
          )}
        </h4>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : enCurso.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No tienes diagnósticos en progreso.</p>
            <button
              type="button"
              onClick={onNuevoDiagnostico}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" /> Iniciar un nuevo diagnóstico
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enCurso.map(d => (
              <DiagnosticoCard key={d.id} diag={d} onContinuar={onContinuar} onEliminar={handleEliminar} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Histórico ───────────────────────────────────────────────────── */}
      {(historico.length > 0 || !loading) && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h4 className="text-base font-semibold text-gray-700">
                Diagnósticos Finalizados
                {historico.length > 0 && (
                  <span className="ml-2 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    {historico.length}
                  </span>
                )}
              </h4>
              <p className="text-xs text-gray-400">Haz clic en "Ver Análisis" para desplegar el informe de IA.</p>
            </div>
          </div>

          {historico.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-100 bg-gray-50/50 py-8 text-center">
              <p className="text-sm text-gray-400">Los diagnósticos finalizados aparecerán aquí.</p>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                <select value={filtroPl} onChange={e => { setFiltroPl(e.target.value); setFiltroAr(''); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Todas las plantas</option>
                  {plantas.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                </select>
                {areasDeFiltroPl.length > 0 && (
                  <select value={filtroAr} onChange={e => setFiltroAr(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Todas las áreas</option>
                    {areasDeFiltroPl.map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
                  </select>
                )}
                {(filtroPl || filtroAr) && (
                  <button onClick={() => { setFiltroPl(''); setFiltroAr(''); }}
                    className="text-xs text-gray-400 hover:text-gray-700 underline">Limpiar</button>
                )}
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Diagnóstico</th>
                      <th className="px-4 py-3 text-left">Fecha Cierre</th>
                      <th className="px-4 py-3 text-center">Nivel</th>
                      <th className="px-4 py-3 text-center">Puntaje</th>
                      <th className="px-4 py-3 text-left">Consultor</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historicoFiltrado.map(d => (
                      <HistoricoRow
                        key={d.id}
                        d={d}
                        onContinuar={onContinuar}
                        onActualizar={handleActualizarDiag}
                      />
                    ))}
                    {historicoFiltrado.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                          No hay diagnósticos con ese filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
