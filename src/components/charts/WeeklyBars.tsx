import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART } from '../../styles/chartColors';

interface Week {
  x: number;
  value: number;
}

interface Props {
  data: Week[];
  label: string;
  /** Tooltip text for a bar, e.g. "14 working sets". */
  format: (value: number) => string;
  height?: number;
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Columns ≤ 18px wide with air between them, 4px rounded tops, one baseline, hover/tap tooltip per bar. */
export default function WeeklyBars({ data, label, format, height = 200 }: Props) {
  const every = Math.ceil(data.length / 4);
  return (
    <div className="trend-chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
          <XAxis
            dataKey="x"
            tickFormatter={shortDate}
            interval={every - 1}
            tick={{ fill: CHART.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tick={{ fill: CHART.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(245, 245, 244, 0.06)' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Week | undefined;
              if (!active || !p) return null;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-date">Week of {shortDate(p.x)}</div>
                  <div className="chart-tooltip-row">
                    <strong>{format(p.value)}</strong>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
