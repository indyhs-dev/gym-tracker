import { NavLink } from 'react-router';
import type { Section } from '../lib/nav';

const SECTIONS: Record<Exclude<Section, 'settings'>, { title: string; tabs: { to: string; label: string }[] }> = {
  gym: {
    title: 'Gym',
    tabs: [
      { to: '/', label: 'Today' },
      { to: '/history', label: 'History' },
      { to: '/progress', label: 'Progress' },
    ],
  },
  sauna: {
    title: 'Sauna',
    tabs: [
      { to: '/sauna', label: 'Today' },
      { to: '/sauna/history', label: 'History' },
      { to: '/sauna/progress', label: 'Progress' },
    ],
  },
};

/** Section title and its Today · History · Progress tabs (the bottom bar picks the section). */
export default function SectionHeader({ section }: { section: 'gym' | 'sauna' }) {
  const { title, tabs } = SECTIONS[section];
  return (
    <header className="section-header">
      <h1 className="screen-title">{title}</h1>
      <nav className="section-tabs" aria-label={title}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end replace className="section-tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
