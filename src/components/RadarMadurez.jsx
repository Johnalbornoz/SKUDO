/**
 * RadarMadurez — Gráfica de araña con mapa de calor para 20 elementos PSM.
 *
 * Uso con datos de diagnóstico:
 *   <RadarMadurez data={diagnosticoData} />
 *   donde diagnosticoData = [{ elemento: 'Nombre', puntaje: 0..100 }, ...]
 *
 * Uso por diagnóstico (refetch al cambiar):
 *   <RadarMadurez diagnosticoId={id} />  → carga GET /api/diagnosticos/:id/radar y se actualiza al cambiar id
 *
 * Sin data ni diagnosticoId: carga desde API (dashboard de madurez global).
 */
import { useState, useEffect, useRef } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Info,
  BarChart3, Building2, MapPin,
} from 'lucide-react';
import apiService from '../services/apiService';

// ─── Mapa de calor: colores semáforo (0–100) ─────────────────────────────────
/** Crítico 0–40: Rojo | En Desarrollo 41–75: Amarillo/Naranja | Maduro 76–100: Verde */
export function getColorForScore(score) {
  const v = Number(score);
  if (v <= 40) return '#ef4444';   // Crítico — Rojo
  if (v <= 75) return '#f59e0b';   // En Desarrollo — Amarillo/Naranja
  return '#10b981';                 // Maduro/Optimizado — Verde
}

/** Etiqueta de nivel de madurez para tooltip y leyenda */
function getNivelMadurezLabel(score) {
  const v = Number(score);
  if (v <= 40) return 'Crítico';
  if (v <= 75) return 'En Desarrollo';
  return 'Maduro/Optimizado';
}

