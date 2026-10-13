import type { ExerciseType, RestGuidance, WarmupPolicy } from '../db/types';
import { DEFAULT_REST } from '../db/defaults';

/**
 * "Rest 3–5 min · warm-ups 1–2 min". The warm-up part is left out when the
 * slot has no warm-up; ad-hoc exercises (no slot) show both.
 */
export function restText(type: ExerciseType, warmup: WarmupPolicy | null, rest: RestGuidance): string {
  const parts = [];
  if (rest[type]) parts.push(`Rest ${rest[type]}`);
  if (warmup !== 'none' && rest.warmup) parts.push(`warm-ups ${rest.warmup}`);
  return parts.join(' · ');
}

export interface RestRange {
  /** Seconds until you're ready for the next set (the timer turns green). */
  min: number;
  /** Upper end of the range, if the text gives one. */
  max: number | null;
}

const UNIT = /^(s|sec|secs|second|seconds|m|min|mins|minute|minutes)$/i;

/**
 * Reads a rest guidance text as seconds: "3–5 min" → 180–300, "90 s–3 min"
 * → 90–180, "60–90 s" → 60–90, "2:30" → 150. A number without its own unit
 * takes the next unit given; with no unit at all, up to 10 is minutes.
 * Returns null when the text has no number.
 */
export function parseRest(text: string): RestRange | null {
  const tokens = text.toLowerCase().match(/\d+:\d{2}|\d+(?:[.,]\d+)?|[a-z]+/g) ?? [];
  const values: { n: number; unit: 's' | 'm' | null }[] = [];
  for (const token of tokens) {
    if (/^\d+:\d{2}$/.test(token)) {
      const [m, s] = token.split(':').map(Number);
      values.push({ n: m * 60 + s, unit: 's' });
    } else if (/^\d/.test(token)) {
      values.push({ n: Number(token.replace(',', '.')), unit: null });
    } else if (UNIT.test(token)) {
      const unit = token.startsWith('s') ? 's' : 'm';
      for (let i = values.length - 1; i >= 0 && values[i].unit === null; i--) values[i].unit = unit;
    }
  }
  if (values.length === 0) return null;
  const seconds = ({ n, unit }: (typeof values)[number]) =>
    Math.round((unit ?? (n <= 10 ? 'm' : 's')) === 'm' ? n * 60 : n);
  const min = seconds(values[0]);
  const max = values.length > 1 ? seconds(values[1]) : null;
  return { min, max: max !== null && max > min ? max : null };
}

/** How long to rest after a set: warm-up sets use the warm-up text, others their exercise type's. */
export function restAfter(type: ExerciseType, warmupSet: boolean, rest: RestGuidance): { text: string; range: RestRange } {
  const key = warmupSet ? 'warmup' : type;
  const text = rest[key];
  return { text, range: parseRest(text) ?? parseRest(DEFAULT_REST[key])! };
}
