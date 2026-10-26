import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { sectionOf, type Section } from '../lib/nav';

// The bottom bar picks the section; each section has its own Today · History · Progress at the top.
const tabs: { to: string; section: Section; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    section: 'gym',
    label: 'Gym',
    icon: (
      <>
        <rect x="4.5" y="7" width="3" height="10" rx="1" />
        <rect x="16.5" y="7" width="3" height="10" rx="1" />
        <path d="M7.5 12h9M2.5 10v4M21.5 10v4" />
      </>
    ),
  },
  {
    to: '/settings',
    section: 'settings',
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
  const current = sectionOf(useLocation().pathname);
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {tabs.map((tab) => {
          const active = tab.section === current;
          return (
            <Link key={tab.to} to={tab.to} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
