/**
 * DiagnosticoView.jsx
 * Vista de la Fase 2 – Carga de Cuestionario Normativo.
 * Muestra las preguntas filtradas por complejidad <= nivel_calculado,
 * agrupadas por categoría (elemento), con barra de progreso real y
 * modo solo-lectura para diagnósticos Finalizados.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  BookOpen, Info, AlertTriangle, Lock, RefreshCw,
  FileText, Target,
} from 'lucide-react';
import apiService, { API_BASE_URL } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import NavegacionFases from './NavegacionFases';

// ─── Constantes ───────────────────────────────────────────────────────────────


const OPCIONES_RESPUESTA = [
  { value: 'Suficiente',    label: 'Suficiente',    color: 'bg-green-100 text-green-700  border-green-300' },
  { value: 'Escasa',        label: 'Escasa',         color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'Al menos',      label: 'Al menos',       color: 'bg-blue-100   text-blue-700   border-blue-300' },
  { value: 'No evidencia',  label: 'Sin evidencia',  color: 'bg-red-100    text-red-700    border-red-300' },
  { value: 'No aplica',     label: 'No aplica',      color: 'bg-gray-100   text-gray-500   border-gray-300' },
];

const NIVEL_COLORS = {
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

const COMPLEJIDAD_COLOR = {
  1: 'bg-slate-200 text-slate-600',
  2: 'bg-sky-200 text-sky-700',
  3: 'bg-amber-200 text-amber-700',
  4: 'bg-red-200 text-red-700',
  5: 'bg-red-900 text-white',
};

const COMPLEJIDAD_LABEL = { 1: 'C1', 2: 'C2', 3: 'C3', 4: 'C4', 5: 'C5' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ComplejidadBadge({ nivel }) {
  if (!nivel) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${COMPLEJIDAD_COLOR[nivel] ?? 'bg-gray-100 text-gray-500'}`}>
      {COMPLEJIDAD_LABEL[nivel] ?? `C${nivel}`}
    </span>
  );
}

function PorcentajeBarra({ pct }) {
  const color = pct < 30 ? 'bg-red-400' : pct < 70 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Componente de pregunta ───────────────────────────────────────────────────

function PreguntaItem({ pregunta, soloLectura, onResponder, saving }) {
  const [expandida, setExpandida] = useState(false);
  const respuesta = pregunta.respuesta;

  const opcionActual = OPCIONES_RESPUESTA.find((o) => o.value === respuesta);

  return (
    <div className={`rounded-lg border transition-all ${respuesta ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'} ${soloLectura ? 'opacity-90' : ''}`}>
      {/* Cabecera */}
      <div className="flex items-start gap-3 p-3">
        {/* Icono estado */}
        <div className="mt-0.5 shrink-0">
          {respuesta
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : <Circle className="w-5 h-5 text-gray-300" />}
        </div>

        {/* Texto pregunta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <ComplejidadBadge nivel={pregunta.complejidad} />
            {pregunta.legislacion && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                <BookOpen className="w-2.5 h-2.5" />{pregunta.legislacion.slice(0, 25)}{pregunta.legislacion.length > 25 ? '…' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 leading-snug">{pregunta.pregunta}</p>
        </div>

        {/* Botón expandir guía */}
        <button
          type="button"
          onClick={() => setExpandida(!expandida)}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Ver guía del auditor"
        >
          {expandida ? <ChevronUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
        </button>
      </div>

      {/* Guía del auditor (expandible) */}
      {expandida && (
        <div className="mx-3 mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-900 space-y-1">
          {pregunta.guia_suficiente   && <p><span className="font-semibold text-green-700">✔ Suficiente:</span> {pregunta.guia_suficiente}</p>}
          {pregunta.guia_escasa       && <p><span className="font-semibold text-yellow-700">⚠ Escasa:</span> {pregunta.guia_escasa}</p>}
          {pregunta.guia_al_menos     && <p><span className="font-semibold text-blue-700">↗ Al menos:</span> {pregunta.guia_al_menos}</p>}
          {pregunta.guia_no_evidencia && <p><span className="font-semibold text-red-700">✗ Sin evidencia:</span> {pregunta.guia_no_evidencia}</p>}
          {!pregunta.guia_suficiente && !pregunta.guia_escasa && !pregunta.guia_al_menos && !pregunta.guia_no_evidencia && (
            <p className="text-indigo-400 italic">Sin guía disponible para esta pregunta.</p>
          )}
        </div>
      )}

      {/* Opciones de respuesta */}
      {!soloLectura && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {OPCIONES_RESPUESTA.map((op) => (
            <button
              key={op.value}
              type="button"
              disabled={saving}
              onClick={() => onResponder(pregunta.id, op.value, pregunta.comentario)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all
                ${respuesta === op.value
                  ? `${op.color} ring-2 ring-offset-1 ring-current font-bold`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* Solo lectura — mostrar respuesta actual */}
      {soloLectura && respuesta && (
        <div className="px-3 pb-3">
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${opcionActual?.color ?? 'bg-gray-100 text-gray-500'}`}>
            {opcionActual?.label ?? respuesta}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Componente de grupo/categoría ───────────────────────────────────────────

function GrupoCategoria({ nombre, preguntas, soloLectura, onResponder, saving }) {
  const [abierto, setAbierto] = useState(true);
  const respondidas = preguntas.filter((p) => p.respuesta).length;
  const completo    = respondidas === preguntas.length;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera del grupo */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors
          ${completo ? 'bg-green-50' : 'bg-gray-50'} hover:bg-gray-100`}
      >
        <div className="flex items-center gap-2">
          {completo
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Circle className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold text-gray-800 text-sm">{nombre}</span>
          <span className="text-xs text-gray-400">
            {respondidas}/{preguntas.length}
          </span>
        </div>
        {abierto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Preguntas */}
      {abierto && (
        <div className="p-3 space-y-2 border-t border-gray-100">
          {preguntas.map((p) => (
            <PreguntaItem
              key={p.id}
              pregunta={p}
              soloLectura={soloLectura}
              onResponder={onResponder}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiagnosticoView({ diagnosticoId, faseActual = 2, onNavegar, onCerrar, onIrAIA }) {
  const { usuario } = useAuth();
  const [datos,    setDatos]    = useState(null);  // { nivel, total, respondidas, grupos, estado_diagnostico }
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const soloLectura =
    datos?.estado_diagnostico === 'Finalizado' ||
    datos?.estado_diagnostico === 'Aprobado'   ||
    usuario?.rol === 'Lector';

  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/diagnosticos/${diagnosticoId}/preguntas`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('skudo_token')}` } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setDatos(await res.json());
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [diagnosticoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleResponder(preguntaId, respuesta) {
    setSaving(true);
    try {
      await fetch(
        `${API_BASE_URL}/diagnosticos/${diagnosticoId}/respuestas/${preguntaId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('skudo_token')}` },
          body: JSON.stringify({ respuesta }),
        }
      );
      // Actualizar estado local sin refetch completo
      setDatos((prev) => {
        if (!prev) return prev;
        const grupos = { ...prev.grupos };
        for (const cat of Object.keys(grupos)) {
          grupos[cat] = grupos[cat].map((p) =>
            p.id === preguntaId ? { ...p, respuesta } : p
          );
        }
        const respondidas = Object.values(grupos).flat().filter((p) => p.respuesta).length;
        return { ...prev, grupos, respondidas };
      });
    } catch (e) {
      alert('Error al guardar respuesta: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Cargando cuestionario…
        </div>
      </div>
    );
  }

  const pct = datos?.total > 0 ? Math.round((datos.respondidas / datos.total) * 100) : 0;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 rounded-t-2xl px-6 py-4">
          {/* Navegación entre fases */}
          {onNavegar && (
            <div className="mb-3 pb-3 border-b border-gray-100">
              <NavegacionFases faseActual={faseActual} onNavegar={onNavegar} soloLectura={soloLectura} />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">Cuestionario Normativo — Fase 2</h2>
                {soloLectura && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Solo lectura
                  </span>
                )}
              </div>
              {datos && (
                <p className="text-sm text-gray-500">
                  Nivel&nbsp;
                  <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${NIVEL_COLORS[datos.nivel] ?? 'bg-gray-100'}`}>
                    N{datos.nivel}
                  </span>
                  &nbsp;detectado ·&nbsp;
                  <span className="font-semibold text-gray-700">{datos.total} preguntas activadas</span>
                  &nbsp;({datos.respondidas} respondidas)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="flex items-center gap-3">
            <PorcentajeBarra pct={pct} />
            <span className="text-sm font-bold text-gray-700 shrink-0 w-12 text-right">{pct}%</span>
          </div>

          {/* Leyenda de complejidad */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Complejidad:</span>
            {[1, 2, 3, 4, 5].filter((c) => c <= (datos?.nivel ?? 1)).map((c) => (
              <span key={c} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${COMPLEJIDAD_COLOR[c]}`}>
                C{c}
              </span>
            ))}
            <span className="text-[10px] text-gray-400 ml-1">— preguntas incluidas según Perfil de Riesgo</span>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
            <button onClick={cargar} className="ml-auto text-xs underline">Reintentar</button>
          </div>
        )}

        {/* ── Cuerpo: grupos de preguntas ────────────────────────────── */}
        <div className="p-6 space-y-4">
          {datos && Object.entries(datos.grupos).length === 0 && (
            <p className="text-center text-gray-400 py-10">No se encontraron preguntas para este nivel.</p>
          )}

          {datos && Object.entries(datos.grupos).map(([cat, preguntas]) => (
            <GrupoCategoria
              key={cat}
              nombre={cat}
              preguntas={preguntas}
              soloLectura={soloLectura}
              onResponder={handleResponder}
              saving={saving}
            />
          ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-2xl px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {saving && <span className="flex items-center gap-1 text-green-600"><RefreshCw className="w-3 h-3 animate-spin" /> Guardando…</span>}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
            {!soloLectura && onIrAIA && (
              <button
                type="button"
                onClick={() => onIrAIA(diagnosticoId)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Siguiente: Gestión Documental (Fase 2b)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
