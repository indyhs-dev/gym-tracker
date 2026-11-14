import type { BodyScan, ScanBalance, ScanField, ScanMeasure, ScanRating } from '../db/types';
import { addDays, startOfWeek, toDateInput } from './time';

/** First due date, used until a scan is saved. */
export const FIRST_SCAN_DUE = '2026-12-16';
export const SCAN_INTERVAL_DAYS = 42;

export type ScanGroup = 'composition' | 'segmental';

export interface ScanFieldInfo {
  key: ScanField;
  /** Label as used in the paste format and the form. */
  label: string;
  unit: string;
  group: ScanGroup;
  /** Evolt gives this one a rating (and usually a range). */
  rated: boolean;
  /** Other labels accepted when pasting, e.g. the Evolt report's own names. */
  aliases?: string[];
}

const SEGMENTS = [
  { key: 'leftArm', label: 'Left Arm' },
  { key: 'rightArm', label: 'Right Arm' },
  { key: 'torso', label: 'Torso', alias: 'Trunk' },
  { key: 'leftLeg', label: 'Left Leg' },
  { key: 'rightLeg', label: 'Right Leg' },
] as const;

export const SCAN_FIELDS: ScanFieldInfo[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', group: 'composition', rated: false, aliases: ['Body Weight'] },
  { key: 'leanBodyMass', label: 'Lean Body Mass', unit: 'kg', group: 'composition', rated: true },
  { key: 'skeletalMuscleMass', label: 'Skeletal Muscle Mass', unit: 'kg', group: 'composition', rated: true },
  { key: 'protein', label: 'Protein', unit: 'kg', group: 'composition', rated: true },
  { key: 'mineral', label: 'Mineral', unit: 'kg', group: 'composition', rated: true, aliases: ['Minerals'] },
  { key: 'totalBodyWater', label: 'Total Body Water', unit: 'kg', group: 'composition', rated: true },
  { key: 'bodyFatMass', label: 'Body Fat Mass', unit: 'kg', group: 'composition', rated: true },
  { key: 'subcutaneousFatMass', label: 'Subcutaneous Fat Mass', unit: 'kg', group: 'composition', rated: false },
  { key: 'visceralFatMass', label: 'Visceral Fat Mass', unit: 'kg', group: 'composition', rated: false },
  { key: 'visceralFatArea', label: 'Visceral Fat Area', unit: 'cm²', group: 'composition', rated: true },
  {
    key: 'bodyFatPercentage',
    label: 'Body Fat Percentage',
    unit: '%',
    group: 'composition',
    rated: true,
    aliases: ['Total Body Fat Percentage', 'Body Fat %', 'Total Body Fat %'],
  },
  { key: 'visceralFatLevel', label: 'Visceral Fat Level', unit: '', group: 'composition', rated: true },
  { key: 'intracellularFluid', label: 'Intracellular Fluid', unit: 'kg', group: 'composition', rated: false, aliases: ['ICF'] },
  { key: 'extracellularFluid', label: 'Extracellular Fluid', unit: 'kg', group: 'composition', rated: false, aliases: ['ECF'] },
  { key: 'bioAge', label: 'Bio Age', unit: '', group: 'composition', rated: false, aliases: ['Biological Age'] },
  { key: 'bwiScore', label: 'BWI Score', unit: '', group: 'composition', rated: false, aliases: ['BWI'] },
  { key: 'abdominalCircumference', label: 'Abdominal Circumference', unit: 'cm', group: 'composition', rated: false },
  { key: 'waistToHipRatio', label: 'Waist to Hip Ratio', unit: '', group: 'composition', rated: true, aliases: ['WHR'] },
  ...SEGMENTS.flatMap((seg) =>
    (['Lean', 'Fat'] as const).map(
      (kind): ScanFieldInfo => ({
        key: `${seg.key}${kind}` as ScanField,
        label: `${seg.label} ${kind}`,
        unit: 'kg',
        group: 'segmental',
        rated: true,
        aliases: [
          `${seg.label} ${kind} Mass`,
          `${kind} ${seg.label}`,
          `${kind} Mass ${seg.label}`,
          ...('alias' in seg ? [`${seg.alias} ${kind}`, `${seg.alias} ${kind} Mass`] : []),
        ],
      }),
    ),
  ),
];

export const FIELD_INFO = new Map(SCAN_FIELDS.map((f) => [f.key, f]));

/** "10. Intracellular Fluid (ICF) kg/lbs" → "intracellularfluid"; "8. Visceral Fat Mass kg/lbs/%" → "visceralfatmass". */
export function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/^\s*\d+\s*[.)]\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bkg\/lbs(?:\/%)?/g, ' ')
    .replace(/\b(kg|lbs|cm2|cm|kcal)\b/g, ' ')
    .replace(/[^a-z0-9%]/g, '');
}

