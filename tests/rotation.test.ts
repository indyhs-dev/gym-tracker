import { describe, expect, it } from 'vitest';
import type { Session, Template } from '../src/db/types';
import { lastDoneByTemplate, nextTemplate, weekDays } from '../src/lib/rotation';

const template = (id: string, order: number): Template => ({ id, name: id, slots: [], order, createdAt: 0, updatedAt: 0 });
const templates = [template('legs', 0), template('chest', 1), template('arms', 2)];
const at = (y: number, mo: number, d: number, h = 18) => new Date(y, mo - 1, d, h).getTime();
const session = (templateId: string | null, startedAt: number, status: Session['status'] = 'finished'): Session => ({
  id: `${templateId}-${startedAt}`,
  templateId,
  templateName: templateId,
  status,
  startedAt,
  endedAt: startedAt + 3600_000,
  note: '',
  exercises: [],
  exerciseIds: [],
  updatedAt: 0,
});

describe('nextTemplate', () => {
  // Thursday 22 Oct 2026; the week runs Monday 19 to Sunday 25.
  const now = at(2026, 10, 22, 12);

  it('the first template when nothing has been done', () => {
    expect(nextTemplate(templates, [], now)?.id).toBe('legs');
    expect(nextTemplate([], [], now)).toBeNull();
  });

  it('each week starts again from the first template, whatever was done last week', () => {
    expect(nextTemplate(templates, [session('chest', at(2026, 10, 15)), session('legs', at(2026, 10, 13))], now)?.id).toBe('legs');
    expect(nextTemplate(templates, [session('arms', at(2026, 10, 18))], now)?.id).toBe('legs');
  });

  it('then the first one, in template order, not done yet this week', () => {
    expect(nextTemplate(templates, [session('legs', at(2026, 10, 19))], now)?.id).toBe('chest');
    expect(nextTemplate(templates, [session('chest', at(2026, 10, 20)), session('legs', at(2026, 10, 19))], now)?.id).toBe('arms');
    // Done out of order: Legs is still owed this week.
    expect(nextTemplate(templates, [session('chest', at(2026, 10, 19, 0))], now)?.id).toBe('legs');
  });

  it('once all are done this week, the one after the most recent, wrapping round', () => {
    const week = [session('legs', at(2026, 10, 19)), session('chest', at(2026, 10, 20)), session('arms', at(2026, 10, 21))];
    expect(nextTemplate(templates, week, now)?.id).toBe('legs');
    expect(nextTemplate(templates, [...week, session('legs', at(2026, 10, 22, 7))], now)?.id).toBe('chest');
  });

  it('ignores blank sessions, unfinished ones and deleted templates', () => {
    const sessions = [
      session('legs', at(2026, 10, 19)),
      session(null, at(2026, 10, 20)),
      session('chest', at(2026, 10, 20), 'active'),
      session('gone', at(2026, 10, 21)),
    ];
    expect(nextTemplate(templates, sessions, now)?.id).toBe('chest');
  });
});

describe('lastDoneByTemplate', () => {
  it('latest finished start per template', () => {
    const done = lastDoneByTemplate([
      session('torso', at(2026, 10, 14)),
      session('torso', at(2026, 10, 20)),
      session('legs', at(2026, 10, 22), 'active'),
    ]);
    expect(done.get('torso')).toBe(at(2026, 10, 20));
    expect(done.has('legs')).toBe(false);
  });
});

describe('weekDays', () => {
  it('Monday to Sunday with trained days and today', () => {
    const now = at(2026, 10, 25, 9); // Sunday
    const days = weekDays([session('torso', at(2026, 10, 19)), session('legs', at(2026, 10, 21)), session('arms', at(2026, 10, 12))], now);
    expect(days.map((d) => new Date(d.day).getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(days.map((d) => d.trained)).toEqual([true, false, true, false, false, false, false]);
    expect(days.map((d) => d.today)).toEqual([false, false, false, false, false, false, true]);
  });
});
