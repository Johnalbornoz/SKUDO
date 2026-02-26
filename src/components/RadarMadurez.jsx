import { useState, useEffect } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Info,
  BarChart3, Building2, MapPin,
} from 'lucide-react';
import apiService from '../services/apiService';

// ─── Configuración de nivel de madurez ───────────────────────────────────────
const NIVEL_CFG = {
  Optimizado:    { color: '#16a34a', bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700',  min: 80 },
  Gestionado:    { color: '#2563eb', bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   min: 60 },
  Definido:      { color: '#d97706', bg: 'bg-yellow-50',  border: 'border-yellow-200', text: 'text-yellow-700', min: 40 },
  'En Desarrollo': { color: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', min: 20 },
  Inicial:       { color: '#dc2626', bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    min: 0  },
};

const PUNTAJE_COLOR = (v) =>
  v >= 80 ? '#16a34a' : v >= 60 ? '#2563eb' : v >= 40 ? '#d97706' : v >= 20 ? '#ea580c' : '#dc2626';

// ─── Tooltip personalizado ───────────────────────────────────────────────────
function TooltipCustom({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-bold text-gray-800 mb-1">{d.elemento}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: PUNTAJE_COLOR(d.puntaje) }} />
        <span className="font-semibold" style={{ color: PUNTAJE_COLOR(d.puntaje) }}>
          {d.puntaje}% madurez
        </span>
      </div>
      {d.total > 0 && (
        <p className="text-gray-400 mt-0.5">{d.total} pregunta{d.total !== 1 ? 's' : ''} evaluada{d.total !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

// ─── Abreviaciones para el radar (nombres cortos) ───────────────────────────
function abreviar(nombre) {
  if (!nombre) return '';
  // Si ya es corto, usarlo directo
  if (nombre.length <= 16) return nombre;
  // Tomar primeras 2-3 palabras significativas
  const palabras = nombre.split(/[\s\-\/]+/).filter(p => p.length > 2);
  return palabras.slice(0, 2).join(' ');
}

// ─── Barra de madurez de elemento individual ────────────────────────────────
function BarraElemento({ nombre, puntaje, total }) {
  const color = PUNTAJE_COLOR(puntaje);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 truncate flex-1 mr-2" title={nombre}>{nombre}</span>
        <span className="text-xs font-bold shrink-0" style={{ color }}>{puntaje}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${puntaje}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RadarMadurez({ onIrADiagnostico }) {
  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [vista,   setVista]   = useState('radar'); // 'radar' | 'lista'

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.fetchMadurezDashboard();
      setDatos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Preparar datos para Recharts
  const datosRadar = (datos?.elementos || []).map(e => ({
    elemento: abreviar(e.elemento),
    nombreCompleto: e.elemento,
    puntaje: e.puntaje,
    total:   e.total,
  }));

  const cfg         = datos ? (NIVEL_CFG[datos.nivel_madurez] || NIVEL_CFG.Inicial) : null;
  const top5Bajos   = [...(datos?.elementos || [])].sort((a, b) => a.puntaje - b.puntaje).slice(0, 5);
  const top5Altos   = [...(datos?.elementos || [])].sort((a, b) => b.puntaje - a.puntaje).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 rounded-xl">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Radar de Madurez PSM</h2>
            {datos?.planta && (
              <div className="flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{datos.planta}</span>
                {datos.area && (
                  <>
                    <span className="text-gray-300">·</span>
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{datos.area}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setVista('radar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                vista === 'radar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Radar
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                vista === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Detalle
            </button>
          </div>
          <button
            onClick={cargar}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6">

        {/* Estado de carga */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Calculando madurez PSM…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Error al cargar: {error}</span>
          </div>
        )}

        {/* Sin diagnósticos */}
        {!loading && !error && datos && datos.total_elementos === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-600 font-semibold">Sin datos de madurez</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              Completa un diagnóstico PSM para ver el radar de madurez por elemento.
            </p>
            {onIrADiagnostico && (
              <button
                onClick={onIrADiagnostico}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Iniciar Diagnóstico
              </button>
            )}
          </div>
        )}

        {/* Datos disponibles */}
        {!loading && !error && datos && datos.total_elementos > 0 && (
          <div className="space-y-6">

            {/* Índice de madurez global */}
            <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Índice de Madurez Global</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-black" style={{ color: cfg.color }}>
                      {datos.madurez_global}%
                    </span>
                    <span className={`text-sm font-bold ${cfg.text}`}>
                      {datos.nivel_madurez}
                    </span>
                  </div>
                </div>
                {/* Mini barra de progreso circular */}
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={cfg.color} strokeWidth="3"
                      strokeDasharray={`${(datos.madurez_global / 100) * 100} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ color: cfg.color }}>
                    {datos.madurez_global}
                  </span>
                </div>
              </div>

              {/* Escala de niveles */}
              <div className="mt-3 flex items-center gap-1">
                {['Inicial','En Desarrollo','Definido','Gestionado','Optimizado'].map((n, i) => {
                  const isActive = n === datos.nivel_madurez;
                  const c = NIVEL_CFG[n];
                  return (
                    <div key={n} className="flex-1">
                      <div className={`h-1.5 rounded-full transition-all ${isActive ? '' : 'opacity-30'}`}
                        style={{ background: c.color }} />
                      {isActive && (
                        <p className="text-[9px] font-bold text-center mt-0.5" style={{ color: c.color }}>
                          {n}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vista RADAR */}
            {vista === 'radar' && datosRadar.length > 0 && (
              <div>
                <ResponsiveContainer width="100%" height={360}>
                  <RadarChart data={datosRadar} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="elemento"
                      tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 500 }}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tickCount={5}
                      tick={{ fontSize: 9, fill: '#9ca3af' }}
                      axisLine={false}
                    />
                    <Radar
                      name="Madurez"
                      dataKey="puntaje"
                      stroke={cfg.color}
                      fill={cfg.color}
                      fillOpacity={0.25}
                      strokeWidth={2}
                      dot={{ r: 4, fill: cfg.color, strokeWidth: 0 }}
                    />
                    <Tooltip content={<TooltipCustom />} />
                  </RadarChart>
                </ResponsiveContainer>

                {/* Nota informativa */}
                <div className="flex items-start gap-1.5 text-xs text-gray-400 mt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Basado en el diagnóstico #{datos.diagnostico_id}.
                    Nivel calculado: <strong>{datos.nivel_calculado || 'N/D'}</strong>.
                    {datos.total_elementos} elementos PSM evaluados.
                  </span>
                </div>
              </div>
            )}

            {/* Vista LISTA DETALLE */}
            {vista === 'lista' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Elementos débiles */}
                <div>
                  <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Áreas de Mejora
                  </h4>
                  <div className="space-y-2.5">
                    {top5Bajos.map(e => (
                      <BarraElemento key={e.elemento} nombre={e.elemento} puntaje={e.puntaje} total={e.total} />
                    ))}
                  </div>
                </div>
                {/* Elementos fuertes */}
                <div>
                  <h4 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fortalezas
                  </h4>
                  <div className="space-y-2.5">
                    {top5Altos.map(e => (
                      <BarraElemento key={e.elemento} nombre={e.elemento} puntaje={e.puntaje} total={e.total} />
                    ))}
                  </div>
                </div>

                {/* Todos los elementos */}
                <div className="md:col-span-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Todos los Elementos PSM ({datos.total_elementos})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-auto pr-1">
                    {datos.elementos.map(e => (
                      <BarraElemento key={e.elemento} nombre={e.elemento} puntaje={e.puntaje} total={e.total} />
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
