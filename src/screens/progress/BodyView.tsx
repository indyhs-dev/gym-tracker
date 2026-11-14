import { useState } from 'react';
import TrendChart from '../../components/charts/TrendChart';
import Segmented from '../../components/Segmented';
import { useScans } from '../../db/bodyScans';
import type { BodyScan, ScanBalance, ScanField, ScanRating } from '../../db/types';
import { dateMs, formatChange, leftRightBalance, scanTicks, upperLowerBalance } from '../../lib/bodyScan';
import { formatKg } from '../../lib/format';
import { CHART } from '../../styles/chartColors';
import ScanSheet from '../body/ScanSheet';

/** "4 Nov 2026" */
const scanDate = (date: string) => new Date(dateMs(date)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The Body view in Progress: latest scan on a body outline, balance, headline numbers, charts and every scan. */
export default function BodyView() {
  const scans = useScans();
  // undefined = closed, null = adding, a scan = editing it.
  const [editing, setEditing] = useState<BodyScan | null | undefined>(undefined);

  if (!scans) return null;
  const [latest, previous] = scans;

  return (
    <>
      {latest ? (
        <>
          <BodyDiagram scan={latest} />
          <BalanceCard scan={latest} />
          <Headline latest={latest} previous={previous} />
          <Charts scans={scans} />
          <section className="card">
            <h2 className="card-title">Scans</h2>
            <ul className="list scan-list">
              {scans.map((s) => (
                <li key={s.id}>
                  <button type="button" className="list-row" onClick={() => setEditing(s)}>
                    <span className="row-text">
                      <span className="row-title">{scanDate(s.date)}</span>
                      <span className="row-meta">{scanSummary(s)}</span>
                    </span>
                    <span className="chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <button type="button" className="btn btn-block scan-add" onClick={() => setEditing(null)}>
            Add scan
          </button>
        </>
      ) : (
        <>
          <p className="empty">Paste your first Evolt scan to see your body here.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing(null)}>
            Add scan
          </button>
        </>
      )}
      {editing !== undefined && <ScanSheet scan={editing ?? undefined} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function scanSummary(s: BodyScan): string {
  const v = s.values;
  const parts = [
    v.weight && `${v.weight.value.toFixed(1)} kg`,
    v.skeletalMuscleMass && `muscle ${v.skeletalMuscleMass.value.toFixed(1)} kg`,
    v.bodyFatPercentage && `fat ${v.bodyFatPercentage.value.toFixed(1)}%`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Date only';
}

const RATING_CLASS: Record<ScanRating, string> = { Under: 'is-under', Optimal: 'is-optimal', High: 'is-high' };

const AREAS: { key: ScanField; name: string; side: 'left' | 'right'; y: number }[] = [
  { key: 'leftArmLean', name: 'Left arm', side: 'left', y: 72 },
  { key: 'rightArmLean', name: 'Right arm', side: 'right', y: 72 },
  { key: 'torsoLean', name: 'Torso', side: 'right', y: 116 },
  { key: 'leftLegLean', name: 'Left leg', side: 'left', y: 188 },
  { key: 'rightLegLean', name: 'Right leg', side: 'right', y: 188 },
];

function BodyDiagram({ scan }: { scan: BodyScan }) {
  const area = (key: ScanField) => {
    const r = scan.values[key]?.rating;
    return `body-area ${r ? RATING_CLASS[r] : 'is-none'}`;
  };
  const caption = (key: ScanField) => {
    const m = scan.values[key];
    if (!m) return 'No data';
    return `${m.value.toFixed(2)} · ${m.rating ?? 'No rating'}`;
  };
  const summary = AREAS.map((a) => `${a.name} ${caption(a.key)}`).join(', ');

  return (
    <section className="card body-card">
      <div className="body-card-head">
        <h2 className="card-title">Lean mass</h2>
        <span className="row-meta">{scanDate(scan.date)} · kg</span>
      </div>
      <svg className="body-diagram" viewBox="0 0 300 250" role="img" aria-label={`Lean mass by area: ${summary}`}>
        <circle className="body-head" cx="150" cy="22" r="15" />
        <rect className={area('torsoLean')} x="122" y="42" width="56" height="88" rx="12" />
        <rect className={area('leftArmLean')} x="100" y="46" width="18" height="80" rx="9" />
        <rect className={area('rightArmLean')} x="182" y="46" width="18" height="80" rx="9" />
        <rect className={area('leftLegLean')} x="124" y="134" width="24" height="104" rx="11" />
        <rect className={area('rightLegLean')} x="152" y="134" width="24" height="104" rx="11" />
        {scan.upperLower === 'Unbalanced' && <line className="body-waist" x1="108" y1="132" x2="192" y2="132" />}
        {AREAS.map((a) => {
          const x = a.side === 'left' ? 8 : 292;
          const anchor = a.side === 'left' ? 'start' : 'end';
          return (
            <g key={a.key} aria-hidden="true">
              <text className="body-label" x={x} y={a.y} textAnchor={anchor}>
                {a.name}
              </text>
              <text className="body-value" x={x} y={a.y + 17} textAnchor={anchor}>
                {caption(a.key)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="body-legend" aria-hidden="true">
        <span>
          <span className="body-key is-under" />
          Under
        </span>
        <span>
          <span className="body-key is-optimal" />
          Optimal
        </span>
        <span>
          <span className="body-key is-high" />
          High
        </span>
      </div>
    </section>
  );
}

function BalanceCard({ scan }: { scan: BodyScan }) {
  const rows: { label: string; flag: ScanBalance | null; text: string | null }[] = [
    { label: 'Upper vs lower', flag: scan.upperLower, text: upperLowerBalance(scan)?.text ?? null },
    { label: 'Left vs right', flag: scan.leftRight, text: leftRightBalance(scan) },
  ].filter((r) => r.flag || r.text);
  if (rows.length === 0) return null;
  return (
    <section className="card balance-card">
      <h2 className="card-title">Balance</h2>
      {rows.map((r) => (
        <div key={r.label} className="balance-row">
          <div className="balance-head">
            <span className="balance-label">{r.label}</span>
            {r.flag && <span className={r.flag === 'Unbalanced' ? 'balance-pill is-unbalanced' : 'balance-pill'}>{r.flag}</span>}
          </div>
          {r.text && <p className="row-meta">{r.text}</p>}
        </div>
      ))}
    </section>
  );
}

const HEADLINE: { key: ScanField; label: string; unit: string; decimals: number }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', decimals: 1 },
  { key: 'skeletalMuscleMass', label: 'Skeletal muscle', unit: 'kg', decimals: 1 },
  { key: 'bodyFatPercentage', label: 'Body fat', unit: '%', decimals: 1 },
  { key: 'visceralFatLevel', label: 'Visceral fat level', unit: '', decimals: 0 },
];

function Headline({ latest, previous }: { latest: BodyScan; previous: BodyScan | undefined }) {
  const items = HEADLINE.filter((h) => latest.values[h.key]);
  if (items.length === 0) return null;
  return (
    <section className="card">
      <h2 className="card-title">Latest scan</h2>
      <div className="scan-stats">
        {items.map((h) => {
          const now = latest.values[h.key]!.value;
          const before = previous?.values[h.key]?.value;
          return (
            <div key={h.key} className="scan-stat">
              <span className="row-meta">{h.label}</span>
              <span className="scan-stat-value">
                {now.toFixed(h.decimals)}
                {h.unit && <span className="scan-stat-unit">{h.unit === '%' ? '%' : ` ${h.unit}`}</span>}
              </span>
              <span className="row-meta">
                {before === undefined ? 'No earlier scan' : `${formatChange(now - before, h.decimals)} since ${scanDate(previous!.date)}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type Region = 'arms' | 'torso' | 'legs';

function Charts({ scans }: { scans: BodyScan[] }) {
  const [region, setRegion] = useState<Region>('legs');
  const oldestFirst = [...scans].reverse();
  const points = (key: ScanField) =>
    oldestFirst.filter((s) => s.values[key]).map((s) => ({ x: dateMs(s.date), v: s.values[key]!.value }));

  const single = (key: ScanField, title: string, unit: string) => {
    const data = points(key);
    if (data.length < 2) return null;
    const fmt = (v: number) => (unit === '%' ? `${formatKg(v)}%` : `${formatKg(v)} ${unit}`);
    return (
      <section className="card chart-card" key={key}>
        <h2 className="chart-title">{title}</h2>
        <p className="chart-subtitle">{unit}</p>
        <TrendChart
          data={data.map((p) => ({ x: p.x, v: p.v }))}
          series={[{ key: 'v', label: title, color: CHART.accent, format: fmt }]}
          yTick={(v) => formatKg(v)}
          yTicks={scanTicks(data.map((p) => p.v))}
          label={`${title} over time`}
          height={180}
        />
      </section>
    );
  };

  const pairs: Record<Region, { left: ScanField; right?: ScanField }> = {
    arms: { left: 'leftArmLean', right: 'rightArmLean' },
    torso: { left: 'torsoLean' },
    legs: { left: 'leftLegLean', right: 'rightLegLean' },
  };
  const pair = pairs[region];
  const leanData = oldestFirst
    .filter((s) => s.values[pair.left] || (pair.right && s.values[pair.right]))
    .map((s) => ({
      x: dateMs(s.date),
      left: s.values[pair.left]?.value ?? null,
      ...(pair.right ? { right: s.values[pair.right]?.value ?? null } : {}),
    }));
  const anyLean = (['leftArmLean', 'torsoLean', 'leftLegLean'] as ScanField[]).some((k) => points(k).length >= 2);
  const kgFmt = (v: number) => `${v.toFixed(2)} kg`;

  return (
    <>
      {single('weight', 'Weight', 'kg')}
      {single('skeletalMuscleMass', 'Skeletal muscle mass', 'kg')}
      {single('bodyFatPercentage', 'Body fat', '%')}
      {anyLean && (
        <section className="card chart-card">
          <h2 className="chart-title">Lean mass by area</h2>
          <p className="chart-subtitle">kg</p>
          <div className="chart-picker">
            <Segmented
              label="Area"
              options={[
                { value: 'arms', label: 'Arms' },
                { value: 'torso', label: 'Torso' },
                { value: 'legs', label: 'Legs' },
              ]}
              value={region}
              onChange={setRegion}
            />
          </div>
          {leanData.length >= 2 ? (
            <TrendChart
              data={leanData}
              series={
                pair.right
                  ? [
                      { key: 'left', label: 'Left', color: CHART.accent, format: kgFmt },
                      { key: 'right', label: 'Right', color: CHART.text, format: kgFmt },
                    ]
                  : [{ key: 'left', label: 'Torso', color: CHART.accent, format: kgFmt }]
              }
              yTick={(v) => formatKg(v)}
              yTicks={scanTicks(leanData.flatMap((p) => [p.left, p.right ?? null]).filter((v): v is number => v !== null))}
              label={`Lean mass over time: ${region}`}
              height={180}
            />
          ) : (
            <p className="row-meta chart-none">Not enough scans with this area yet.</p>
          )}
        </section>
      )}
    </>
  );
}
