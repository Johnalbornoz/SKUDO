import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, ChevronRight, FileText, Filter, RefreshCw, Trash2, AlertTriangle,
  Shield, Gavel, BarChart2, Target, Network, DollarSign,
  ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// ─── Configuración de fases ──────────────────────────────────────────────────

const FASES = [
  { paso: 1, label: 'Clasificación', estado: 'Configuracion' },
  { paso: 2, label: 'Cuestionario',  estado: 'Carga' },
  { paso: 3, label: 'Recorrido',     estado: 'Recorrido' },
  { paso: 4, label: 'Entrevistas',   estado: 'Entrevistas' },
  { paso: 5, label: 'Validación',    estado: 'Validacion' },
  { paso: 6, label: 'Finalizado',    estado: 'Finalizado' },
];

// Mapear estados heredados al paso correspondiente
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

// ─── Nivel badge ─────────────────────────────────────────────────────────────

const NIVEL_COLORS = {
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

const NIVEL_LABELS = {
  1: 'Exploratorio', 2: 'Básico', 3: 'Estándar', 4: 'Avanzado', 5: 'Crítico',
};

function NivelBadge({ nivel }) {
  if (!nivel) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${NIVEL_COLORS[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
      N{nivel} · {NIVEL_LABELS[nivel] ?? '?'}
    </span>
  );
}

// ─── Panel de justificaciones de clasificación ────────────────────────────────

const DIM_META = [
  { key: 'riesgo_tecnico',  comentKey: 'comentarios_riesgo',        label: 'Riesgo Técnico',        Icon: Shield  },
  { key: 'regulacion',      comentKey: 'comentarios_regulacion',     label: 'Regulación',            Icon: Gavel   },
  { key: 'madurez',         comentKey: 'comentarios_madurez',        label: 'Madurez SGS',           Icon: BarChart2 },
  { key: 'estrategia',      comentKey: 'comentarios_estrategia',     label: 'Estrategia',            Icon: Target  },
  { key: 'complejidad',     comentKey: 'comentarios_complejidad',    label: 'Complejidad',           Icon: Network },
  { key: 'exposicion',      comentKey: 'comentarios_exposicion',     label: 'Exposición Financiera', Icon: DollarSign },
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
  const tieneJustif = DIM_META.some((d) => dataSetup[d.comentKey]);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        <MessageSquare className="w-3 h-3" /> Perfil de Clasificación — Fase 1
      </p>
      <div className="space-y-1.5">
        {DIM_META.map(({ key, comentKey, label, Icon }) => {
          const val    = dataSetup[key];
          const coment = dataSetup[comentKey];
          if (!val) return null;
          return (
            <div key={key} className={`rounded-lg border px-2.5 py-2 ${VAL_COLORS[val] ?? 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-1.5">
                <Icon className="w-3 h-3 opacity-60 shrink-0" />
                <span className="text-[11px] font-medium flex-1">{label}</span>
                <span className="text-[10px] font-bold">{NIVEL_VAL_LABELS[val] ?? val}</span>
              </div>
              {coment && (
                <p className="mt-1 ml-4 text-[11px] text-gray-600 leading-relaxed">
                  {coment}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!tieneJustif && (
        <p className="text-[11px] text-gray-400 mt-1 ml-1">Sin justificaciones documentadas.</p>
      )}
    </div>
  );
}

// ─── Progress timeline ────────────────────────────────────────────────────────

function ProgressTimeline({ paso }) {
  const pct = Math.round(((paso - 1) / 5) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {FASES.map(({ paso: p, label }) => {
          const done    = p < paso;
          const current = p === paso;
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
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Tarjeta de diagnóstico en curso ─────────────────────────────────────────

function DiagnosticoCard({ diag, onContinuar, onEliminar }) {
  const paso         = diag.paso_actual ?? estadoAPaso(diag.estado);
  const finalizado   = esFinalizado(diag.estado);
  const titulo       = diag.planta_nombre
    ? `${diag.planta_nombre}${diag.area_nombre ? ' / ' + diag.area_nombre : ''}`
    : `Diagnóstico #${diag.id}`;
  const [confirmar, setConfirmar] = useState(false);
  const [borrando,  setBorrando]  = useState(false);

  async function handleEliminar() {
    setBorrando(true);
    try {
      await onEliminar(diag.id);
    } finally {
      setBorrando(false);
      setConfirmar(false);
    }
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
          {/* Botón eliminar — solo para diagnósticos no finalizados */}
          {!finalizado && !confirmar && (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Eliminar diagnóstico"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmación inline */}
      {confirmar && !finalizado && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-semibold">¿Eliminar este diagnóstico?</p>
          </div>
          <p className="text-[11px] text-red-600 mb-3">
            Se borrarán todas las respuestas y el progreso. Esta acción es irreversible.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              disabled={borrando}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEliminar}
              disabled={borrando}
              className="flex-1 px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
            >
              {borrando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}

      <ProgressTimeline paso={finalizado ? 5 : paso} />

      {/* Perfil de clasificación expandible en tarjetas en-curso */}
      {diag.data_setup && (
        <PerfilClasificacionCard dataSetup={diag.data_setup} />
      )}

      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          finalizado ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {finalizado ? '✓ Finalizado' : `Fase ${paso}: ${FASES.find(f => f.paso === paso)?.label ?? '—'}`}
        </span>
        <button
          type="button"
          onClick={() => onContinuar(diag)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            finalizado
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
          }`}
        >
          {finalizado ? <><FileText className="w-3.5 h-3.5" /> Ver Informe</> : <><ChevronRight className="w-3.5 h-3.5" /> Continuar</>}
        </button>
      </div>
    </div>
  );
}

// ─── Perfil en tarjeta (en curso) — compacto y colapsable ────────────────────

function PerfilClasificacionCard({ dataSetup }) {
  const [abierto, setAbierto] = useState(false);
  const tieneJustif = DIM_META.some((d) => dataSetup[d.comentKey]);

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setAbierto((p) => !p)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
          tieneJustif ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}>
        <MessageSquare className="w-3 h-3" />
        <span className="flex-1 text-left">
          {tieneJustif ? 'Ver perfil con justificaciones' : 'Ver perfil de clasificación'}
        </span>
        {abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {abierto && <PerfilClasificacion dataSetup={dataSetup} />}
    </div>
  );
}

// ─── Fila expandible del histórico ───────────────────────────────────────────

function HistoricoRow({ d, onContinuar }) {
  const [expandido, setExpandido] = useState(false);
  const dataSetup = d.data_setup ?? null;
  const tieneJustif = dataSetup && DIM_META.some((m) => dataSetup[m.comentKey]);

  return (
    <>
      <tr className="hover:bg-gray-50/60 transition-colors">
        <td className="px-4 py-3">
          <p className="font-medium text-gray-800">
            {d.planta_nombre ?? `Diagnóstico #${d.id}`}
            {d.area_nombre && <span className="text-gray-400"> / {d.area_nombre}</span>}
          </p>
          <p className="text-xs text-gray-400">
            Iniciado {new Date(d.created_at).toLocaleDateString('es-CO')}
          </p>
        </td>
        <td className="px-4 py-3 text-gray-500">
          {d.fecha_cierre
            ? new Date(d.fecha_cierre).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <NivelBadge nivel={d.nivel_calculado} />
            {dataSetup && (
              <button type="button" onClick={() => setExpandido((p) => !p)}
                className={`flex items-center gap-0.5 text-[10px] transition-colors ${
                  tieneJustif ? 'text-indigo-500 hover:text-indigo-700' : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Ver perfil de clasificación">
                <MessageSquare className="w-3 h-3" />
                {tieneJustif ? 'Justif.' : 'Perfil'}
                {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {d.puntuacion != null
            ? <span className="font-semibold text-gray-800">{d.puntuacion}%</span>
            : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-3 text-gray-500">{d.consultor_nombre ?? '—'}</td>
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => onContinuar(d)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors ml-auto">
            <FileText className="w-3.5 h-3.5" /> Ver Informe
          </button>
        </td>
      </tr>
      {expandido && dataSetup && (
        <tr className="bg-indigo-50/30">
          <td colSpan={6} className="px-6 pb-4">
            <PerfilClasificacion dataSetup={dataSetup} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiagnosticosDashboard({ onContinuar }) {
  const { usuario }  = useAuth();
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [plantas,      setPlantas]      = useState([]);
  const [loading,      setLoading]      = useState(true);

  // Filtros para el histórico
  const [filtroPl, setFiltroPl] = useState('');
  const [filtroAr, setFiltroAr] = useState('');

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
      // Actualización optimista: quitar de la lista sin refetch
      setDiagnosticos((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      alert('Error al eliminar: ' + (e.message ?? 'Intenta de nuevo.'));
    }
  }

  useEffect(() => {
    cargar();
    apiService.fetchHierarchy()
      .then(({ plantas = [] }) => setPlantas(plantas))
      .catch(() => {});
  }, [cargar]);

  const enCurso   = diagnosticos.filter(d => !esFinalizado(d.estado));
  const historico = diagnosticos.filter(d => esFinalizado(d.estado));

  const historicoFiltrado = historico.filter(d => {
    if (filtroPl && String(d.planta_id) !== filtroPl) return false;
    if (filtroAr && String(d.area_id)   !== filtroAr)  return false;
    return true;
  });

  const areasDeFiltroPl = filtroPl
    ? diagnosticos.filter(d => esFinalizado(d.estado) && String(d.planta_id) === filtroPl && d.area_id)
        .map(d => ({ id: d.area_id, nombre: d.area_nombre }))
        .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    : [];

  return (
    <div className="mt-10">
      {/* ── En Curso ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Diagnósticos en Curso</h3>
          <p className="text-sm text-gray-500">Retoma donde lo dejaste o inicia un nuevo diagnóstico.</p>
        </div>
        <button
          type="button"
          onClick={cargar}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : enCurso.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
          No tienes diagnósticos en progreso. Inicia uno desde la tarjeta <strong>Diagnóstico Fase I</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enCurso.map(d => (
            <DiagnosticoCard key={d.id} diag={d} onContinuar={onContinuar} onEliminar={handleEliminar} />
          ))}
        </div>
      )}

      {/* ── Histórico ─────────────────────────────────────────────────────── */}
      {historico.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Histórico de Diagnósticos</h3>
              <p className="text-sm text-gray-500">Diagnósticos finalizados — solo lectura.</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filtroPl}
              onChange={(e) => { setFiltroPl(e.target.value); setFiltroAr(''); }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Todas las plantas</option>
              {plantas.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
            </select>
            {areasDeFiltroPl.length > 0 && (
              <select
                value={filtroAr}
                onChange={(e) => setFiltroAr(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Todas las áreas</option>
                {areasDeFiltroPl.map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
              </select>
            )}
            {(filtroPl || filtroAr) && (
              <button onClick={() => { setFiltroPl(''); setFiltroAr(''); }} className="text-xs text-gray-400 hover:text-gray-700 underline">
                Limpiar
              </button>
            )}
          </div>

          {/* Tabla histórico */}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Diagnóstico</th>
                  <th className="px-4 py-3 text-left">Fecha cierre</th>
                  <th className="px-4 py-3 text-center">Nivel</th>
                  <th className="px-4 py-3 text-center">Puntuación</th>
                  <th className="px-4 py-3 text-left">Consultor</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historicoFiltrado.map(d => (
                  <HistoricoRow key={d.id} d={d} onContinuar={onContinuar} />
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
        </div>
      )}
    </div>
  );
}
