/**
 * BarraProgresoPreguntas.jsx
 * Muestra el progreso de preguntas calificadas con evidencia (X/total)
 * debajo de los botones de fase, en todas las fases del diagnóstico.
 * Se actualiza según el análisis del Consultor AI.
 */
import { useState, useEffect } from 'react';
import { FileCheck } from 'lucide-react';
import apiService from '../services/apiService';

/**
 * @param {number} diagnosticoId - ID del diagnóstico
 * @param {any} refreshKey - Cuando cambia, se vuelve a cargar (ej: docs.length, respondidas)
 */
export default function BarraProgresoPreguntas({ diagnosticoId, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!diagnosticoId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiService
      .fetchProgresoPreguntas(diagnosticoId)
      .then(setData)
      .catch(() => setData({ total: 0, calificadas_con_evidencia: 0 }))
      .finally(() => setLoading(false));
  }, [diagnosticoId, refreshKey]);

  if (!diagnosticoId) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 w-full animate-pulse">
        <div className="w-4 h-4 rounded bg-slate-300" />
        <span className="text-sm text-slate-400">Cargando progreso…</span>
      </div>
    );
  }
  if (!data) return null;
  const { total, calificadas_con_evidencia } = data;
  const pct = total > 0 ? Math.round((calificadas_con_evidencia / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 w-full">
      <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
      <span className="text-sm font-medium text-slate-700 shrink-0">
        Preguntas con evidencia:
      </span>
      <span className="text-sm font-bold text-indigo-700 shrink-0">
        {calificadas_con_evidencia}/{total}
      </span>
      <div className="flex-1 min-w-[60px] h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-500 shrink-0">{pct}%</span>
    </div>
  );
}
