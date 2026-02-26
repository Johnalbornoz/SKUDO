import { useState, useEffect } from 'react';
import {
  Sparkles, AlertTriangle, TrendingUp, TrendingDown, Shield, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Clock, Users, Leaf, Building2,
  Scale, AlertCircle, CheckCircle2, Zap, Target, Activity, Eye,
  ArrowRight, Trash2, BarChart3, Info,
} from 'lucide-react';
import apiService from '../services/apiService';

// ─── Configuración de alertas ─────────────────────────────────────────────────
const ALERTA_CFG = {
  Rojo:     { color: 'text-red-700',    bg: 'bg-red-600',      light: 'bg-red-50',    border: 'border-red-300',    label: 'RIESGO CRÍTICO',  min: 80 },
  Naranja:  { color: 'text-orange-700', bg: 'bg-orange-500',   light: 'bg-orange-50', border: 'border-orange-300', label: 'RIESGO ALTO',     min: 60 },
  Amarillo: { color: 'text-yellow-700', bg: 'bg-yellow-500',   light: 'bg-yellow-50', border: 'border-yellow-300', label: 'RIESGO MODERADO', min: 30 },
  Verde:    { color: 'text-green-700',  bg: 'bg-green-500',    light: 'bg-green-50',  border: 'border-green-300',  label: 'RIESGO BAJO',     min: 0  },
};

