import { describe, expect, it } from 'vitest';
import { addDays, formatDuration, startOfWeek, startTimeFor, toDateInput } from '../src/lib/time';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('startOfWeek', () => {
  it('is Monday 00:00 for any day of the week', () => {
    const monday = at(2026, 10, 12);
    expect(startOfWeek(at(2026, 10, 12, 0, 0))).toBe(monday);
    expect(startOfWeek(at(2026, 10, 14, 18, 30))).toBe(monday);
    expect(startOfWeek(at(2026, 10, 18, 23, 59))).toBe(monday); // Sunday
    expect(startOfWeek(at(2026, 10, 11, 12))).toBe(at(2026, 10, 5)); // previous Sunday
  });

  it('addDays moves by calendar days', () => {
    expect(addDays(at(2026, 10, 12), 7)).toBe(at(2026, 10, 19));
  });
});

describe('dates', () => {
  it('toDateInput uses local date', () => {
    expect(toDateInput(at(2026, 1, 5, 23, 59))).toBe('2026-01-05');
  });

  it('startTimeFor is now for today, otherwise that date at the same time of day', () => {
    const now = at(2026, 10, 12, 18, 5);
    expect(startTimeFor('2026-10-12', now)).toBe(now);
    expect(startTimeFor('2026-10-09', now)).toBe(at(2026, 10, 9, 18, 5));
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59_999)).toBe('0m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(65 * 60_000)).toBe('1h 5m');
    expect(formatDuration(120 * 60_000)).toBe('2h');
    expect(formatDuration(-5)).toBe('0m');
  });
});