// ─── Configuración de nivel de madurez (cuando no hay data prop) ────────────
const NIVEL_CFG = {
  Optimizado:    { color: '#16a34a', bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700',  min: 80 },
  Gestionado:    { color: '#2563eb', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   min: 60 },
  Definido:      { color: '#d97706', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', min: 40 },
  'En Desarrollo': { color: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', min: 20 },
  Inicial:       { color: '#dc2626', bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    min: 0  },
};

const PUNTAJE_COLOR = (v) =>
  v >= 80 ? '#16a34a' : v >= 60 ? '#2563eb' : v >= 40 ? '#d97706' : v >= 20 ? '#ea580c' : '#dc2626';

// ─── 20 elementos PSM (para mock y abreviaciones) ───────────────────────────
const ELEMENTOS_PSM_20 = [
  'Cultura de Seguridad', 'Integridad Mecánica', 'Auditorías', 'Análisis de Riesgos',
  'Preparación para Emergencias', 'Capacitación y Competencia', 'Cumplimiento de Normas',
  'Mejora Continua', 'Procedimientos Operativos', 'Gestión de Contratistas',
  'Investigación de Incidentes', 'Revisión por la Dirección', 'Métricas e Indicadores',
  'Gestión del Cambio', 'Participación del Trabajador', 'Conocimiento del Proceso',
  'Prácticas de Trabajo Seguro', 'Alcance de las Partes Interesadas', 'Preparación Operativa',
  'Conducción de Operaciones',
];

/** Mock data: 20 elementos PSM con puntajes aleatorios (0–100) para previsualización */
export function getMockRadarData() {
  return ELEMENTOS_PSM_20.map((elemento) => ({
    elemento,
    puntaje: Math.floor(Math.random() * 101),
    fullMark: 100,
  }));
}
export const MOCK_RADAR_PSM = getMockRadarData();

// ─── Tooltip personalizado (elemento, % exacto, nivel de madurez) ────────────
function TooltipCustom({ active, payload }, colorFn = getColorForScore) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const puntaje = d.puntaje ?? 0;
  const color = colorFn(puntaje);
  const nivel = getNivelMadurezLabel(puntaje);
  const nombre = d.nombreCompleto || d.elemento || '';
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs max-w-[260px]">
      <p className="font-bold text-gray-800 mb-1.5" title={nombre}>{nombre || d.elemento}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm" style={{ background: color }} />
        <span className="font-bold tabular-nums" style={{ color }}>
          {puntaje}%
        </span>
        <span className="text-gray-500">madurez</span>
      </div>
      <p className="mt-1.5 font-semibold" style={{ color }}>
        {nivel}
      </p>
      {d.total != null && d.total > 0 && (
        <p className="text-gray-400 mt-0.5">{d.total} pregunta{d.total !== 1 ? 's' : ''} evaluada{d.total !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

// ─── Abreviaciones para el radar (nombres cortos) ───────────────────────────
function abreviar(nombre) {
  if (!nombre) return '';
  if (nombre.length <= 16) return nombre;
  const palabras = nombre.split(/[\s\-/]+/).filter(p => p.length > 2);
  return palabras.slice(0, 2).join(' ');
}

// ─── Barra de madurez de elemento individual ────────────────────────────────
function BarraElemento({ nombre, puntaje, total, colorFn = getColorForScore }) {
  const color = colorFn(puntaje);
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

// ─── Tick customizado: etiqueta del eje pintada con color por puntaje ───────
function CustomTick({ payload, x, y, textAnchor, data }) {
  const label = payload?.value ?? '';
  const index = Array.isArray(data) ? data.findIndex((d) => (d.elemento || d.nombreCompleto) === label) : 0;
  const punto = data?.[index >= 0 ? index : 0];
  const score = punto?.puntaje ?? 0;
  const fill = getColorForScore(score);
  return (
    <g className="recharts-layer recharts-polar-angle-axis-tick">
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontSize={10}
        fontWeight={600}
        className="recharts-text recharts-polar-angle-axis-tick-value"
      >
        <tspan x={x} dy="0.35em">{label}</tspan>
      </text>
    </g>
  );
}

// ─── Punto SVG por vértice: fill según puntaje (mapa de calor) ──────────────
function RadarDotHeat(props) {
  const { cx, cy, payload } = props;
  const puntaje = payload?.puntaje ?? 0;
  const fill = getColorForScore(puntaje);
  return (
    <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={1.5} />
  );
}

// ─── Vista Radar con mapa de calor (20 elementos PSM) ───────────────────────
function RadarChartHeatMap({ data, height = 420 }) {
  const chartData = (data || []).map((d, i) => ({
    ...d,
    elemento: typeof d.elemento === 'string' && d.elemento.length <= 16 ? d.elemento : abreviar(d.elemento),
    nombreCompleto: d.nombreCompleto ?? d.elemento,
    index: i,
  }));

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={chartData} margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
        <PolarGrid stroke="#e5e7eb" strokeOpacity={0.8} />
        <PolarAngleAxis
          dataKey="elemento"
          tick={(props) => <CustomTick {...props} data={chartData} />}
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
          stroke="#9ca3af"
          fill="#9ca3af"
          fillOpacity={0.1}
          strokeWidth={1.5}
          dot={<RadarDotHeat />}
          activeDot={<RadarDotHeat />}
        />
        <Tooltip content={(p) => <TooltipCustom {...p} />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function RadarMadurez({ data: dataProp, diagnosticoId, onIrADiagnostico }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('radar');

  const useDataProp = Array.isArray(dataProp) && dataProp.length > 0;
  const idNum = diagnosticoId != null && diagnosticoId !== '' ? parseInt(diagnosticoId, 10) : null;

  useEffect(() => {
    if (!useDataProp) cargar();
  }, [useDataProp, idNum]); // Refetch al montar, al cambiar de modo o al cambiar diagnóstico

  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const handler = () => { if (!useDataProp) cargarRef.current(); };
    window.addEventListener('skudo:radar-refresh', handler);
    return () => window.removeEventListener('skudo:radar-refresh', handler);
  }, [useDataProp]);

  async function cargar() {
    setLoading(true);
    setError('');
    try {
      let data;
      if (idNum != null && !isNaN(idNum)) {
        const res = await apiService.fetchRadarDiagnostico(idNum);
        setDatos({
          elementos: res.elementos || [],
          nivel_madurez: res.nivel_madurez,
          planta: res.planta,
          area: res.area,
          madurez_global: res.madurez_global,
        });
      } else {
        const res = await apiService.fetchMadurezDashboard();
        setDatos(res);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Datos para el radar: prop directa (20 elementos) o desde API (base + impacto plan_accion)
  const datosRadar = useDataProp
    ? dataProp.map((d) => ({ ...d, elemento: d.elemento, puntaje: Number(d.puntaje) ?? 0, total: d.total }))
    : (datos?.elementos || []).map((e) => ({
        elemento: abreviar(e.elemento),
        nombreCompleto: e.elemento,
        puntaje: e.puntaje,
        total: e.total,
      }));

  // Depuración: confirmar que los puntajes traen la suma dinámica (base + plan de acción)
  if (!useDataProp && datos?.elementos?.length) {
    console.log('[RadarMadurez] Datos al gráfico (base + impacto plan_accion):', datos.elementos);
  }

  const cfg = datos ? (NIVEL_CFG[datos.nivel_madurez] || NIVEL_CFG.Inicial) : null;
  const top5Bajos = useDataProp
    ? [...dataProp].sort((a, b) => (a.puntaje ?? 0) - (b.puntaje ?? 0)).slice(0, 5)
    : [...(datos?.elementos || [])].sort((a, b) => a.puntaje - b.puntaje).slice(0, 5);
  const top5Altos = useDataProp
    ? [...dataProp].sort((a, b) => (b.puntaje ?? 0) - (a.puntaje ?? 0)).slice(0, 5)
    : [...(datos?.elementos || [])].sort((a, b) => b.puntaje - a.puntaje).slice(0, 5);

  // Modo solo gráfica: se pasó data (ej. diagnosticoData con 20 elementos)
  if (useDataProp) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 rounded-xl">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Gráfica de Araña con Mapa de Calor</h2>
              <p className="text-xs text-gray-500 mt-0.5">20 elementos PSM · Color por nivel de madurez</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <RadarChartHeatMap data={dataProp} height={420} />
          <div className="mt-4 flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" /> ≤40% Crítico
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> 41–75% En Desarrollo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#10b981]" /> &gt;75% Maduro/Optimizado
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Modo dashboard (carga desde API)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
          <button onClick={cargar} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Calculando madurez PSM…</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Error al cargar: {error}</span>
          </div>
        )}

        {!loading && !error && datos && datos.total_elementos === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-600 font-semibold">Sin datos de madurez</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">Completa un diagnóstico PSM para ver el radar de madurez por elemento.</p>
            {onIrADiagnostico && (
              <button onClick={onIrADiagnostico} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg">
                Iniciar Diagnóstico
              </button>
            )}
          </div>
        )}

        {!loading && !error && datos && datos.total_elementos > 0 && (
          <div className="space-y-6">
            <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Índice de Madurez Global</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-black" style={{ color: cfg.color }}>{datos.madurez_global}%</span>
                    <span className={`text-sm font-bold ${cfg.text}`}>{datos.nivel_madurez}</span>
                  </div>
                </div>
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={cfg.color} strokeWidth="3"
                      strokeDasharray={`${(datos.madurez_global / 100) * 100} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ color: cfg.color }}>{datos.madurez_global}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                {['Inicial', 'En Desarrollo', 'Definido', 'Gestionado', 'Optimizado'].map((n) => {
                  const isActive = n === datos.nivel_madurez;
                  const c = NIVEL_CFG[n];
                  return (
                    <div key={n} className="flex-1">
                      <div className={`h-1.5 rounded-full transition-all ${isActive ? '' : 'opacity-30'}`} style={{ background: c.color }} />
                      {isActive && <p className="text-[9px] font-bold text-center mt-0.5" style={{ color: c.color }}>{n}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {vista === 'radar' && datosRadar.length > 0 && (
              <div>
                <RadarChartHeatMap data={datosRadar} height={360} />
                <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ef4444]" /> ≤40% Crítico
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> 41–75% En Desarrollo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#10b981]" /> &gt;75% Maduro/Optimizado
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-gray-400 mt-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Basado en el diagnóstico #{datos.diagnostico_id}. Nivel calculado: <strong>{datos.nivel_calculado || 'N/D'}</strong>. {datos.total_elementos} elementos PSM evaluados.</span>
                </div>
              </div>
            )}

            {vista === 'lista' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Áreas de Mejora
                  </h4>
                  <div className="space-y-2.5">
                    {top5Bajos.map((e, i) => (
                      <BarraElemento key={e.elemento + i} nombre={e.elemento} puntaje={e.puntaje} total={e.total} colorFn={getColorForScore} />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fortalezas
                  </h4>
                  <div className="space-y-2.5">
                    {top5Altos.map((e, i) => (
                      <BarraElemento key={e.elemento + i} nombre={e.elemento} puntaje={e.puntaje} total={e.total} colorFn={getColorForScore} />
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Todos los Elementos PSM ({datos.total_elementos})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-auto pr-1">
                    {datos.elementos.map((e, i) => (
                      <BarraElemento key={e.elemento + i} nombre={e.elemento} puntaje={e.puntaje} total={e.total} colorFn={getColorForScore} />
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
