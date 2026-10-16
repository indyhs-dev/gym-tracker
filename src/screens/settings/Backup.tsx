import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { BackupError, makeBackup, parseBackup, readAll, restoreBackup } from '../../db/backup';
import { updateSettings } from '../../db/settings';
import type { Exercise } from '../../db/types';
import { buildCsv, claudeSummary, sessionsInRange } from '../../lib/export';
import { copyText, saveFile } from '../../lib/files';
import { plural } from '../../lib/format';
import { addDays, formatDate, toDateInput } from '../../lib/time';

export default function Backup() {
  // Loaded up front so each button can build its file inside the tap (iOS requirement).
  const data = useLiveQuery(readAll, []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = toDateInput(Date.now());
  const [from, setFrom] = useState(toDateInput(addDays(Date.now(), -27)));
  const [to, setTo] = useState(today);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!data) return <ScreenHeader title="Backup & export" back="/settings" backLabel="Settings" />;

  const exercises = new Map(data.exercises.map((e) => [e.id, e] as [string, Exercise]));
  const settings = data.settings.find((s) => s.id === 'app');
  const finished = data.sessions.filter((s) => s.status === 'finished');
  const summary = claudeSummary(data.sessions, exercises, from, to);
  const inRange = sessionsInRange(data.sessions, from, to).length;
  const stamp = toDateInput(Date.now());

  function show(msg: string) {
    setError(null);
    setMessage(msg);
  }

  async function backup() {
    const saved = await saveFile(`gym-log-backup-${stamp}.json`, JSON.stringify(makeBackup(data!)), 'application/json');
    if (!saved) return;
    await updateSettings({ lastBackupAt: Date.now() });
    show('Backup saved.');
  }

  async function exportCsv() {
    const saved = await saveFile(`gym-log-sets-${stamp}.csv`, buildCsv(data!.sessions, exercises), 'text/csv');
    if (saved) show('CSV exported.');
  }

  async function copy() {
    const ok = await copyText(summary);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setError('Couldn’t copy. Select the text below and copy it instead.');
    }
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      const d = parsed.data;
      const sauna = d.saunaEntries?.length ?? 0;
      const ok = window.confirm(
        `Replace ALL data in the app with this backup from ${formatDate(parsed.exportedAt)}?\n\n` +
          `It has ${plural(d.sessions.length, 'session')}, ${plural(d.templates.length, 'template')}, ` +
          `${plural(d.exercises.length, 'exercise')} and ${sauna} sauna ${sauna === 1 ? 'entry' : 'entries'}. ` +
          'Everything currently in the app will be replaced.',
      );
      if (!ok) return;
      await restoreBackup(parsed);
      show(`Restored ${plural(d.sessions.length, 'session')}.`);
    } catch (err) {
      setMessage(null);
      setError(err instanceof BackupError ? err.message : 'Couldn’t read that file.');
    }
  }

  return (
    <>
      <ScreenHeader title="Backup & export" back="/settings" backLabel="Settings" />
      <p className="muted intro">Your data lives only on this phone. Save a backup to Files regularly.</p>

      {message && (
        <p className="card notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="field">
        <span className="field-label">Backup</span>
        <button type="button" className="btn btn-primary btn-block" onClick={backup}>
          Save backup (JSON)
        </button>
        <span className="row-meta">
          {settings?.lastBackupAt ? `Last backup ${formatDate(settings.lastBackupAt)}` : 'No backup saved yet'} ·{' '}
          {plural(finished.length, 'session')}
        </span>
        <button type="button" className="btn btn-block" onClick={() => fileInput.current?.click()}>
          Restore from backup…
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={restore} />
      </section>

      <section className="field">
        <span className="field-label">Export</span>
        <button type="button" className="btn btn-block" onClick={exportCsv}>
          Export all sets (CSV)
        </button>
        <span className="row-meta">Date, session, exercise, set number, weight, reps, warm-up, note</span>
      </section>

      <section className="field">
        <span className="field-label">Copy for Claude</span>
        <div className="time-grid">
          <label className="field">
            <span className="row-meta">From</span>
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="row-meta">To</span>
            <input className="input" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={copy} disabled={!from || !to}>
          {copied ? 'Copied ✓' : `Copy for Claude (${plural(inRange, 'session')})`}
        </button>
        <pre className="claude-preview" aria-label="Text that will be copied">
          {summary}
        </pre>
      </section>
    </>
  );
}
