import { useState } from 'react';
import ChoiceChips from '../../components/ChoiceChips';
import Sheet from '../../components/Sheet';
import { deleteSaunaEntry, saveSaunaSkip } from '../../db/sauna';
import type { SaunaSkip, SaunaSkipReason } from '../../db/types';
import { saunaToday, SKIP_REASON_LABEL } from '../../lib/sauna';

const REASONS = (Object.keys(SKIP_REASON_LABEL) as SaunaSkipReason[]).map((value) => ({
  value,
  label: SKIP_REASON_LABEL[value],
}));

/** Log (or edit) a gym day without the sauna. */
export default function SkipSheet({ entry, onClose }: { entry?: SaunaSkip; onClose: () => void }) {
  const today = saunaToday();
  const [date, setDate] = useState(entry?.date ?? today);
  const [reason, setReason] = useState<SaunaSkipReason | null>(entry?.reason ?? null);
  const [error, setError] = useState<string | null>(null);
  const problem = !date ? 'Choose a date' : date > today ? 'The date can’t be in the future' : !reason ? 'Choose a reason to save' : null;

  async function save() {
    if (problem || !reason) return;
    try {
      await saveSaunaSkip({ date, reason }, entry?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function remove() {
    if (!entry || !window.confirm('Delete this skipped day? This can’t be undone.')) return;
    onClose();
    void deleteSaunaEntry(entry.id);
  }

  return (
    <Sheet
      title={entry ? 'Edit skipped day' : 'Log a skip'}
      onClose={onClose}
      footer={
        <>
          {(error || problem) && (
            <p className={error ? 'form-error sheet-footer-note' : 'row-meta sheet-footer-note'} role={error ? 'alert' : undefined}>
              {error ?? problem}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block btn-tall" disabled={problem !== null} onClick={save}>
            {entry ? 'Save changes' : 'Save skip'}
          </button>
        </>
      }
    >
      <p className="muted intro-sheet">For a gym day without the sauna. Skips count towards your weekly target, so they never set you back.</p>

      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">Reason</span>
        <ChoiceChips label="Reason" options={REASONS} value={reason} onChange={setReason} />
      </div>

      {entry && (
        <div className="danger-zone">
          <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
            Delete skipped day
          </button>
        </div>
      )}
    </Sheet>
  );
}
