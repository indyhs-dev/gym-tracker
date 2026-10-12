import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { useSettings } from '../../db/settings';
import { plural } from '../../lib/format';
import { formatDate } from '../../lib/time';

export default function Settings() {
  const exerciseCount = useLiveQuery(() => db.exercises.count(), []);
  const templateCount = useLiveQuery(() => db.templates.count(), []);
  const settings = useSettings();

  return (
    <>
      <h1 className="screen-title">Settings</h1>
      <ul className="list">
        <li>
          <Link className="list-row" to="/settings/templates">
            <span className="row-text">
              <span className="row-title">Templates</span>
              <span className="row-meta">{templateCount === undefined ? '…' : plural(templateCount, 'template')}</span>
            </span>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link className="list-row" to="/settings/exercises">
            <span className="row-text">
              <span className="row-title">Exercises</span>
              <span className="row-meta">{exerciseCount ?? '…'} in library</span>
            </span>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link className="list-row" to="/settings/rest">
            <span className="row-text">
              <span className="row-title">Rest guidance</span>
              <span className="row-meta">Shown on each exercise during a workout</span>
            </span>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link className="list-row" to="/settings/backup">
            <span className="row-text">
              <span className="row-title">Backup &amp; export</span>
              <span className="row-meta">
                {settings?.lastBackupAt ? `Last backup ${formatDate(settings.lastBackupAt)}` : 'No backup saved yet'}
              </span>
            </span>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
