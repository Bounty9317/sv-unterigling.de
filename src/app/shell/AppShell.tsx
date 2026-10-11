import { useState, type ReactNode } from 'react';
import { ExternalLink, LogOut, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../auth';
import { Link, useRouter } from '../router';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

function useTheme() {
  const read = () => {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(read);
  const toggle = () => {
    const next = read() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('svu-theme', next);
    } catch {
      /* ignorieren */
    }
    setTheme(next);
  };
  return { theme, toggle };
}

export function AppShell({
  areaLabel,
  nav,
  children,
  headerExtra,
}: {
  areaLabel: string;
  nav: NavItem[];
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  const auth = useAuth();
  const { path } = useRouter();
  const { theme, toggle } = useTheme();

  const isActive = (to: string) => (to === nav[0]?.to ? path === to : path === to || path.startsWith(`${to}/`));

  async function logout() {
    await auth.signOut();
    window.location.href = '/';
  }

  return (
    <div className="app">
      <header className="app-bar">
        <a className="app-bar__brand" href="/">
          <img src="/icons/icon-192.png" alt="" width="40" height="40" />
          <span>
            <span className="app-bar__name">Schützenverein Unterigling</span>
            <span className="app-bar__area">{areaLabel}</span>
          </span>
        </a>
        <div className="app-bar__actions">
          {headerExtra}
          <button
            type="button"
            className="btn btn--on-dark btn--icon btn--sm"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <span className="app-bar__user" title={auth.user?.email ?? ''}>
            {auth.user?.email}
          </span>
          <a className="btn btn--on-dark btn--sm app-bar__site" href="/">
            <ExternalLink aria-hidden="true" /> <span>Zur Webseite</span>
          </a>
          <button type="button" className="btn btn--on-dark btn--sm" onClick={logout}>
            <LogOut aria-hidden="true" /> <span>Abmelden</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-nav" aria-label={`Navigation ${areaLabel}`}>
          <ul role="list">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link to={item.to} aria-current={isActive(item.to) ? 'page' : undefined}>
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {!!item.badge && <span className="app-nav__badge">{item.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="app-main" id="inhalt-app">
          {children}
        </main>
      </div>
    </div>
  );
}
