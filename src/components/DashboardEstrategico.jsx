/**
 * DashboardEstrategico — Vista ejecutiva: KPIs + Radar de Madurez + Gráfica de Cumplimiento (Pareto).
 * Carga datos de madurez y stats una vez y los reparte a ambos gráficos.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, TrendingUp, AlertTriangle, ListTodo, FileCheck,
  RefreshCw, BarChart3,
} from 'lucide-react';
import apiService from '../services/apiService';
import RadarMadurez from './RadarMadurez';
import GraficaCumplimientoElementos from './GraficaCumplimientoElementos';

// ─── Tarjetas KPI ───────────────────────────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, colorClass, bgClass }) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${bgClass || ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`mt-1 text-2xl font-black tabular-nums ${colorClass}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bgClass || 'bg-gray-50'}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardEstrategico() {
  const [madurez, setMadurez] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [madurezRes, statsRes] = await Promise.all([
        apiService.fetchMadurezDashboard(),
        apiService.fetchDashboardStats(),
      ]);
      setMadurez(madurezRes);
      setStats(statsRes);
    } catch (err) {
      setError(err.message);
      setMadurez(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const elementos = madurez?.elementos ?? [];
  const madurezGlobal = madurez?.madurez_global ?? 0;
  const nivelMadurez = madurez?.nivel_madurez ?? '—';
  const elementosCriticos = elementos.filter((e) => (e.puntaje ?? 0) <= 40).length;
  const totalAcciones = stats?.acciones?.total ?? 0;
  const accionesAbiertas = totalAcciones - (stats?.acciones?.completadas ?? 0);
  const diagnosticosFinalizados = stats?.diagnosticos?.finalizados ?? 0;

  const dataParaGraficas = elementos.map((e) => ({
    elemento: e.elemento,
    puntaje: e.puntaje ?? 0,
    total: e.total,
  }));

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-indigo-600" />
              Dashboard Estratégico PSM
            </h1>
            <p className="text-gray-500 mt-0.5">
              Vista ejecutiva de madurez, cumplimiento por elemento y estado del plan de acción
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Sección superior: Tarjetas KPI ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Índice de Madurez Global"
            value={loading ? '—' : `${madurezGlobal}%`}
            subtitle={nivelMadurez}
            icon={TrendingUp}
            colorClass="text-indigo-600"
            bgClass="bg-indigo-50"
          />
          <KPICard
            title="Total de Acciones Abiertas"
            value={loading ? '—' : accionesAbiertas}
            subtitle={`de ${totalAcciones} en el plan`}
            icon={ListTodo}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
          />
          <KPICard
            title="Elementos en Riesgo Crítico"
            value={loading ? '—' : elementosCriticos}
            subtitle="≤40% cumplimiento"
            icon={AlertTriangle}
            colorClass="text-red-600"
            bgClass="bg-red-50"
          />
          <KPICard
            title="Diagnósticos Finalizados"
            value={loading ? '—' : diagnosticosFinalizados}
            subtitle="con análisis PSM"
            icon={FileCheck}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
          />
        </div>

        {/* ── Sección principal: dos columnas (Radar + Pareto) ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Columna izquierda: Radar de Madurez PSM */}
          <div className="min-w-0">
            {loading ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center h-80">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            ) : elementos.length > 0 ? (
              <RadarMadurez data={dataParaGraficas} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center h-64 text-center text-gray-500 p-6">
                <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm font-medium">Sin datos de madurez</p>
                <p className="text-xs mt-0.5">Completa un diagnóstico PSM para ver el radar.</p>
              </div>
            )}
          </div>

          {/* Columna derecha: Gráfica de Cumplimiento (Pareto) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Cumplimiento por Elemento</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ordenado de menor a mayor (críticos arriba)</p>
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center h-80">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              ) : elementos.length > 0 ? (
                <>
                  <GraficaCumplimientoElementos data={dataParaGraficas} height={400} />
                  <div className="mt-3 flex items-center justify-center gap-5 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> ≤40% Crítico
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> 41–75% En desarrollo
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> &gt;75% Maduro
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm font-medium">Sin datos de cumplimiento</p>
                  <p className="text-xs mt-0.5">Los elementos aparecerán tras cargar un diagnóstico.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
