import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, readAll, restoreBackup } from '../src/db/backup';
import { allScans, saveScan, scanOnDate, type ScanInput } from '../src/db/bodyScans';
import { db } from '../src/db/db';
import { toDateInput } from '../src/lib/time';
import {
  formatChange,
  leftRightBalance,
  parseScanDate,
  parseScanText,
  scanBannerDue,
  scanDueDate,
  upperLowerBalance,
} from '../src/lib/bodyScan';

// All numbers here are made up. Never put a real scan in this repo (it's public).
const SAMPLE = `EVOLT 360 BODY SCAN
Date: 03-02-2027 09:30
Weight: 80.0

Lean Body Mass: 65.0 / Optimal [55.0 - 68.0]
Skeletal Muscle Mass: 36.5 / High [30.0 - 36.0]
Protein: 13.0 / Optimal [11.0 - 13.5]
Mineral: 4.4 / Optimal [3.9 - 4.8]
Total Body Water: 47.6 / Optimal [40.0 - 49.0]
Body Fat Mass: 15.0 / Optimal [10.0 - 16.0]
Subcutaneous Fat Mass: 13.1 [16.4%]
Visceral Fat Mass: 1.9 [2.4%]
Visceral Fat Area: 62 / Optimal [50 - 100]
Body Fat Percentage: 18.8 / Optimal [15 - 20]
Visceral Fat Level: 6 / Optimal
Intracellular Fluid: 30.1 [63%]
Extracellular Fluid: 17.8 [37%]
Bio Age: 27
BWI Score: 7.4

Upper-Lower Balance: Unbalanced
Left-Right Balance: Balanced
Left Arm Lean: 3.20 / High [2.50 - 3.00]
Left Arm Fat: 0.90 / Optimal [0.60 - 1.00]
Right Arm Lean: 3.16 / High [2.50 - 3.00]
Right Arm Fat: 0.88 / Optimal [0.60 - 1.00]
Torso Lean: 26.50 / High [21.00 - 25.00]
Torso Fat: 7.10 / Optimal [5.00 - 8.00]
Left Leg Lean: 8.85 / Optimal [7.50 - 9.00]
Left Leg Fat: 2.00 / Optimal [1.70 - 2.70]
Right Leg Lean: 9.17 / High [7.50 - 9.00]
Right Leg Fat: 2.05 / Optimal [1.70 - 2.70]
Abdominal Circumference: 86.0
Waist to Hip Ratio: 0.84 / Optimal [0.75 - 0.9]`;

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const scans = (...dates: string[]) => dates.map((date) => ({ date }));

