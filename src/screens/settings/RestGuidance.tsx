import { useState, type FormEvent } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { updateSettings, useSettings } from '../../db/settings';
import type { RestGuidance as Rest } from '../../db/types';

const FIELDS: { key: keyof Rest; label: string }[] = [
  { key: 'warmup', label: 'Warm-up sets' },
  { key: 'compound', label: 'Compound' },
  { key: 'isolation', label: 'Isolation' },
  { key: 'core', label: 'Core' },
];

export default function RestGuidance() {
  const settings = useSettings();
  return (
    <>
      <ScreenHeader title="Rest guidance" back="/settings" backLabel="Settings" />
      <p className="muted intro">
        Shown on each exercise during a workout, by exercise type. The rest timer turns green at the first number (e.g.
        3 min for “3–5 min”).
      </p>
      {settings && <RestForm saved={settings.rest} />}
    </>
  );
}

function RestForm({ saved }: { saved: Rest }) {
  const [rest, setRest] = useState(saved);
  const dirty = FIELDS.some(({ key }) => rest[key] !== saved[key]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = Object.fromEntries(FIELDS.map(({ key }) => [key, rest[key].trim()])) as unknown as Rest;
    setRest(trimmed);
    await updateSettings({ rest: trimmed });
  }

  return (
    <form onSubmit={submit}>
      {FIELDS.map(({ key, label }) => (
        <label key={key} className="field">
          <span className="field-label">{label}</span>
          <input
            className="input"
            value={rest[key]}
            onChange={(e) => setRest({ ...rest, [key]: e.target.value })}
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>
      ))}
      <button type="submit" className="btn btn-primary btn-block" disabled={!dirty}>
        {dirty ? 'Save' : 'Saved'}
      </button>
    </form>
  );
}
