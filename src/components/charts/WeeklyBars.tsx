import type { ComponentProps } from 'react';
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART } from '../../styles/chartColors';

interface Week {
  x: number;
  value: number;
  /** Stacked on top of `value` in a muted colour (e.g. skipped days). */
  extra?: number;
}

interface Props {
  data: Week[];
  label: string;
  /** Tooltip text for a bar, e.g. "14 working sets". */
  format: (value: number) => string;
  height?: number;
  /** A dashed target line. */
  goal?: number;
  /** Legend names; the legend shows only with a goal or extra values. */
  valueLabel?: string;
  extraLabel?: string;
  formatExtra?: (extra: number) => string;
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const TOP = [4, 4, 0, 0] as [number, number, number, number];

/** Whole-number ticks from 0 that reach both the tallest bar and the goal (every 1 up to 6, then wider). */
function countTicks(data: Week[], goal: number): number[] {
  const top = Math.max(goal, ...data.map((d) => d.value + (d.extra ?? 0)));
  const step = top <= 6 ? 1 : Math.ceil(top / 5);
  return Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => i * step);
}

/**
 * Columns ≤ 18px wide with air between them, 4px rounded tops, one baseline,
 * hover/tap tooltip per bar. Optionally a stacked muted segment and a dashed goal line.
 */
export default function WeeklyBars({ data, label, format, height = 200, goal, valueLabel, extraLabel, formatExtra }: Props) {
  const every = Math.ceil(data.length / 4);
  const stacked = data.some((d) => (d.extra ?? 0) > 0);
  const legend = goal !== undefined || stacked;
  const yTicks = goal === undefined ? undefined : countTicks(data, goal);
  return (
    <div className="trend-chart" role="img" aria-label={label}>
      {legend && (
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-key chart-key-bar" style={{ background: CHART.accent }} aria-hidden="true" />
            {valueLabel}
          </span>
          {stacked && (
            <span className="chart-legend-item">
              <span className="chart-key chart-key-bar" style={{ background: CHART.faint }} aria-hidden="true" />
              {extraLabel}
            </span>
          )}
          {goal !== undefined && (
            <span className="chart-legend-item">
              <span className="chart-key chart-key-dashed" aria-hidden="true" />
              Target {goal}
            </span>
          )}
        </div>
      )}
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
            ticks={yTicks}
            domain={yTicks ? [0, yTicks.at(-1)!] : undefined}
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
                  {(p.extra ?? 0) > 0 && formatExtra && (
                    <div className="chart-tooltip-row">
                      <strong>{formatExtra(p.extra!)}</strong>
                    </div>
                  )}
                </div>
              );
            }}
          />
          {stacked ? (
            <Bar
              dataKey="value"
              stackId="week"
              fill={CHART.accent}
              maxBarSize={18}
              isAnimationActive={false}
              // Round the top only where nothing is stacked above.
              shape={(props: ComponentProps<typeof Rectangle> & { payload?: Week }) => (
                <Rectangle {...props} radius={(props.payload?.extra ?? 0) > 0 ? 0 : TOP} />
              )}
            />
          ) : (
            <Bar dataKey="value" fill={CHART.accent} radius={TOP} maxBarSize={18} isAnimationActive={false} />
          )}
          {stacked && (
            <Bar dataKey="extra" stackId="week" fill={CHART.faint} radius={TOP} maxBarSize={18} isAnimationActive={false} />
          )}
          {goal !== undefined && (
            <ReferenceLine y={goal} stroke={CHART.text} strokeWidth={1.5} strokeDasharray="4 4" ifOverflow="extendDomain" />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