describe('paste reader', () => {
  it('reads every field of a full paste', () => {
    const p = parseScanText(SAMPLE);
    expect(p.date).toBe('2027-02-03');
    expect(p.time).toBe('09:30');
    expect(p.upperLower).toBe('Unbalanced');
    expect(p.leftRight).toBe('Balanced');
    expect(Object.keys(p.values)).toHaveLength(28);
    expect(p.found).toBe(31);
    expect(p.values.weight).toEqual({ value: 80 });
    expect(p.values.leanBodyMass).toEqual({ value: 65, rating: 'Optimal', min: 55, max: 68 });
    expect(p.values.subcutaneousFatMass).toEqual({ value: 13.1, share: 16.4 });
    expect(p.values.visceralFatLevel).toEqual({ value: 6, rating: 'Optimal' });
    expect(p.values.rightLegLean).toEqual({ value: 9.17, rating: 'High', min: 7.5, max: 9 });
    expect(p.values.waistToHipRatio).toEqual({ value: 0.84, rating: 'Optimal', min: 0.75, max: 0.9 });
  });

  it('accepts report-style labels, units, ISO dates and en-dash ranges', () => {
    const p = parseScanText(
      [
        'Date: 2027-02-03',
        '1. LEAN BODY MASS kg/lbs: 65.0 kg / High [55.0 – 68.0]',
        '10. Total Body Fat Percentage: 18.8% / Under [15–20]',
        '12. Intracellular Fluid (ICF): 30.1 kg [63%]',
        'BWI® Score: 7.4',
        'Weight: 80,5 kg',
        'Abdominal Circumference: 86 cm',
        'Left Leg Lean Mass: 8.85 / Optimal [7.50 - 9.00]',
        'Trunk Fat: 7.1 / Optimal [5 - 8]',
      ].join('\n'),
    );
    expect(p.date).toBe('2027-02-03');
    expect(p.time).toBeNull();
    expect(p.values.leanBodyMass).toEqual({ value: 65, rating: 'High', min: 55, max: 68 });
    expect(p.values.bodyFatPercentage).toEqual({ value: 18.8, rating: 'Under', min: 15, max: 20 });
    expect(p.values.intracellularFluid).toEqual({ value: 30.1, share: 63 });
    expect(p.values.bwiScore).toEqual({ value: 7.4 });
    expect(p.values.weight).toEqual({ value: 80.5 });
    expect(p.values.abdominalCircumference).toEqual({ value: 86 });
    expect(p.values.leftLegLean?.value).toBe(8.85);
    expect(p.values.torsoFat?.value).toBe(7.1);
  });

  it('fills in what it can from a partial or jumbled paste without crashing', () => {
    const p = parseScanText('random words\n\nBio Age 27\nSkeletal Muscle Mass: n/a\nRight Arm Lean: 3.1 / High\n: 5\nWeight:\nHEIGHT 180 cm\n🙂');
    expect(p.values).toEqual({ bioAge: { value: 27 }, rightArmLean: { value: 3.1, rating: 'High' } });
    expect(p.date).toBeNull();
    expect(parseScanText('').found).toBe(0);
  });

  it('only accepts real dates', () => {
    expect(parseScanDate('03-02-2027 09:30')).toEqual({ date: '2027-02-03', time: '09:30' });
    expect(parseScanDate('4/11/2026')).toEqual({ date: '2026-11-04', time: null });
    expect(parseScanDate('31-02-2027')).toBeNull();
    expect(parseScanDate('soon')).toBeNull();
  });
});

describe('due date and banner', () => {
  it('with no scans, is due 16 Dec 2026 and shows from Monday 14 Dec', () => {
    expect(scanDueDate([])).toBe('2026-12-16');
    expect(scanBannerDue([], at(2026, 12, 13, 23, 59))).toBe(false);
    expect(scanBannerDue([], at(2026, 12, 14, 0, 0))).toBe(true);
  });

  it('a scan dated 4 Nov 2026 is due 16 Dec, banner from 14 Dec', () => {
    expect(scanDueDate(scans('2026-11-04'))).toBe('2026-12-16');
    expect(scanBannerDue(scans('2026-11-04'), at(2026, 12, 13, 12))).toBe(false);
    expect(scanBannerDue(scans('2026-11-04'), at(2026, 12, 14, 8))).toBe(true);
  });

  it('keeps showing when overdue', () => {
    expect(scanBannerDue(scans('2026-11-04'), at(2026, 12, 21, 9))).toBe(true);
    expect(scanBannerDue(scans('2026-11-04'), at(2027, 3, 1, 9))).toBe(true);
  });

  it('hides once a newer scan is saved', () => {
    expect(scanBannerDue(scans('2026-11-04', '2026-12-17'), at(2026, 12, 17, 18))).toBe(false);
    expect(scanDueDate(scans('2026-11-04', '2026-12-17'))).toBe('2027-01-28');
  });

  it('adding an older past scan doesn’t move the due date', () => {
    expect(scanDueDate(scans('2026-11-04', '2026-09-01'))).toBe('2026-12-16');
  });

  it('deleting the latest scan brings the banner back if it’s due again', () => {
    const now = at(2026, 12, 18, 9);
    expect(scanBannerDue(scans('2026-11-04', '2026-12-17'), now)).toBe(false);
    expect(scanBannerDue(scans('2026-11-04'), now)).toBe(true);
  });

  it('a due date on a Sunday shows from that week’s Monday', () => {
    // 2027-01-03 is a Sunday, 42 days after 2026-11-22.
    expect(scanDueDate(scans('2026-11-22'))).toBe('2027-01-03');
    expect(scanBannerDue(scans('2026-11-22'), at(2026, 12, 27, 23))).toBe(false);
    expect(scanBannerDue(scans('2026-11-22'), at(2026, 12, 28, 0))).toBe(true);
  });

  it('a scan saved just before midnight counts on its local date', () => {
    expect(toDateInput(at(2026, 12, 15, 23, 59))).toBe('2026-12-15');
  });
});

