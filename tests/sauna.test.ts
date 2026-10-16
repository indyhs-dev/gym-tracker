import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, readAll, restoreBackup } from '../src/db/backup';
import { db } from '../src/db/db';
import {
  countSaunaSamples,
  deleteSaunaEntry,
  lastSaunaSession,
  removeSaunaSamples,
  saunaEntries,
  saveSaunaSession,
  saveSaunaSkip,
  seedSaunaSamplesIfNeeded,
  type SaunaSessionFields,
} from '../src/db/sauna';
import { getSettings, updateSettings } from '../src/db/settings';
import type { SaunaEntry, SaunaSession, SaunaSkip } from '../src/db/types';
import {
  addDaysYmd,
  consistency,
  dayStatuses,
  formatMmSs,
  makeRound,
  monthGrid,
  nextPlan,
  parseTimeLeft,
  planText,
  roundStats,
  roundText,
  saunaToday,
  saunaWeeks,
  stepUpSuggestion,
  timeLeftInput,
  weekStartYmd,
} from '../src/lib/sauna';

let seq = 0;
const session = (date: string, over: Partial<SaunaSession> = {}): SaunaSession => ({
  id: `s${++seq}`,
  kind: 'session',
  date,
  context: 'afterLifting',
  rounds: [makeRound(15, 0), makeRound(15, 0)],
  bench: 'upper',
  temp: null,
  feel: 3,
  water: false,
  createdAt: seq,
  updatedAt: seq,
  ...over,
});
const skip = (date: string): SaunaSkip => ({ id: `k${++seq}`, kind: 'skip', date, reason: 'closed', createdAt: seq, updatedAt: seq });

describe('time left (mm:ss)', () => {
  it('3:37 left on a 15 min round stores 11:23 completed and reads back as entered', () => {
    const left = parseTimeLeft('3:37', 15);
    expect(left).toEqual({ ok: true, sec: 217 });
    const round = makeRound(15, 217, 'tooHot');
    expect(round).toEqual({ plannedMin: 15, leftSec: 217, completedSec: 683, reason: 'tooHot' });
    expect(formatMmSs(round.completedSec)).toBe('11:23');
    expect(roundText(round, 1)).toBe('Round 2: 15 min, left with 3:37 remaining');
  });

  it('blank (or a zero typed and dropped) means the full time was done', () => {
    expect(parseTimeLeft('', 20)).toEqual({ ok: true, sec: 0 });
    expect(timeLeftInput('0')).toBe('');
    expect(timeLeftInput('000')).toBe('');
    const round = makeRound(20, 0, 'tired');
    expect(round).toEqual({ plannedMin: 20, leftSec: 0, completedSec: 1200, reason: null });
    expect(roundText(round, 0)).toBe('Round 1: 20 min, completed');
  });

  it('must be less than the planned time, with seconds under 60', () => {
    expect(parseTimeLeft('15:00', 15)).toMatchObject({ ok: false, error: 'Time left must be less than 15:00' });
    expect(parseTimeLeft('16:10', 15).ok).toBe(false);
    expect(parseTimeLeft('14:59', 15)).toEqual({ ok: true, sec: 899 });
    expect(parseTimeLeft('15:00', 20)).toEqual({ ok: true, sec: 900 });
    expect(parseTimeLeft('3:90', 15)).toMatchObject({ ok: false, error: 'Seconds must be under 60' });
    expect(parseTimeLeft('abc', 15).ok).toBe(false);
  });

  it('fills digits from the right like a timer (the iPhone number pad has no colon)', () => {
    expect(['3', '33', '337'].map(timeLeftInput)).toEqual(['0:03', '0:33', '3:37']);
    expect(timeLeftInput('1459')).toBe('14:59');
    expect(timeLeftInput('14599')).toBe('14:59');
    // Typing "3:37" with a colon (desktop), keystroke by keystroke, ends the same.
    let text = '';
    for (const key of '3:37') text = timeLeftInput(text + key);
    expect(text).toBe('3:37');
    // Backspace from 3:37.
    expect(timeLeftInput('3:3')).toBe('0:33');
  });

  it('describes the plan', () => {
    expect(planText([15, 15])).toBe('2 × 15 min');
    expect(planText([15, 20])).toBe('15 + 20 min');
    expect(planText([20])).toBe('1 × 20 min');
  });
});

