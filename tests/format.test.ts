import { describe, expect, it } from 'vitest';
import { formatKg, parseDecimal } from '../src/lib/format';

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
