import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';
import { createTemplate } from '../../db/templates';
import { plural } from '../../lib/format';

export default function Templates() {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const [newName, setNewName] = useState<string | null>(null);
  const navigate = useNavigate();

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!newName?.trim()) return;
    const template = await createTemplate(newName);
    navigate(`/settings/templates/${template.id}`);
  }

  return (
    <>
      <ScreenHeader title="Templates" back="/settings" backLabel="Settings" />

      {newName === null ? (
        <button type="button" className="btn btn-block new-button" onClick={() => setNewName('')}>
          + New template
        </button>
      ) : (
        <form className="inline-form" onSubmit={create}>
          <input
            className="input"
            placeholder="Template name"
            aria-label="Template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
          />
          <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
            Create
          </button>
        </form>
      )}

      {templates && templates.length === 0 && <p className="empty">No templates yet.</p>}
      {templates && templates.length > 0 && (
        <ul className="list">
          {templates.map((t) => (
            <li key={t.id}>
              <Link className="list-row" to={`/settings/templates/${t.id}`}>
                <span className="row-text">
                  <span className="row-title">{t.name}</span>
                  <span className="row-meta">{plural(t.slots.length, 'exercise')}</span>
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
