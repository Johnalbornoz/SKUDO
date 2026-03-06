/**
 * GraficaCumplimientoElementos — Diagrama de Pareto (barras horizontales) por elemento PSM.
 * Misma data que el Radar: [{ elemento, puntaje (0-100), ... }].
 * Orden: menor a mayor puntaje (elementos más críticos arriba).
 * Colores semáforo vía getColorForScore.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList,
} from 'recharts';
import { getColorForScore } from './RadarMadurez';

const DEFAULT_HEIGHT = 420;

/** Ordena de menor a mayor puntaje (críticos arriba) */
function sortByScoreAsc(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return [...data]
    .map((d) => ({ ...d, puntaje: Number(d.puntaje) ?? 0 }))
    .sort((a, b) => a.puntaje - b.puntaje);
}

function TooltipBar({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = getColorForScore(d.puntaje ?? 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs max-w-[280px]">
      <p className="font-bold text-gray-800">{d.elemento}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="font-semibold tabular-nums" style={{ color }}>{d.puntaje ?? 0}%</span>
        <span className="text-gray-500">cumplimiento</span>
      </div>
    </div>
  );
}

/** Etiqueta al final o dentro de la barra: "35%" */
function RenderBarLabel(props) {
  const { x, y, width, height, value, payload } = props;
  const puntaje = typeof value === 'number' ? value : payload?.puntaje ?? 0;
  const color = getColorForScore(puntaje);
  const showInside = width > 50;
  const labelX = showInside ? x + width - 36 : x + width + 6;
  return (
    <text
      x={labelX}
      y={y + height / 2}
      fill={showInside ? '#fff' : color}
      textAnchor="start"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={700}
    >
      {puntaje}%
    </text>
  );
}

export default function GraficaCumplimientoElementos({ data, height = DEFAULT_HEIGHT }) {
  const sorted = sortByScoreAsc(data ?? []);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50/50" style={{ height }}>
        <p className="text-sm text-gray-500">Sin datos de cumplimiento</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={sorted}
        margin={{ top: 8, right: 40, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${v}%`} />
        <YAxis
          type="category"
          dataKey="elemento"
          width={165}
          tick={{ fontSize: 10, fill: '#374151', fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<TooltipBar />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="puntaje" name="Cumplimiento" radius={[0, 4, 4, 0]} maxBarSize={28} minPointSize={4}>
          <LabelList content={<RenderBarLabel />} position="right" />
          {sorted.map((entry, index) => (
            <Cell key={entry.elemento ?? index} fill={getColorForScore(entry.puntaje ?? 0)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