const LABELS = new Map<string, ScanField>();
for (const f of SCAN_FIELDS) {
  for (const name of [f.label, ...(f.aliases ?? [])]) LABELS.set(normaliseLabel(name), f.key);
}
const DATE_LABELS = new Set(['date', 'scandate', 'datetime']);
const UPPER_LOWER_LABELS = new Set(['upperlowerbalance', 'upperlower', 'upperlowerbodybalance']);
const LEFT_RIGHT_LABELS = new Set(['leftrightbalance', 'leftright', 'leftrightbodybalance']);

const NUM = String.raw`-?\d+(?:[.,]\d+)?`;
const num = (s: string) => Number(s.replace(',', '.'));

const RATINGS: Record<string, ScanRating> = {
  under: 'Under',
  low: 'Under',
  optimal: 'Optimal',
  normal: 'Optimal',
  high: 'High',
  over: 'High',
};

/** "65.0 / Optimal [55.0 - 68.0]" → a measure. Units are ignored. Null if there's no number first. */
export function parseMeasure(text: string): ScanMeasure | null {
  const value = text.trim().match(new RegExp(`^(${NUM})`));
  if (!value) return null;
  const m: ScanMeasure = { value: num(value[1]) };
  // The first "/ word" that is a rating (so a "kg/lbs" unit before it is skipped).
  for (const r of text.matchAll(/\/\s*([a-z]+)/gi)) {
    const rating = RATINGS[r[1].toLowerCase()];
    if (rating) {
      m.rating = rating;
      break;
    }
  }
  const range = text.match(new RegExp(`\\[\\s*(${NUM})\\s*[-–—]\\s*(${NUM})\\s*\\]`));
  if (range) {
    m.min = num(range[1]);
    m.max = num(range[2]);
  } else {
    const share = text.match(new RegExp(`\\[\\s*(${NUM})\\s*%\\s*\\]`));
    if (share) m.share = num(share[1]);
  }
  return m;
}

