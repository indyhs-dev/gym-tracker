import { useState } from 'react';
import Sheet from '../../components/Sheet';
import { deleteScan, saveScan, scanOnDate, type ScanInput } from '../../db/bodyScans';
import type { BodyScan, ScanBalance, ScanField, ScanMeasure, ScanRating } from '../../db/types';
import { dateMs, parseScanText, SCAN_FIELDS, type ScanFieldInfo } from '../../lib/bodyScan';
import { parseDecimal, plural } from '../../lib/format';
import { formatDate, toDateInput } from '../../lib/time';

interface FieldDraft {
  value: string;
  rating: ScanRating | '';
  min: string;
  max: string;
  /** A bracketed share ("[67%]") from the paste, kept as is. */
  share?: number;
}

interface Draft {
  date: string;
  time: string;
  fields: Record<ScanField, FieldDraft>;
  upperLower: ScanBalance | '';
  leftRight: ScanBalance | '';
}

const str = (n: number | undefined) => (n === undefined ? '' : String(n));

function toDraft(m: ScanMeasure | undefined): FieldDraft {
  return { value: str(m?.value), rating: m?.rating ?? '', min: str(m?.min), max: str(m?.max), share: m?.share };
}

function emptyDraft(scan: BodyScan | undefined, now: number): Draft {
  return {
    date: scan?.date ?? toDateInput(now),
    time: scan?.time ?? '',
    fields: Object.fromEntries(SCAN_FIELDS.map((f) => [f.key, toDraft(scan?.values[f.key])])) as Record<ScanField, FieldDraft>,
    upperLower: scan?.upperLower ?? '',
    leftRight: scan?.leftRight ?? '',
  };
}

/** The draft as a scan, or an error message naming the first bad field. */
function fromDraft(d: Draft): ScanInput | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Enter the scan date.';
  const values: ScanInput['values'] = {};
  for (const f of SCAN_FIELDS) {
    const fd = d.fields[f.key];
    const nums = { value: parseDecimal(fd.value), min: parseDecimal(fd.min), max: parseDecimal(fd.max) };
    for (const k of ['value', 'min', 'max'] as const) {
      if (fd[k].trim() !== '' && nums[k] === null) return `${f.label}: “${fd[k]}” isn’t a number.`;
    }
    if (nums.value === null) {
      if (fd.rating || nums.min !== null || nums.max !== null) return `${f.label}: enter the value too, or clear it.`;
      continue;
    }
    const m: ScanMeasure = { value: nums.value };
    if (fd.rating) m.rating = fd.rating;
    if (nums.min !== null) m.min = nums.min;
    if (nums.max !== null) m.max = nums.max;
    if (fd.share !== undefined) m.share = fd.share;
    values[f.key] = m;
  }
  return {
    date: d.date,
    time: d.time || null,
    values,
    upperLower: d.upperLower || null,
    leftRight: d.leftRight || null,
  };
}

interface Props {
  /** The scan to edit; omit to add a new one. */
  scan?: BodyScan;
  onClose: () => void;
}

