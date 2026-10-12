/** Parses a decimal typed on an iPhone keypad (accepts "," or "."). Returns null if empty or invalid. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** 2.5 → "2.5", 7 → "7", 22.499999 → "22.5". */
export function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

/** plural(1, 'set') → "1 set", plural(3, 'set') → "3 sets". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