/** "03-02-2027 09:30" or "2027-02-03" → { date: "2027-02-03", time: "09:30" }. Null if it isn't a real date. */
export function parseScanDate(text: string): { date: string; time: string | null } | null {
  const t = text.trim();
  let y: number, mo: number, d: number;
  const ymd = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const dmy = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (ymd) [y, mo, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else if (dmy) [d, mo, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const tm = t.match(/(\d{1,2}):(\d{2})/);
  const time = tm && Number(tm[1]) < 24 && Number(tm[2]) < 60 ? `${pad(Number(tm[1]))}:${tm[2]}` : null;
  return { date: `${y}-${pad(mo)}-${pad(d)}`, time };
}

function parseBalance(text: string): ScanBalance | null {
  const t = text.trim().toLowerCase();
  if (t.startsWith('unbalanced') || t.startsWith('imbalanced')) return 'Unbalanced';
  if (t.startsWith('balanced')) return 'Balanced';
  return null;
}

export interface ParsedScan {
  date: string | null;
  time: string | null;
  values: Partial<Record<ScanField, ScanMeasure>>;
  upperLower: ScanBalance | null;
  leftRight: ScanBalance | null;
  /** How many lines were understood. */
  found: number;
}

/**
 * Reads pasted scan text: one field per line, "Label: value / Rating [min - max]".
 * Labels match regardless of case, punctuation and order; unknown lines are ignored.
 * A line with no colon is split before its first number, so "Bio Age 20" still reads.
 */
export function parseScanText(text: string): ParsedScan {
  const out: ParsedScan = { date: null, time: null, values: {}, upperLower: null, leftRight: null, found: 0 };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    let label: string, rest: string;
    if (colon > 0) {
      label = line.slice(0, colon);
      rest = line.slice(colon + 1);
    } else {
      const first = line.search(/\d/);
      if (first <= 0) continue;
      label = line.slice(0, first);
      rest = line.slice(first);
    }
    const key = normaliseLabel(label);
    if (DATE_LABELS.has(key)) {
      const d = parseScanDate(rest);
      if (d) {
        out.date = d.date;
        out.time = d.time;
        out.found++;
      }
    } else if (UPPER_LOWER_LABELS.has(key) || LEFT_RIGHT_LABELS.has(key)) {
      const b = parseBalance(rest);
      if (b) {
        if (UPPER_LOWER_LABELS.has(key)) out.upperLower = b;
        else out.leftRight = b;
        out.found++;
      }
    } else {
      const field = LABELS.get(key);
      const m = field && parseMeasure(rest);
      if (field && m) {
        out.values[field] = m;
        out.found++;
      }
    }
  }
  return out;
}

// ---- Due date ----

/** "YYYY-MM-DD" → local midnight. */
export function dateMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** The newest scan by date (null if none). */
export function latestScan<T extends Pick<BodyScan, 'date'>>(scans: T[]): T | null {
  return scans.reduce<T | null>((best, s) => (best === null || s.date > best.date ? s : best), null);
}

/** Next due date: the latest scan's date + 42 days, or 16 Dec 2026 with no scans. */
export function scanDueDate(scans: Pick<BodyScan, 'date'>[]): string {
  const latest = latestScan(scans);
  return latest ? toDateInput(addDays(dateMs(latest.date), SCAN_INTERVAL_DAYS)) : FIRST_SCAN_DUE;
}

/** The banner shows from the Monday of the due date's week until a newer scan is saved. */
export function scanBannerDue(scans: Pick<BodyScan, 'date'>[], now: number): boolean {
  return toDateInput(now) >= toDateInput(startOfWeek(dateMs(scanDueDate(scans))));
}

// ---- Balance ----

const UPPER: ScanField[] = ['leftArmLean', 'rightArmLean', 'torsoLean'];
const LOWER: ScanField[] = ['leftLegLean', 'rightLegLean'];

/** % the group's total lean mass sits above (+) or below (−) the total of its range tops. Null if anything is missing. */
function groupVsTop(scan: Pick<BodyScan, 'values'>, fields: ScanField[]): number | null {
  let total = 0;
  let top = 0;
  for (const f of fields) {
    const m = scan.values[f];
    if (!m || m.max === undefined) return null;
    total += m.value;
    top += m.max;
  }
  return top > 0 ? ((total - top) / top) * 100 : null;
}

function vsTop(pct: number, first: boolean): string {
  const n = Math.round(Math.abs(pct));
  if (n === 0) return first ? 'right at the top of its range' : 'right at the top of theirs';
  if (pct > 0) return first ? `${n}% above its range` : `${n}% above theirs`;
  return first ? `${n}% below the top of its range` : `${n}% below the top of theirs`;
}

export interface UpperLower {
  upperPct: number;
  lowerPct: number;
  text: string;
}

/**
 * Upper (both arms + torso) vs lower (both legs): each half's lean mass against the sum of its range tops.
 * "Upper body 6% above its range, legs right at the top of theirs. Legs are behind."
 */
export function upperLowerBalance(scan: Pick<BodyScan, 'values'>): UpperLower | null {
  const upperPct = groupVsTop(scan, UPPER);
  const lowerPct = groupVsTop(scan, LOWER);
  if (upperPct === null || lowerPct === null) return null;
  const gap = Math.round(upperPct) - Math.round(lowerPct);
  const behind = gap > 0 ? 'Legs are behind.' : gap < 0 ? 'Upper body is behind.' : 'Neither half is behind.';
  return { upperPct, lowerPct, text: `Upper body ${vsTop(upperPct, true)}, legs ${vsTop(lowerPct, false)}. ${behind}` };
}

const kg = (n: number) => n.toFixed(2);

function pairText(name: string, plural: string, left: number, right: number): { diff: number; text: string } {
  const diff = Math.abs(right - left);
  if (Math.round(diff * 100) < 10) return { diff, text: `${plural} within ${kg(diff)} kg.` };
  const heavier = right > left ? 'Right' : 'Left';
  const lighter = right > left ? 'left' : 'right';
  return { diff, text: `${heavier} ${name} ${kg(diff)} kg heavier than ${lighter}.` };
}

/** Left vs right lean mass, biggest difference first: "Right leg 0.32 kg heavier than left. Arms within 0.04 kg." */
export function leftRightBalance(scan: Pick<BodyScan, 'values'>): string | null {
  const v = scan.values;
  const parts: { diff: number; text: string }[] = [];
  if (v.leftArmLean && v.rightArmLean) parts.push(pairText('arm', 'Arms', v.leftArmLean.value, v.rightArmLean.value));
  if (v.leftLegLean && v.rightLegLean) parts.push(pairText('leg', 'Legs', v.leftLegLean.value, v.rightLegLean.value));
  if (parts.length === 0) return null;
  return parts
    .sort((a, b) => b.diff - a.diff)
    .map((p) => p.text)
    .join(' ');
}

/** "+0.4", "−1.2", "0" — a change shown as plain text. */
export function formatChange(diff: number, decimals = 1): string {
  const r = Number(diff.toFixed(decimals));
  if (r === 0) return '0';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(decimals)}`;
}

/** Evenly spaced whole-number y ticks around the values (step 1, 2, 5 or 10, at most 6 ticks). */
export function scanTicks(values: number[]): number[] {
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const step = [1, 2, 5, 10, 20, 50].find((s) => (hi - lo) / s <= 5) ?? 100;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += step) ticks.push(t);
  return ticks;
}
