import { Link, NavLink } from 'react-router';
import { SettingsIcon } from './Icons';

const TABS = [
  { to: '/', label: 'Today' },
  { to: '/history', label: 'History' },
  { to: '/progress', label: 'Progress' },
];

/** "Gym" with the Settings button in the corner, then the Today · History · Progress tabs. */
export default function SectionHeader() {
  return (
    <header className="section-header">
      <div className="section-title-row">
        <h1 className="screen-title">Gym</h1>
        <Link className="settings-button" to="/settings" aria-label="Settings">
          <SettingsIcon />
        </Link>
      </div>
      <nav className="section-tabs" aria-label="Gym">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end replace className="section-tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
