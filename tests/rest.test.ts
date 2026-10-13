import { describe, expect, it } from 'vitest';
import { DEFAULT_REST } from '../src/db/defaults';
import { parseRest, restAfter } from '../src/lib/rest';

describe('parseRest', () => {
  it('reads the default rest texts', () => {
    expect(parseRest('1–2 min')).toEqual({ min: 60, max: 120 });
    expect(parseRest('3–5 min')).toEqual({ min: 180, max: 300 });
    expect(parseRest('90 s–3 min')).toEqual({ min: 90, max: 180 });
    expect(parseRest('60–90 s')).toEqual({ min: 60, max: 90 });
  });

  it('handles other ways of writing it', () => {
    expect(parseRest('2 min')).toEqual({ min: 120, max: null });
    expect(parseRest('2-3 minutes')).toEqual({ min: 120, max: 180 });
    expect(parseRest('1.5 min')).toEqual({ min: 90, max: null });
    expect(parseRest('2:30')).toEqual({ min: 150, max: null });
    expect(parseRest('45 sec')).toEqual({ min: 45, max: null });
    expect(parseRest('about 3 to 4 mins')).toEqual({ min: 180, max: 240 });
  });

  it('guesses the unit when none is given', () => {
    expect(parseRest('3')).toEqual({ min: 180, max: null });
    expect(parseRest('90')).toEqual({ min: 90, max: null });
  });

  it('returns null without a number', () => {
    expect(parseRest('')).toBeNull();
    expect(parseRest('as needed')).toBeNull();
  });
});

describe('restAfter', () => {
  it('uses the warm-up text for warm-up sets and the type text otherwise', () => {
    expect(restAfter('compound', true, DEFAULT_REST).range.min).toBe(60);
    expect(restAfter('compound', false, DEFAULT_REST).range.min).toBe(180);
    expect(restAfter('isolation', false, DEFAULT_REST).range.min).toBe(90);
    expect(restAfter('core', false, DEFAULT_REST).range.min).toBe(60);
  });

  it('falls back to the default when the text has no number', () => {
    const rest = { ...DEFAULT_REST, compound: 'as long as it takes' };
    expect(restAfter('compound', false, rest)).toEqual({ text: 'as long as it takes', range: { min: 180, max: 300 } });
  });
});