const CRIT_CFG = {
  Crítico: { color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500'    },
  Alto:    { color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  Medio:   { color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  Bajo:    { color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
};

const PROB_COLOR = {
  'Muy Alta':  'text-red-700   bg-red-100',
  'Alta':      'text-orange-700 bg-orange-100',
  'Moderada':  'text-yellow-700 bg-yellow-100',
  'Baja':      'text-green-700  bg-green-100',
};

// ─── Gauge de Índice de Riesgo ─────────────────────────────────────────────────
function GaugeRiesgo({ indice, nivelAlerta }) {
  const cfg   = ALERTA_CFG[nivelAlerta] || ALERTA_CFG.Amarillo;
  const angle = (indice / 100) * 180 - 90; // -90° a +90°
  const color = nivelAlerta === 'Rojo' ? '#dc2626'
    : nivelAlerta === 'Naranja' ? '#ea580c'
    : nivelAlerta === 'Amarillo' ? '#d97706'
    : '#16a34a';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Arco de fondo */}
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#16a34a" />
              <stop offset="33%"  stopColor="#d97706" />
              <stop offset="66%"  stopColor="#ea580c" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          {/* Arco completo degradado */}
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" />
          {/* Aguja */}
          <g transform={`rotate(${angle}, 100, 100)`}>
            <line x1="100" y1="100" x2="100" y2="20" stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill={color} />
          </g>
          {/* Marcas */}
          {[0, 25, 50, 75, 100].map(v => {
            const a = (v / 100) * 180 - 90;
            const r = Math.PI * a / 180;
            const x = 100 + 80 * Math.cos(r - Math.PI / 2);
            const y = 100 + 80 * Math.sin(r - Math.PI / 2);
            return <circle key={v} cx={x} cy={y} r="2" fill="#9ca3af" />;
          })}
        </svg>
      </div>
      <div className="text-center -mt-2">
        <p style={{ color }} className="text-4xl font-black">{indice}</p>
        <p className="text-xs text-gray-500 font-medium">/ 100</p>
        <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-bold ${cfg.light} ${cfg.color} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Barra de proyección temporal ────────────────────────────────────────────
function ProyeccionTemporal({ datos }) {
  if (!datos) return null;
  const { hoy = 0, dias_30 = 0, dias_60 = 0, dias_90 = 0 } = datos;
  const puntos = [
    { label: 'Hoy',    valor: hoy    },
    { label: '30 días', valor: dias_30 },
    { label: '60 días', valor: dias_60 },
    { label: '90 días', valor: dias_90 },
  ];
  const max = Math.max(...puntos.map(p => p.valor), 100);

  const colorBarra = (v) =>
    v >= 80 ? 'bg-red-500' : v >= 60 ? 'bg-orange-500' : v >= 30 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        Proyección de Riesgo si No Se Actúa
      </p>
      {puntos.map(({ label, valor }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-14 text-right shrink-0">{label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colorBarra(valor)} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
              style={{ width: `${(valor / max) * 100}%` }}
            >
              {valor > 15 && <span className="text-white text-[10px] font-black">{valor}</span>}
            </div>
          </div>
          {valor <= 15 && <span className="text-xs font-bold text-gray-600 w-6">{valor}</span>}
        </div>
      ))}
      <p className="text-[11px] text-gray-400 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Escenario de no acción. Implementar las correcciones reduce significativamente estos valores.
      </p>
    </div>
  );
}

// ─── Card de Escenario de Incumplimiento ─────────────────────────────────────
function EscenarioCard({ escenario, index }) {
  const [expandido, setExpandido] = useState(index === 0);
  const cfg     = CRIT_CFG[escenario.criticidad] || CRIT_CFG.Medio;
  const probCfg = PROB_COLOR[escenario.probabilidad_ocurrencia] || 'text-gray-600 bg-gray-100';

  const consecuencias = [
    { icon: Users,     key: 'personas',   label: 'Personas'  },
    { icon: Leaf,      key: 'ambiente',   label: 'Ambiente'  },
    { icon: Building2, key: 'activos',    label: 'Activos'   },
    { icon: Scale,     key: 'reputacion', label: 'Legal/Rep' },
  ];

  return (
    <div className={`rounded-xl border-2 ${cfg.bg} ${
      escenario.criticidad === 'Crítico' ? 'border-red-200' :
      escenario.criticidad === 'Alto'    ? 'border-orange-200' :
      escenario.criticidad === 'Medio'   ? 'border-yellow-200' : 'border-green-200'
    } overflow-hidden`}>
      {/* Header del escenario */}
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-start justify-between p-5 text-left"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${cfg.bg} border-2 ${
            escenario.criticidad === 'Crítico' ? 'border-red-300 text-red-700' :
            escenario.criticidad === 'Alto' ? 'border-orange-300 text-orange-700' :
            escenario.criticidad === 'Medio' ? 'border-yellow-300 text-yellow-700' :
            'border-green-300 text-green-700'}`}>
            {escenario.id || `E${index+1}`}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-sm">{escenario.titulo}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${probCfg}`}>
                {escenario.probabilidad_ocurrencia}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {escenario.elemento_psm && <span className="font-medium">{escenario.elemento_psm}</span>}
              {escenario.tiempo_materializacion && <span className="ml-2">· {escenario.tiempo_materializacion}</span>}
            </p>
          </div>
        </div>
        {expandido ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
      </button>

      {/* Cuerpo expandido */}
      {expandido && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/50">
          {/* Acción incumplida */}
          {escenario.accion_incumplida && (
            <div className="flex items-start gap-2 p-3 bg-white/70 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Acción no cumplida que activa este escenario</p>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{escenario.accion_incumplida}</p>
              </div>
            </div>
          )}

          {/* Cadena de fallos */}
          {escenario.cadena_fallos?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Cadena de Fallos
              </p>
              <div className="space-y-1">
                {escenario.cadena_fallos.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {i < escenario.cadena_fallos.length - 1
                      ? <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                    <p className="text-xs text-gray-700">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consecuencias */}
          {escenario.consecuencias && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Consecuencias Potenciales</p>
              <div className="grid grid-cols-2 gap-2">
                {consecuencias.map(({ icon: Icon, key, label }) => (
                  escenario.consecuencias[key] && (
                    <div key={key} className="bg-white/70 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-snug">{escenario.consecuencias[key]}</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Normativa */}
          {escenario.normativa_incumplida?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Normativa que quedaría incumplida</p>
              <div className="flex flex-wrap gap-1.5">
                {escenario.normativa_incumplida.map((n, i) => (
                  <span key={i} className="text-xs text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Acción de emergencia */}
          {escenario.accion_emergencia && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Shield className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-green-700 uppercase">Acción Inmediata Recomendada</p>
                <p className="text-xs text-green-800 mt-0.5">{escenario.accion_emergencia}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vista de historial de pronósticos ───────────────────────────────────────
function HistorialPronosticos({ historico, onSeleccionar, onEliminar, onNuevo, generando }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700">Pronósticos Generados</p>
        <button onClick={onNuevo} disabled={generando}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60">
          {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Nuevo Análisis
        </button>
      </div>
      {historico.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin pronósticos anteriores.</p>
      ) : (
        historico.map(p => {
          const cfg     = ALERTA_CFG[p.nivel_alerta] || ALERTA_CFG.Amarillo;
          const indice  = typeof p.indice_riesgo === 'string' ? JSON.parse(p.indice_riesgo) : p.indice_riesgo;
          return (
            <div key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all ${cfg.light} ${cfg.border}`}
              onClick={() => onSeleccionar(p.id)}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white ${cfg.bg} shrink-0`}>
                {indice ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{p.nombre}</p>
                <p className="text-[10px] text-gray-500">
                  {new Date(p.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  {p.total_acciones && <span className="ml-2">· {p.total_acciones} acciones</span>}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); onEliminar(p.id); }}
                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PaginaPronostico() {
  const [analisis,    setAnalisis]    = useState(null);
  const [historico,   setHistorico]   = useState([]);
  const [generando,   setGenerando]   = useState(false);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const [pronosticoId, setPronosticoId] = useState(null);

  useEffect(() => { cargarHistorico(); }, []);

  async function cargarHistorico() {
    try {
      const data = await apiService.fetchPronosticos();
      setHistorico(data);
      if (data.length > 0 && !analisis) {
        await cargarPronostico(data[0].id);
      }
    } catch { setHistorico([]); }
  }

  async function cargarPronostico(id) {
    setCargando(true);
    try {
      const data = await apiService.fetchPronostico(id);
      const ia = typeof data.analisis_ia === 'string' ? JSON.parse(data.analisis_ia) : data.analisis_ia;
      setAnalisis(ia);
      setPronosticoId(id);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }

  async function handleGenerar() {
    setGenerando(true);
    setError('');
    try {
      const data = await apiService.generarPronostico();
      setAnalisis(data.analisis);
      setPronosticoId(data.pronostico_id);
      await cargarHistorico();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  }

  async function handleEliminar(id) {
    await apiService.eliminarPronostico(id);
    if (pronosticoId === id) { setAnalisis(null); setPronosticoId(null); }
    await cargarHistorico();
  }

  const cfg         = analisis ? (ALERTA_CFG[analisis.nivel_alerta] || ALERTA_CFG.Amarillo) : null;
  const escenarios  = analisis?.escenarios_incumplimiento || [];
  const criticos    = escenarios.filter(e => e.criticidad === 'Crítico').length;
  const altos       = escenarios.filter(e => e.criticidad === 'Alto').length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header sticky ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-8 lg:px-10 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl">
                <Activity className="w-6 h-6 text-violet-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gemelo Digital — Pronóstico PSM</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Simulación de escenarios de riesgo por incumplimiento de acciones correctivas
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerar}
              disabled={generando}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm transition-colors disabled:opacity-60"
            >
              {generando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando…</>
                : <><Sparkles className="w-4 h-4" /> Generar Pronóstico IA</>}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 lg:px-10 py-8">

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Error al generar el pronóstico</p>
              <p className="text-sm mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* ── Spinner de carga ─────────────────────────────────────────────── */}
        {(generando || cargando) && !analisis && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" />
              <Sparkles className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="mt-4 text-gray-600 font-semibold">
              {generando ? 'Construyendo el Gemelo Digital…' : 'Cargando análisis…'}
            </p>
            <p className="text-sm text-gray-400 mt-1">La IA está modelando escenarios de incumplimiento</p>
          </div>
        )}

        {/* ── Sin datos ─────────────────────────────────────────────────────── */}
        {!generando && !cargando && !analisis && !error && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 bg-violet-50 rounded-2xl mb-4">
              <Activity className="w-12 h-12 text-violet-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Gemelo Digital no generado</h2>
            <p className="text-gray-500 text-sm max-w-md text-center mb-6 leading-relaxed">
              Genera el primer pronóstico para ver qué ocurriría en la planta si las acciones correctivas del Plan de Acción no se cumplen en sus plazos.
            </p>
            <button
              onClick={handleGenerar}
              disabled={generando}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm"
            >
              <Sparkles className="w-5 h-5" /> Generar Primer Pronóstico
            </button>
          </div>
        )}

        {/* ── Dashboard del Gemelo Digital ───────────────────────────────── */}
        {analisis && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

            {/* Columna lateral izquierda — historial */}
            <div className="xl:col-span-1 space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <HistorialPronosticos
                  historico={historico}
                  onSeleccionar={cargarPronostico}
                  onEliminar={handleEliminar}
                  onNuevo={handleGenerar}
                  generando={generando}
                />
              </div>
            </div>

            {/* Columna principal */}
            <div className="xl:col-span-3 space-y-6">

              {/* Gauge + métricas */}
              <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.light} p-6`}>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Gauge */}
                  <GaugeRiesgo
                    indice={analisis.indice_riesgo_global}
                    nivelAlerta={analisis.nivel_alerta}
                  />

                  {/* Resumen y métricas */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Resumen Ejecutivo
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {analisis.resumen_ejecutivo}
                      </p>
                    </div>

                    {/* Contadores de escenarios */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                        <span className="text-gray-600">{criticos} escenario{criticos !== 1 ? 's' : ''} crítico{criticos !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                        <span className="text-gray-600">{altos} escenario{altos !== 1 ? 's' : ''} alto{altos !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-gray-600">{escenarios.length} total</span>
                      </div>
                    </div>

                    {/* Recomendación urgente */}
                    {analisis.recomendacion_urgente && (
                      <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-amber-600 uppercase">Acción Más Urgente</p>
                          <p className="text-sm text-gray-800 mt-0.5 font-medium">{analisis.recomendacion_urgente}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Proyección temporal */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <ProyeccionTemporal datos={analisis.proyeccion_riesgo} />
              </div>

              {/* Escenarios de incumplimiento */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-violet-600" />
                  Escenarios de Incumplimiento — Gemelo Digital
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    ({escenarios.length} escenario{escenarios.length !== 1 ? 's' : ''} modelado{escenarios.length !== 1 ? 's' : ''})
                  </span>
                </h3>
                <div className="space-y-3">
                  {escenarios.map((e, i) => (
                    <EscenarioCard key={e.id || i} escenario={e} index={i} />
                  ))}
                </div>
              </div>

              {/* Factores + Indicadores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Factores agravantes */}
                {analisis.factores_agravantes?.length > 0 && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                    <p className="text-xs font-bold text-red-700 uppercase mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Factores Agravantes
                    </p>
                    <ul className="space-y-2">
                      {analisis.factores_agravantes.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-red-800">
                          <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Factores mitigantes */}
                {analisis.factores_mitigantes?.length > 0 && (
                  <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                    <p className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" /> Factores Mitigantes
                    </p>
                    <ul className="space-y-2">
                      {analisis.factores_mitigantes.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-green-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5 text-green-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Indicadores de alerta temprana */}
              {analisis.indicadores_alerta_temprana?.length > 0 && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-4 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Indicadores de Alerta Temprana (KPIs a Monitorear)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analisis.indicadores_alerta_temprana.map((ind, i) => (
                      <div key={i} className="bg-white rounded-lg border border-blue-100 p-3">
                        <p className="text-xs font-semibold text-gray-800">{ind.indicador}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {ind.umbral && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                              Umbral: {ind.umbral}
                            </span>
                          )}
                          {ind.frecuencia && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                              {ind.frecuencia}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
