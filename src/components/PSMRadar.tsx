/**
 * Radar de Madurez PSM Dinámico — 20 elementos CCPS.
 * Consume GET /api/v1/radar/evolucion/:centroId.
 * Muestra Índice de Madurez Global en Gauge (>13%) y radar con series inicial, actual y meta.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').toString().replace(/\/$/, '');
const FULL_MARK = 100;

function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export type RadarEvolucionResponse = {
  centro_id: number;
  diagnostico_id_base: number | null;
  indice_madurez_global_inicial: number;
  indice_madurez_global_actual: number;
  series: { inicial: number[]; actual: number[]; meta: number[] };
  elementos: { id: number; nombre: string }[];
};

type PSMRadarProps = {
  centroId: number;
  className?: string;
  height?: number;
};

export default function PSMRadar({ centroId, className = '', height = 520 }: PSMRadarProps) {
  const [data, setData] = useState<RadarEvolucionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRadar = useCallback(async () => {
    if (!centroId) {
      setError('Se requiere centro (planta)');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const url = apiUrl(`/api/v1/radar/evolucion/${centroId}`);
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error ${res.status}`);
      }
      const json: RadarEvolucionResponse = await res.json();
      setData(json);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error de conexión.';
      setError(
        `${message} Asegúrate de: 1) Tener la API en marcha (npm run start:api en puerto 3002). ` +
        `2) Usar el frontend por http://localhost:5173 (npm run dev) para que el proxy envíe /api a la API. ` +
        `3) Si la API está en otro servidor, define VITE_API_BASE_URL en .env.`
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <div className="w-10 h-10 border-2 border-brand-green border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Cargando evolución del radar de madurez PSM…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center py-16 text-red-600">
          <p className="text-sm font-medium mb-2">Error al cargar el radar</p>
          <p className="text-xs text-gray-500 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={fetchRadar}
            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { indice_madurez_global_actual, indice_madurez_global_inicial, series, elementos } = data;
  const chartData = elementos.map((el, i) => ({
    subject: el.nombre.length > 14 ? el.nombre.slice(0, 14) + '…' : el.nombre,
    full: el.nombre,
    inicial: series.inicial[i] ?? 0,
    actual: series.actual[i] ?? 0,
    meta: series.meta[i] ?? FULL_MARK,
  }));

  const gaugeValue = Math.min(100, Math.max(0, indice_madurez_global_actual));
  const gaugeDisplay = gaugeValue < 13 ? 13 : gaugeValue;
  const gaugeColor =
    gaugeValue >= 76 ? '#10B981' :
    gaugeValue >= 51 ? '#EAB308' :
    gaugeValue >= 26 ? '#F59E0B' : '#EF4444';

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">Radar de Madurez PSM Dinámico</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          <strong>Base = último diagnóstico</strong> del centro (solo uno, el más reciente). Inicial = ese diagnóstico. Actual = base + mejoras de tareas completadas del plan de acción. Opcional: comparar con histórico (parámetro <code>diagnostico_id_historico</code>).
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Centro ID: {data.centro_id} · Diagnóstico base: #{data.diagnostico_id_base ?? '—'} · 20 elementos CCPS
        </p>
      </div>

      {/* Gauge: Índice de Madurez Global — mínimo visual 13% */}
      <div className="flex justify-center py-6 bg-gray-50/50">
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeDasharray={`${(gaugeDisplay / 100) * 326.7} 326.7`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{indice_madurez_global_actual}%</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Índice Global</span>
          </div>
        </div>
        <div className="flex flex-col justify-center ml-4 text-sm">
          <p><span className="text-gray-500">Inicial:</span> <strong>{indice_madurez_global_inicial}%</strong></p>
          <p><span className="text-gray-500">Actual:</span> <strong>{indice_madurez_global_actual}%</strong></p>
        </div>
      </div>

      {/* Radar 20 ejes */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#374151', fontSize: 10, fontWeight: 600 }}
              tickLine={{ stroke: '#D1D5DB' }}
            />
            <PolarRadiusAxis angle={90} domain={[0, FULL_MARK]} tick={{ fill: '#6B7280', fontSize: 9 }} tickCount={5} />
            <Radar name="Inicial" dataKey="inicial" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.2} strokeWidth={1.5} />
            <Radar name="Actual" dataKey="actual" stroke="#10B981" fill="#10B981" fillOpacity={0.25} strokeWidth={2} />
            <Radar name="Meta" dataKey="meta" stroke="#E5E7EB" fill="none" strokeWidth={1} strokeDasharray="4 2" />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
              formatter={(value: number) => [`${value}%`, '']}
              labelFormatter={(label) => chartData.find(d => d.subject === label)?.full ?? label}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
