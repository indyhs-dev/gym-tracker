import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART } from '../../styles/chartColors';

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Value as shown in labels and the tooltip, e.g. "27.5 kg". */
  format: (value: number, point: TrendPoint) => string;
}

export interface TrendPoint {
  x: number; // epoch ms
  [key: string]: number | null;
}

interface Props {
  data: TrendPoint[];
  series: Series[];
  /** Short tick label for the y axis, e.g. kg values. */
  yTick?: (value: number) => string;
  height?: number;
  label: string;
  /** Fixed y ticks (the axis then spans exactly from the first to the last). */
  yTicks?: number[];
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Up to `max` evenly spaced points from the data, always including the first and last. */
function pickTicks(xs: number[], max = 4): number[] {
  if (xs.length <= max) return xs;
  return Array.from({ length: max }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (max - 1))]);
}

/**
 * Line chart over time: 2px lines, ringed dots, hairline grid, one y axis,
 * a crosshair tooltip listing every series, and end labels when they don't collide.
 */
export default function TrendChart({ data, series, yTick = (v) => String(v), height = 220, label, yTicks }: Props) {
  const last = data.at(-1);
  const values = data.flatMap((p) => series.map((s) => p[s.key])).filter((v): v is number => v !== null);
  const range = Math.max(...values) - Math.min(...values) || 1;
  const lastValues = series.map((s) => last?.[s.key] ?? null);
  // Only label line ends when they're far enough apart not to collide.
  const showEndLabels =
    lastValues.every((v) => v !== null) &&
    lastValues.every((v, i) => lastValues.every((w, j) => i === j || Math.abs(v! - w!) / range > 0.12));

  return (
    <div className="trend-chart" role="img" aria-label={label}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.key} className="chart-legend-item">
              <span className="chart-key" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: showEndLabels ? 44 : 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
          <XAxis
            dataKey="x"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={pickTicks(data.map((p) => p.x))}
            tickFormatter={shortDate}
            tick={{ fill: CHART.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            width={40}
            // A little headroom so the lowest/highest points don't sit on the frame (never below 0).
            domain={
              yTicks
                ? [yTicks[0], yTicks.at(-1)!]
                : [
                    (min: number) => Math.max(0, Math.floor(min - Math.max(1, min * 0.08))),
                    (max: number) => Math.ceil(max + Math.max(1, max * 0.05)),
                  ]
            }
            ticks={yTicks}
            tickFormatter={yTick}
            tick={{ fill: CHART.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: CHART.faint, strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TrendPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-date">{shortDate(point.x)}</div>
                  {series.map((s) =>
                    point[s.key] === null ? null : (
                      <div key={s.key} className="chart-tooltip-row">
                        <span className="chart-key" style={{ background: s.color }} aria-hidden="true" />
                        <strong>{s.format(point[s.key] as number, point)}</strong>
                        <span>{s.label}</span>
                      </div>
                    ),
                  )}
                </div>
              );
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="linear"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              isAnimationActive={false}
              dot={{ r: 4, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
            >
              {showEndLabels && (
                <LabelList
                  dataKey={s.key}
                  content={({ x, y, index, value }) =>
                    index === data.length - 1 && typeof value === 'number' ? (
                      <text x={Number(x) + 9} y={Number(y) + 4} fill={CHART.text} fontSize={13} fontWeight={600}>
                        {yTick(value)}
                      </text>
                    ) : null
                  }
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
