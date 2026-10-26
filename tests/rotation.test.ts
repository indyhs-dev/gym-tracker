import { describe, expect, it } from 'vitest';
import type { Session, Template } from '../src/db/types';
import { lastDoneByTemplate, nextTemplate, rotationOrder, weekDays } from '../src/lib/rotation';

const template = (id: string, order: number): Template => ({ id, name: id, slots: [], order, createdAt: 0, updatedAt: 0 });
const templates = [template('torso', 0), template('legs', 1), template('arms', 2)];
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
  it('the first template when nothing has been done', () => {
    expect(nextTemplate(templates, [])?.id).toBe('torso');
    expect(nextTemplate([], [])).toBeNull();
  });

  it('the one after the most recently done template, wrapping round', () => {
    expect(nextTemplate(templates, [session('torso', at(2026, 10, 20)), session('legs', at(2026, 10, 18))])?.id).toBe('legs');
    expect(nextTemplate(templates, [session('arms', at(2026, 10, 21)), session('torso', at(2026, 10, 20))])?.id).toBe('torso');
  });

  it('ignores blank sessions, unfinished ones and deleted templates', () => {
    const sessions = [
      session('legs', at(2026, 10, 18)),
      session(null, at(2026, 10, 19)),
      session('arms', at(2026, 10, 20), 'active'),
      session('gone', at(2026, 10, 21)),
    ];
    expect(nextTemplate(templates, sessions)?.id).toBe('arms');
  });
});

describe('rotationOrder and lastDoneByTemplate', () => {
  it('starts from the given template and continues round', () => {
    expect(rotationOrder(templates, templates[1]).map((t) => t.id)).toEqual(['legs', 'arms', 'torso']);
    expect(rotationOrder(templates, null).map((t) => t.id)).toEqual(['torso', 'legs', 'arms']);
  });

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