describe('days and weeks (Australia/Brisbane, Monday–Sunday)', () => {
  it('today is the Brisbane date, whatever the device time zone', () => {
    // 14:30 UTC on Thu 15 Oct is 00:30 Fri 16 Oct in Brisbane (UTC+10, no daylight saving).
    expect(saunaToday(Date.UTC(2026, 9, 15, 14, 30))).toBe('2026-10-16');
    expect(saunaToday(Date.UTC(2026, 9, 15, 13, 59))).toBe('2026-10-15');
  });

  it('weeks start on Monday', () => {
    expect(weekStartYmd('2026-10-12')).toBe('2026-10-12');
    expect(weekStartYmd('2026-10-18')).toBe('2026-10-12');
    expect(weekStartYmd('2026-10-19')).toBe('2026-10-19');
    expect(weekStartYmd('2026-11-01')).toBe('2026-10-26');
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts sessions and skips per week, including empty weeks', () => {
    const entries = [session('2026-10-12'), session('2026-10-14'), skip('2026-10-16'), session('2026-10-05')];
    const weeks = saunaWeeks(entries, '2026-10-16', 3, 3);
    expect(weeks).toEqual([
      { weekStart: '2026-09-28', sessions: 0, skips: 0, met: false },
      { weekStart: '2026-10-05', sessions: 1, skips: 0, met: false },
      { weekStart: '2026-10-12', sessions: 2, skips: 1, met: true },
    ]);
  });
});

describe('consistency', () => {
  const target = 3;
  const today = '2026-10-16';

  it('a skip never lowers it: logging one can only keep or raise the score', () => {
    const base = [session('2026-10-05'), session('2026-10-06'), session('2026-10-12'), session('2026-10-13')];
    const before = consistency(saunaWeeks(base, today, target), '2026-10-05');
    const withSkip = [...base, skip('2026-10-07')];
    const after = consistency(saunaWeeks(withSkip, today, target), '2026-10-05');
    expect(before).toEqual({ met: 0, of: 1 });
    expect(after).toEqual({ met: 1, of: 1 });
    // A week of only skips (e.g. sick all week) counts as on target too.
    const sick = [skip('2026-10-05'), skip('2026-10-07'), skip('2026-10-09')];
    expect(consistency(saunaWeeks(sick, today, target), '2026-10-05')).toEqual({ met: 1, of: 1 });
  });

  it('ignores weeks before the first entry, and this week until it is met', () => {
    const entries = [session('2026-10-12'), session('2026-10-13')];
    expect(consistency(saunaWeeks(entries, today, target), '2026-10-12')).toEqual({ met: 0, of: 0 });
    entries.push(session('2026-10-14'));
    expect(consistency(saunaWeeks(entries, today, target), '2026-10-12')).toEqual({ met: 1, of: 1 });
    expect(consistency(saunaWeeks([], today, target), null)).toEqual({ met: 0, of: 0 });
  });
});