describe('balance lines', () => {
  const sample = parseScanText(SAMPLE);

  it('upper vs lower: each half against the sum of its range tops', () => {
    const b = upperLowerBalance(sample)!;
    expect(Math.round(b.upperPct)).toBe(6);
    expect(Math.round(b.lowerPct)).toBe(0);
    expect(b.text).toBe('Upper body 6% above its range, legs right at the top of theirs. Legs are behind.');
  });

  it('upper vs lower handles legs ahead and missing ranges', () => {
    const v = { ...sample.values, leftLegLean: { value: 10, max: 9 }, rightLegLean: { value: 10, max: 9 } };
    expect(upperLowerBalance({ values: v })!.text).toBe('Upper body 6% above its range, legs 11% above theirs. Upper body is behind.');
    const noRange = { ...sample.values, torsoLean: { value: 26.5 } };
    expect(upperLowerBalance({ values: noRange })).toBeNull();
  });

  it('left vs right: kg difference, biggest first', () => {
    expect(leftRightBalance(sample)).toBe('Right leg 0.32 kg heavier than left. Arms within 0.04 kg.');
    expect(leftRightBalance({ values: {} })).toBeNull();
  });

  it('changes are plain +/− text', () => {
    expect(formatChange(0.42)).toBe('+0.4');
    expect(formatChange(-1.25)).toBe('−1.3');
    expect(formatChange(0.01)).toBe('0');
  });
});

describe('storage and backup', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  const input = (date: string, weight: number): ScanInput => ({
    date,
    time: null,
    values: { weight: { value: weight } },
    upperLower: null,
    leftRight: null,
  });

  it('saves, lists newest first, and replaces a same-date scan', async () => {
    const a = await saveScan(input('2026-10-01', 80));
    await saveScan(input('2026-11-12', 81));
    expect((await allScans()).map((s) => s.date)).toEqual(['2026-11-12', '2026-10-01']);
    const clash = await scanOnDate('2026-10-01');
    expect(clash?.id).toBe(a.id);
    expect(await scanOnDate('2026-10-01', a.id)).toBeUndefined();
    await saveScan(input('2026-10-01', 79), undefined, clash!.id);
    const after = await allScans();
    expect(after).toHaveLength(2);
    expect(after[1].values.weight?.value).toBe(79);
  });

  it('a new backup round-trips its scans', async () => {
    await saveScan(input('2026-10-01', 80));
    const text = JSON.stringify(makeBackup(await readAll()));
    await db.delete();
    await db.open();
    await restoreBackup(parseBackup(text));
    expect((await allScans()).map((s) => s.values.weight?.value)).toEqual([80]);
  });

  it('a backup with scans replaces the scans on the phone', async () => {
    await saveScan(input('2026-10-01', 80));
    const backup = makeBackup(await readAll());
    await saveScan(input('2026-11-12', 81));
    await restoreBackup(backup);
    expect((await allScans()).map((s) => s.date)).toEqual(['2026-10-01']);
  });

  it('an old backup with no scans restores and keeps the existing scans', async () => {
    const { bodyScans: _none, ...old } = await readAll();
    const text = JSON.stringify({ format: 'gym-log-backup', version: 2, exportedAt: 1, data: old });
    await saveScan(input('2026-10-01', 80));
    await restoreBackup(parseBackup(text));
    expect((await allScans()).map((s) => s.date)).toEqual(['2026-10-01']);
  });

  it('rejects damaged scan data in a backup', async () => {
    const data = { ...(await readAll()), bodyScans: [{ id: 'x' }] };
    expect(() => parseBackup(JSON.stringify({ format: 'gym-log-backup', version: 3, exportedAt: 1, data }))).toThrow('incomplete');
  });
});
