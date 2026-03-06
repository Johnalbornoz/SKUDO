/**
 * Radar de Madurez PSM — Gráfica dinámica con gradiente de color por valor de cada elemento.
 * Colores: bajo (rojo) → medio-bajo (naranja) → medio (ámbar) → alto (verde).
 */

import React, { useMemo, useId } from 'react';
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

export type RadarDatum = {
  subject: string;
  value: number;
  fullMark?: number;
};

const DEFAULT_FULL_MARK = 100;

/** Devuelve color según valor: 0-25 rojo, 26-50 naranja, 51-75 ámbar, 76-100 verde */
export function getColorByValue(value: number, fullMark: number = DEFAULT_FULL_MARK): string {
  const pct = fullMark > 0 ? (value / fullMark) * 100 : 0;
  if (pct >= 76) return '#10B981'; // brand-green
  if (pct >= 51) return '#EAB308'; // amber/yellow
  if (pct >= 26) return '#F59E0B'; // orange/amber
  return '#EF4444'; // red
}

/** Gradiente CSS entre dos colores según ratio 0..1 */
function interpolateColor(from: string, to: string, ratio: number): string {
  const hex = (s: string) => {
    const m = s.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? m.slice(1).map((x) => parseInt(x, 16)) : [0, 0, 0];
  };
  const [r1, g1, b1] = hex(from);
  const [r2, g2, b2] = hex(to);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `rgb(${r},${g},${b})`;
}

type RadarMadurezPSMProps = {
  data: RadarDatum[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  fullMark?: number;
};

export default function RadarMadurezPSM({
  data,
  title = 'Radar de Madurez PSM',
  height = 420,
  showLegend = true,
  fullMark = DEFAULT_FULL_MARK,
}: RadarMadurezPSMProps) {
  const dataWithColor = useMemo(() => {
    return data.map((d) => ({
      ...d,
      fullMark: d.fullMark ?? fullMark,
      fill: getColorByValue(d.value, d.fullMark ?? fullMark),
    }));
  }, [data, fullMark]);

  const avgValue = useMemo(() => {
    if (!dataWithColor.length) return 0;
    const sum = dataWithColor.reduce((a, d) => a + d.value, 0);
    return sum / dataWithColor.length;
  }, [dataWithColor]);

  const avgPct = fullMark > 0 ? (avgValue / fullMark) * 100 : 0;
  const fillGradientColor = interpolateColor('#EF4444', '#10B981', avgPct / 100);
  const gradientId = useId().replace(/:/g, '-');

  const customDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = getColorByValue(payload.value, payload.fullMark ?? fullMark);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.15))' }}
      />
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Cada eje se colorea según el nivel de madurez (rojo → naranja → ámbar → verde).
          </p>
        </div>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dataWithColor}>
            <defs>
              <radialGradient id={`radarFillByValue-${gradientId}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={fillGradientColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={fillGradientColor} stopOpacity={0.08} />
              </radialGradient>
            </defs>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
              tickLine={{ stroke: '#D1D5DB' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, fullMark]}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              tickCount={5}
            />
            <Radar
              name="Madurez"
              dataKey="value"
              strokeWidth={2}
              fill={`url(#radarFillByValue-${gradientId})`}
              stroke={fillGradientColor}
              dot={customDot}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 12px rgba(0,0,0,.08)',
              }}
              formatter={(value: number, _name: string, props: { payload: RadarDatum & { fill?: string } }) => {
                const color = getColorByValue(value, props.payload.fullMark ?? fullMark);
                const pct = fullMark > 0 ? Math.round((value / fullMark) * 100) : 0;
                return [
                  <span key="v">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: color }}
                    />
                    {value} / {fullMark} ({pct}%)
                  </span>,
                  'Madurez',
                ];
              }}
              labelFormatter={(label) => <span className="font-semibold text-gray-900">{label}</span>}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ paddingTop: 8 }}
                formatter={() => (
                  <span className="text-xs text-gray-500">
                    Verde ≥76% · Ámbar 51–75% · Naranja 26–50% · Rojo ≤25%
                  </span>
                )}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