describe('calendar', () => {
  it('each day gets the best status of its entries', () => {
    const partial = session('2026-10-13', { rounds: [makeRound(15, 0), makeRound(15, 217)] });
    const days = dayStatuses([session('2026-10-12'), partial, skip('2026-10-14'), skip('2026-10-15'), session('2026-10-15')]);
    expect(Object.fromEntries(days)).toEqual({
      '2026-10-12': 'completed',
      '2026-10-13': 'partial',
      '2026-10-14': 'skipped',
      '2026-10-15': 'completed',
    });
  });

  it('lays a month out in Monday-first weeks', () => {
    const october = monthGrid('2026-10');
    expect(october).toHaveLength(5);
    expect(october[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(october.at(-1)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(monthGrid('2027-02')).toHaveLength(4); // 1 Feb 2027 is a Monday
  });
});

describe('round stats', () => {
  it('completion rate and average use completed seconds', () => {
    const stats = roundStats([
      session('2026-10-12'),
      session('2026-10-13', { rounds: [makeRound(15, 0), makeRound(15, 217)] }),
    ]);
    expect(stats.rounds).toBe(4);
    expect(stats.completed).toBe(3);
    expect(stats.rate).toBe(0.75);
    expect(stats.avgMinutes).toBeCloseTo((900 * 3 + 683) / 4 / 60);
    expect(roundStats([]).rate).toBeNull();
  });
});

describe('ready to step up', () => {
  const today = '2026-10-16';
  const easy = (date: string, over: Partial<SaunaSession> = {}) => session(date, { feel: 4, ...over });

  it('suggests the next step after 3 easy, fully completed sessions on the same plan', () => {
    const entries = [easy('2026-10-12'), easy('2026-10-13'), skip('2026-10-14'), easy('2026-10-15', { feel: 5 })];
    expect(stepUpSuggestion(entries, today)).toMatchObject({ current: [15, 15], next: [20, 20] });
  });

  it('shows nothing after a round left early, a low feel, or with fewer than 3 sessions', () => {
    const left = { rounds: [makeRound(15, 0), makeRound(15, 30)] };
    expect(stepUpSuggestion([easy('2026-10-12'), easy('2026-10-13'), easy('2026-10-15', left)], today)).toBeNull();
    expect(stepUpSuggestion([easy('2026-10-12'), easy('2026-10-13', { feel: 3 }), easy('2026-10-15')], today)).toBeNull();
    expect(stepUpSuggestion([easy('2026-10-13'), easy('2026-10-15')], today)).toBeNull();
    // An older tap-out doesn't block it once the last 3 are easy.
    expect(stepUpSuggestion([easy('2026-10-09', left), easy('2026-10-12'), easy('2026-10-13'), easy('2026-10-15')], today)).not.toBeNull();
  });

  it('waits for 3 sessions at a new plan, and ignores sessions from before a long break', () => {
    const stepped = { rounds: [makeRound(20, 0), makeRound(20, 0)] };
    expect(stepUpSuggestion([easy('2026-10-12'), easy('2026-10-13'), easy('2026-10-15', stepped)], today)).toBeNull();
    expect(stepUpSuggestion([easy('2026-09-01'), easy('2026-10-13'), easy('2026-10-15')], today)).toBeNull();
  });

  it('steps up gently and stops at the top', () => {
    expect(nextPlan([15, 15])).toEqual([20, 20]);
    expect(nextPlan([15, 20])).toEqual([20, 20]);
    expect(nextPlan([20, 20])).toEqual([20, 20, 15]);
    expect(nextPlan([20, 20, 15])).toEqual([20, 20, 20]);
    expect(nextPlan([20, 20, 20])).toBeNull();
  });
});

describe('sauna storage', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  const fields = (over: Partial<SaunaSessionFields> = {}): SaunaSessionFields => ({
    date: '2026-10-14',
    context: 'afterLifting',
    rounds: [makeRound(15, 0), makeRound(15, 217)],
    bench: 'upper',
    temp: 'high',
    feel: 3,
    water: true,
    ...over,
  });

  it('saves, edits and deletes; completed seconds are always derived', async () => {
    const tampered = fields({ rounds: [{ plannedMin: 15, leftSec: 217, completedSec: 1, reason: null }] });
    const id = await saveSaunaSession(tampered);
    const [saved] = (await saunaEntries()) as SaunaSession[];
    expect(saved.rounds[0].completedSec).toBe(683);

    await saveSaunaSession(fields({ feel: 5, rounds: [makeRound(20, 0)] }), id);
    const edited = (await db.saunaEntries.get(id)) as SaunaSession;
    expect(edited.feel).toBe(5);
    expect(edited.rounds).toEqual([makeRound(20, 0)]);
    expect(edited.createdAt).toBe(saved.createdAt);

    await deleteSaunaEntry(id);
    expect(await saunaEntries()).toEqual([]);
  });

  it('rejects a missing feel score or date', async () => {
    await expect(saveSaunaSession(fields({ feel: 0 as never }))).rejects.toThrow('Choose how it felt');
    await expect(saveSaunaSession(fields({ date: '' }))).rejects.toThrow('Choose a date');
  });

  it('the last session (not skip) is used to pre-fill', async () => {
    await saveSaunaSession(fields({ date: '2026-10-12', bench: 'lower' }));
    await saveSaunaSession(fields({ date: '2026-10-14', bench: 'upper' }));
    await saveSaunaSession(fields({ date: '2026-10-13', bench: 'lower' })); // back-dated
    await saveSaunaSkip({ date: '2026-10-15', reason: 'sick' });
    expect((await lastSaunaSession())?.date).toBe('2026-10-14');
  });

  it('weekly target defaults to 3, also for settings saved before it existed', async () => {
    expect((await getSettings()).sauna.weeklyTarget).toBe(3);
    const { sauna: _omit, ...old } = await getSettings();
    await db.settings.put(old as never);
    expect((await getSettings()).sauna).toEqual({ weeklyTarget: 3, samplesAddedAt: null });
  });

  it('sample sessions are added once (Mon–Wed of this week) and removed on their own', async () => {
    const friday = new Date(2026, 9, 16, 9).getTime();
    expect(await seedSaunaSamplesIfNeeded(friday)).toBe(true);
    expect(await seedSaunaSamplesIfNeeded(friday)).toBe(false);
    const samples = (await saunaEntries()) as SaunaSession[];
    expect(samples.map((s) => s.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect(samples[1].rounds[1]).toMatchObject({ leftSec: 217, completedSec: 683 });

    await saveSaunaSkip({ date: '2026-10-15', reason: 'rest' });
    expect(await countSaunaSamples()).toBe(3);
    expect(await removeSaunaSamples()).toBe(3);
    expect((await saunaEntries()).map((e) => e.kind)).toEqual(['skip']);
    expect(await seedSaunaSamplesIfNeeded(friday)).toBe(false);
  });

  it('on a Monday, samples use last week so nothing is in the future', async () => {
    await seedSaunaSamplesIfNeeded(new Date(2026, 9, 19, 9).getTime());
    expect((await saunaEntries()).map((e) => e.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('backs up and restores sauna entries; older backups without them still restore', async () => {
    await updateSettings({ sauna: { weeklyTarget: 4, samplesAddedAt: 1 } });
    await saveSaunaSession(fields());
    await saveSaunaSkip({ date: '2026-10-15', reason: 'closed' });
    const text = JSON.stringify(makeBackup(await readAll()));
    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(text));
    expect((await saunaEntries()).map((e: SaunaEntry) => e.kind)).toEqual(['session', 'skip']);
    expect((await getSettings()).sauna.weeklyTarget).toBe(4);

    // A v1 backup: no sauna table and no sauna settings. Samples must not be seeded on top of it.
    const { saunaEntries: _omit, ...v1Data } = await readAll();
    const { sauna: _s, ...v1Settings } = v1Data.settings[0];
    const v1 = { ...makeBackup({ ...v1Data, settings: [v1Settings as never] }), version: 1 };
    await restoreBackup(parseBackup(JSON.stringify(v1)));
    expect(await saunaEntries()).toEqual([]);
    expect((await getSettings()).sauna.weeklyTarget).toBe(3);
    expect(await seedSaunaSamplesIfNeeded()).toBe(false);
  });
});
