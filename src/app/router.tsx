/**
 * Minimaler Router für die Bereiche /vorstand/* und /helfer/*.
 * Jede Unterseite existiert auch als echte HTML-Seite – Neuladen und Lesezeichen funktionieren.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

interface RouterValue {
  path: string;
  search: string;
  navigate(to: string, options?: { replace?: boolean }): void;
}

const RouterContext = createContext<RouterValue | null>(null);

const normalize = (p: string) => (p.replace(/\.html$/, '').replace(/\/+$/, '') || '/');

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(() => ({
    path: normalize(window.location.pathname),
    search: window.location.search,
  }));

  useEffect(() => {
    const onPop = () => setLocation({ path: normalize(window.location.pathname), search: window.location.search });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const url = new URL(to, window.location.href);
    if (options?.replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
    setLocation({ path: normalize(url.pathname), search: url.search });
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ ...location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter außerhalb von RouterProvider');
  return ctx;
}

export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handleClick} {...rest} />;
}
