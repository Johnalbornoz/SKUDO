import { useState, useEffect, useRef } from 'react';
import {
  Shield, Gavel, Target, BarChart2, Network, DollarSign,
  CheckCircle2, ChevronRight, X, ArrowLeft, Save, MessageSquare,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import apiService from '../services/apiService';

// ─── Configuración de las 6 dimensiones ──────────────────────────────────────

const DIMENSIONES = [
  {
    key: 'riesgo_tecnico',
    comentKey: 'comentarios_riesgo',
    label: 'Riesgo Técnico',
    icon: Shield,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    desc: 'Nivel de peligrosidad inherente al proceso industrial evaluado.',
    placeholder: 'Ej: Presencia de cloro líquido en inventario > 10 ton, operación cercana al umbral de catástrofe según Decreto 1347…',
  },
  {
    key: 'regulacion',
    comentKey: 'comentarios_regulacion',
    label: 'Regulación',
    icon: Gavel,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    desc: 'Complejidad del marco normativo aplicable (Decreto 1347, OHSAS, etc.).',
    placeholder: 'Ej: Sujeto a Decreto 1347/2021 con historial de observaciones ANLA, sin cierre de hallazgos previos…',
  },
  {
    key: 'madurez',
    comentKey: 'comentarios_madurez',
    label: 'Madurez del SGS',
    icon: BarChart2,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    desc: 'Grado de desarrollo del Sistema de Gestión de Seguridad de la organización.',
    placeholder: 'Ej: SGS implementado hace 2 años, sin auditoría externa, indicadores de lagging sin análisis sistemático…',
  },
  {
    key: 'estrategia',
    comentKey: 'comentarios_estrategia',
    label: 'Estrategia',
    icon: Target,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    desc: 'Alcance estratégico y objetivo del diagnóstico para la alta dirección.',
    placeholder: 'Ej: Diagnóstico solicitado por Junta Directiva tras incidente Tier 2, objetivo: plan de mejora para renovación de licencia…',
  },
  {
    key: 'complejidad',
    comentKey: 'comentarios_complejidad',
    label: 'Complejidad Operacional',
    icon: Network,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    desc: 'Complejidad de procesos, equipos y sistemas de control involucrados.',
    placeholder: 'Ej: Planta con 3 reactores en serie, SIS parcialmente integrado, alta rotación de personal operativo en turnos nocturnos…',
  },
  {
    key: 'exposicion',
    comentKey: 'comentarios_exposicion',
    label: 'Exposición Financiera',
    icon: DollarSign,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    desc: 'Impacto económico potencial ante un evento de proceso mayor.',
    placeholder: 'Ej: Activos asegurados por USD 45M, posible pérdida de producción > 6 meses, área residencial en radio de 500m…',
  },
];

// ─── Opciones de valor ────────────────────────────────────────────────────────

const OPCIONES = [
  { valor: 1, label: 'Bajo',    active: 'border-green-400 bg-green-50 text-green-800 ring-1 ring-green-400 shadow-sm' },
  { valor: 2, label: 'Medio',   active: 'border-amber-400 bg-amber-50 text-amber-800 ring-1 ring-amber-400 shadow-sm' },
  { valor: 3, label: 'Alto',    active: 'border-orange-400 bg-orange-50 text-orange-800 ring-1 ring-orange-400 shadow-sm' },
  { valor: 4, label: 'Crítico', active: 'border-red-400 bg-red-50 text-red-800 ring-1 ring-red-400 shadow-sm' },
];

// ─── Config visual por nivel ──────────────────────────────────────────────────

const NIVEL_CFG = {
  1: {
    label: 'Exploratorio',
    badge: 'bg-slate-500 text-white',
    card: 'bg-slate-50 border-slate-200',
    num: 'text-slate-600',
    desc: 'El sistema PSM presenta condiciones de bajo riesgo e impacto. Se realiza un diagnóstico de orientación y línea base para establecer el punto de partida.',
  },
  2: {
    label: 'Básico',
    badge: 'bg-blue-600 text-white',
    card: 'bg-blue-50 border-blue-200',
    num: 'text-blue-600',
    desc: 'Condiciones de riesgo moderado con oportunidades de mejora identificadas. El diagnóstico cubre los elementos fundamentales del sistema PSM bajo metodología CCPS.',
  },
  3: {
    label: 'Estándar',
    badge: 'bg-amber-500 text-white',
    card: 'bg-amber-50 border-amber-200',
    num: 'text-amber-500',
    desc: 'Riesgo significativo que requiere evaluación profunda. Incluye análisis de brechas, triangulación de evidencias y planes de acción detallados por elemento PSM.',
  },
  4: {
    label: 'Avanzado',
    badge: 'bg-orange-500 text-white',
    card: 'bg-orange-50 border-orange-200',
    num: 'text-orange-500',
    desc: 'Riesgo elevado con necesidad de intervención estructurada. Diagnóstico integral con análisis de causa raíz, evaluación de barreras y recomendaciones ejecutivas.',
  },
  5: {
    label: 'Crítico — Excepcional',
    badge: 'bg-red-600 text-white',
    card: 'bg-red-50 border-red-200',
    num: 'text-red-600',
    desc: 'Riesgo crítico con potencial de consecuencias catastróficas. Se activa el protocolo de diagnóstico de emergencia: evaluación exhaustiva, informe ejecutivo inmediato y gestión de crisis.',
  },
};

const COMENTARIOS_VACIO = {
  comentarios_riesgo: '', comentarios_regulacion: '', comentarios_madurez: '',
  comentarios_estrategia: '', comentarios_complejidad: '', comentarios_exposicion: '',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiagnosticoWizard({ onCerrar, onSiguiente }) {
  const [fase, setFase]               = useState('form');
  const [valores, setValores]         = useState({
    riesgo_tecnico: 0, regulacion: 0, madurez: 0,
    estrategia: 0, complejidad: 0, exposicion: 0,
  });
  const [comentarios, setComentarios] = useState(COMENTARIOS_VACIO);
  const [expandidos, setExpandidos]   = useState({}); // qué textareas están visibles
  const [plantaId, setPlantaId]       = useState('');
  const [areaId, setAreaId]           = useState('');
  const [plantas, setPlantas]         = useState([]);
  const [allAreas, setAllAreas]       = useState([]);
  const [areas, setAreas]             = useState([]);
  const [calculando, setCalculando]   = useState(false);
  const [resultado, setResultado]     = useState(null);
  const [error, setError]             = useState('');
  const [draftId, setDraftId]         = useState(null);
  const [guardado, setGuardado]       = useState(false);
  const saveTimerRef                  = useRef(null);

  useEffect(() => {
    apiService.fetchHierarchy()
      .then(({ plantas = [], areas = [] }) => {
        setPlantas(plantas);
        setAllAreas(areas);
        setAreas(areas);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!plantaId) { setAreas(allAreas); }
    else { setAreas(allAreas.filter((a) => String(a.planta_id) === String(plantaId))); }
    setAreaId('');
  }, [plantaId, allAreas]);

  const progreso     = Object.values(valores).filter((v) => v > 0).length;
  const todoCompleto = progreso === 6;
  const conJustif    = Object.values(comentarios).filter(Boolean).length;
  const faltaPlanta  = plantas.length > 0 && !plantaId;
  const faltaArea    = plantas.length > 0 && plantaId && areas.length > 0 && !areaId;
  const puedeCalcular = todoCompleto && !faltaPlanta && !faltaArea;

  function seleccionar(key, valor) {
    const nuevos = { ...valores, [key]: valor };
    setValores(nuevos);
    setError('');
    // Auto-expand justificación al seleccionar valor
    setExpandidos((prev) => ({ ...prev, [key]: true }));
    disparar(nuevos, comentarios);
  }

  function comentar(comentKey, texto) {
    const nuevos = { ...comentarios, [comentKey]: texto };
    setComentarios(nuevos);
    disparar(valores, nuevos);
  }

  function disparar(v, c) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoGuardar(v, c), 800);
  }

  async function autoGuardar(v, c) {
    try {
      localStorage.setItem('skudo_wizard_draft', JSON.stringify({
        valores: v, comentarios: c, plantaId, areaId, ts: Date.now(),
      }));
      if (draftId) {
        await apiService.patchProgreso(draftId, { data_setup: { ...v, ...c } });
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch { /* silencioso */ }
  }

  async function handleCalcular() {
    if (!todoCompleto) {
      setError('Selecciona un valor en cada dimensión para continuar.');
      return;
    }
    if (plantas.length > 0 && !plantaId) {
      setError('Debes seleccionar la Planta / Sede para continuar.');
      return;
    }
    if (plantas.length > 0 && plantaId && areas.length > 0 && !areaId) {
      setError('Debes seleccionar el Área para continuar.');
      return;
    }
    setCalculando(true);
    setError('');
    try {
      const res = await apiService.setupDiagnostico({
        planta_id: plantaId || null,
        area_id:   areaId   || null,
        ...valores,
        ...comentarios,
      });
      setDraftId(res.diagnostico_id);
      localStorage.removeItem('skudo_wizard_draft');
      setResultado(res);
      setFase('result');
    } catch (err) {
      setError(err?.message || 'Error al calcular el nivel.');
    } finally {
      setCalculando(false);
    }
  }

  const nivelCfg = resultado ? NIVEL_CFG[resultado.nivel_calculado] : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Motor de Clasificación PSM</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-gray-500">
                {fase === 'form'
                  ? 'Evalúa las 6 dimensiones y documenta la justificación técnica'
                  : 'Nivel calculado según perfil de riesgo de la organización'}
              </p>
              {guardado && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Save className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onCerrar}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5">

          {fase === 'form' ? (
            <>
              {/* Selectores de ubicación: empresa y sede obligatorios */}
              {plantas.length > 0 && (
                <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-amber-700 mb-3 font-medium">
                    <strong>Empresa y sede</strong> son obligatorios. Selecciona la planta y el área antes de continuar.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                        Planta / Sede <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={plantaId}
                        onChange={(e) => setPlantaId(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white ${!plantaId ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`}
                      >
                        <option value="">— Selecciona planta —</option>
                        {plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                        Área {areas.length > 0 ? <span className="text-red-500">*</span> : null}
                      </label>
                      <select
                        value={areaId}
                        onChange={(e) => setAreaId(e.target.value)}
                        disabled={!plantaId}
                        className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50 ${plantaId && !areaId && areas.length > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`}
                      >
                        <option value="">— {areas.length > 0 ? 'Selecciona área' : 'Sin áreas'} —</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Barra de progreso */}
              <div className="flex items-center gap-3 mb-1.5">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${(progreso / 6) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-500 shrink-0 tabular-nums">{progreso} / 6</span>
              </div>
              {conJustif > 0 && (
                <p className="text-xs text-indigo-600 mb-4 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {conJustif} justificación{conJustif !== 1 ? 'es' : ''} documentada{conJustif !== 1 ? 's' : ''}
                </p>
              )}
              {conJustif === 0 && <div className="mb-4" />}

              {/* Nota informativa */}
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700 leading-relaxed">
                  <span className="font-semibold">Justificación técnica:</span> Al seleccionar cada nivel, se abrirá un campo de texto para documentar la razón. La IA usará estas notas para profundizar el análisis en fases posteriores.
                </p>
              </div>

              {/* Tarjetas de dimensión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DIMENSIONES.map(({ key, comentKey, label, icon: Icon, iconBg, iconColor, desc, placeholder }) => {
                  const val         = valores[key];
                  const comentario  = comentarios[comentKey];
                  const abierto     = expandidos[key] ?? false;

                  return (
                    <div key={key}
                      className={`rounded-xl border p-4 transition-colors ${
                        val > 0 ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
                      }`}>

                      {/* Título */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</p>
                        </div>
                        {val > 0 && (
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            {comentario && <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />}
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                      </div>

                      {/* Botones de selección */}
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {OPCIONES.map(({ valor, label: lbl, active }) => (
                          <button key={valor} type="button" onClick={() => seleccionar(key, valor)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              val === valor
                                ? active
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}>
                            {lbl}
                          </button>
                        ))}
                      </div>

                      {/* Toggle de justificación */}
                      {val > 0 && (
                        <>
                          <button type="button"
                            onClick={() => setExpandidos((p) => ({ ...p, [key]: !abierto }))}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors mt-1 ${
                              comentario
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}>
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" />
                              {comentario ? 'Justificación guardada' : 'Añadir justificación técnica'}
                              <span className="text-[10px] opacity-60">(recomendado)</span>
                            </span>
                            {abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {abierto && (
                            <textarea
                              value={comentario}
                              onChange={(e) => comentar(comentKey, e.target.value)}
                              rows={3}
                              placeholder={placeholder}
                              className="mt-2 w-full px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>

          ) : (
            /* ── Resultado ──────────────────────────────────────────── */
            nivelCfg && (
              <div className="flex flex-col items-center py-4">
                <span className={`px-5 py-1.5 rounded-full text-sm font-bold mb-4 ${nivelCfg.badge}`}>
                  Nivel {resultado.nivel_calculado} — {nivelCfg.label}
                </span>

                <div className={`text-[7rem] leading-none font-black mb-1 ${nivelCfg.num}`}>
                  {resultado.nivel_calculado}
                </div>
                <p className="text-sm text-gray-500 mb-6 font-medium">Profundidad del Diagnóstico PSM</p>

                <div className={`w-full rounded-xl border p-4 mb-5 ${nivelCfg.card}`}>
                  <p className="text-sm leading-relaxed text-gray-700">{nivelCfg.desc}</p>
                </div>

                {/* Resumen dimensiones con justificaciones */}
                <div className="w-full">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Perfil de riesgo evaluado
                  </p>
                  <div className="space-y-2">
                    {DIMENSIONES.map(({ key, comentKey, label, icon: Icon }) => {
                      const val      = valores[key];
                      const opcion   = OPCIONES.find((o) => o.valor === val);
                      const coment   = comentarios[comentKey];
                      const valorClr = val === 1 ? 'text-green-700' : val === 2 ? 'text-amber-700' : val === 3 ? 'text-orange-700' : 'text-red-700';
                      const bgClr    = val === 1 ? 'bg-green-50 border-green-100' : val === 2 ? 'bg-amber-50 border-amber-100' : val === 3 ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100';
                      return (
                        <div key={key} className={`rounded-xl border px-3 py-2.5 ${bgClr}`}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <p className="text-xs text-gray-500 flex-1">{label}</p>
                            <p className={`text-xs font-bold ${valorClr}`}>{opcion?.label}</p>
                          </div>
                          {coment && (
                            <p className="mt-1.5 ml-5 text-xs text-gray-600 leading-relaxed italic">
                              "{coment}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {conJustif === 0 && (
                    <p className="mt-3 text-xs text-gray-400 text-center">
                      Sin justificaciones documentadas. La IA usará solo los valores numéricos.
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {error && <p className="mt-4 text-sm text-rose-600 font-medium">{error}</p>}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center gap-3">
          {fase === 'form' ? (
            <>
              <button type="button" onClick={onCerrar}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                Cancelar
              </button>
              <div className="flex-1" />
              {!todoCompleto && (
                <span className="text-xs text-gray-400">
                  {6 - progreso} dimensión{6 - progreso !== 1 ? 'es' : ''} pendiente{6 - progreso !== 1 ? 's' : ''}
                </span>
              )}
              {(faltaPlanta || faltaArea) && (
                <span className="text-xs text-amber-600 font-medium">
                  {faltaPlanta ? 'Selecciona planta / sede' : 'Selecciona área'}
                </span>
              )}
              <button
                type="button"
                onClick={handleCalcular}
                disabled={!puedeCalcular || calculando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calculando ? 'Calculando...' : 'Calcular Nivel'}
                {!calculando && <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setFase('form'); setResultado(null); setError(''); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <div className="flex-1" />
              <button type="button"
                onClick={() => onSiguiente(resultado.diagnostico_id, resultado.nivel_calculado)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm">
                Siguiente: Carga de Evidencia (Fase 2)
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
