import { describe, expect, it } from 'vitest';
import { formatKg, joinUnbroken, parseDecimal } from '../src/lib/format';

describe('parseDecimal', () => {
  it('accepts dot or comma decimals', () => {
    expect(parseDecimal('22.5')).toBe(22.5);
    expect(parseDecimal('22,5')).toBe(22.5);
    expect(parseDecimal(' 7 ')).toBe(7);
  });
  it('returns null for empty or junk', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('formatKg', () => {
  it('drops trailing zeros and float noise', () => {
    expect(formatKg(2.5)).toBe('2.5');
    expect(formatKg(7)).toBe('7');
    expect(formatKg(22.499999999)).toBe('22.5');
  });
});

describe('joinUnbroken', () => {
  it('keeps spaces and hyphens inside each part from breaking', () => {
    expect(joinUnbroken(['2 × 5–12', 'Compound', '0–1 warm-up sets'])).toBe(
      '2\u00a0×\u00a05–\u206012 | Compound | 0–\u20601\u00a0warm\u2011up\u00a0sets',
    );
  });
});
