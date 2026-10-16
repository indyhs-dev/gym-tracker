import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Today',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    to: '/progress',
    label: 'Progress',
    icon: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  },
  {
    to: '/sauna',
    label: 'Sauna',
    // Heat rising from a bench.
    icon: <path d="M8 14c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5M12 14c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5M16 14c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5M4 19h16" />,
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <>
        <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
  },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {tab.icon}
            </svg>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