/** Add or edit a body scan: paste the Evolt text, check the values it read, save. */
export default function ScanSheet({ scan, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(scan, Date.now()));
  const [paste, setPaste] = useState('');
  const [found, setFound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function readPaste(text: string) {
    setPaste(text);
    if (text.trim() === '') {
      setFound(null);
      return;
    }
    const p = parseScanText(text);
    setFound(p.found);
    // Fill in what was read; anything not in the paste keeps what's already in the form.
    setDraft((d) => ({
      date: p.date ?? d.date,
      time: p.date ? (p.time ?? '') : d.time,
      fields: Object.fromEntries(
        SCAN_FIELDS.map((f) => [f.key, p.values[f.key] ? toDraft(p.values[f.key]) : d.fields[f.key]]),
      ) as Record<ScanField, FieldDraft>,
      upperLower: p.upperLower ?? d.upperLower,
      leftRight: p.leftRight ?? d.leftRight,
    }));
    setError(null);
  }

  const setField = (key: ScanField, patch: Partial<FieldDraft>) => {
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: { ...d.fields[key], ...patch } } }));
    setError(null);
  };

  async function save() {
    const input = fromDraft(draft);
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setBusy(true);
    try {
      const clash = await scanOnDate(input.date, scan?.id);
      if (clash && !window.confirm(`There’s already a scan on ${formatDate(dateMs(input.date))}. Replace it?`)) return;
      await saveScan(input, scan?.id, clash?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!scan || !window.confirm('Delete this scan? This can’t be undone.')) return;
    await deleteScan(scan.id);
    onClose();
  }

  const fields = (group: ScanFieldInfo['group']) =>
    SCAN_FIELDS.filter((f) => f.group === group).map((f) => (
      <FieldRow key={f.key} info={f} draft={draft.fields[f.key]} onChange={(patch) => setField(f.key, patch)} />
    ));

  return (
    <Sheet title={scan ? 'Edit scan' : 'Add scan'} onClose={onClose}>
      <label className="field">
        <span className="field-label">Paste scan text</span>
        <textarea
          className="input scan-paste"
          value={paste}
          onChange={(e) => readPaste(e.target.value)}
          placeholder={'Date: DD-MM-YYYY HH:MM\nWeight: 0.0\nLean Body Mass: 0.0 / Optimal [0.0 - 0.0]\n…'}
          rows={5}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <span className="row-meta">
          {found === null
            ? 'The values it reads fill in the form below. Check them, then save.'
            : found === 0
              ? 'Couldn’t read anything from that. You can type the values below.'
              : `Read ${plural(found, 'value')}. Check them below, then save.`}
        </span>
      </label>

      <div className="time-grid">
        <label className="field">
          <span className="field-label">Date</span>
          <input
            className="input"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Time</span>
          <input className="input" type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
        </label>
      </div>

      <h3 className="field-label scan-section">Body composition</h3>
      <div className="scan-fields">{fields('composition')}</div>

      <h3 className="field-label scan-section">Segmental</h3>
      <div className="scan-fields">{fields('segmental')}</div>

      <h3 className="field-label scan-section">Balance</h3>
      <div className="scan-fields">
        <BalanceRow label="Upper–lower" value={draft.upperLower} onChange={(v) => setDraft((d) => ({ ...d, upperLower: v }))} />
        <BalanceRow label="Left–right" value={draft.leftRight} onChange={(v) => setDraft((d) => ({ ...d, leftRight: v }))} />
      </div>

      {error && (
        <p className="form-error scan-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block scan-save" onClick={save} disabled={busy}>
        Save scan
      </button>
      {scan && (
        <button type="button" className="btn btn-block btn-quiet" onClick={remove}>
          Delete scan
        </button>
      )}
    </Sheet>
  );
}

function FieldRow({ info, draft, onChange }: { info: ScanFieldInfo; draft: FieldDraft; onChange: (patch: Partial<FieldDraft>) => void }) {
  return (
    <div className="scan-field">
      <span className="scan-field-label">
        {info.label}
        {info.unit && <span className="row-meta"> {info.unit}</span>}
      </span>
      <div className={info.rated ? 'scan-inputs' : 'scan-inputs is-plain'}>
        <input
          className="input"
          inputMode="decimal"
          aria-label={info.label}
          value={draft.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
        {info.rated && (
          <>
            <select
              className="input select"
              aria-label={`${info.label} rating`}
              value={draft.rating}
              onChange={(e) => onChange({ rating: e.target.value as ScanRating | '' })}
            >
              <option value="">–</option>
              <option value="Under">Under</option>
              <option value="Optimal">Optimal</option>
              <option value="High">High</option>
            </select>
            <input
              className="input"
              inputMode="decimal"
              aria-label={`${info.label} range from`}
              placeholder="min"
              value={draft.min}
              onChange={(e) => onChange({ min: e.target.value })}
            />
            <input
              className="input"
              inputMode="decimal"
              aria-label={`${info.label} range to`}
              placeholder="max"
              value={draft.max}
              onChange={(e) => onChange({ max: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function BalanceRow({ label, value, onChange }: { label: string; value: ScanBalance | ''; onChange: (v: ScanBalance | '') => void }) {
  return (
    <label className="scan-field scan-balance">
      <span className="scan-field-label">{label}</span>
      <select className="input select" value={value} onChange={(e) => onChange(e.target.value as ScanBalance | '')}>
        <option value="">–</option>
        <option value="Balanced">Balanced</option>
        <option value="Unbalanced">Unbalanced</option>
      </select>
    </label>
  );
}
