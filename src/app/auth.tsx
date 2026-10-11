import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { HELPER_EMAIL_DOMAIN, VEREINSKONTO, VORSTAND_LOGIN_ALIASES } from '../lib/config';

export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  /** Konto mit Helfer-Adresse (…@helfer.schuetzenverein.local) */
  isHelper: boolean;
  /** Konto mit Vorstandsrecht („admin“-Claim) */
  isAdmin: boolean;
  signInVorstand(login: string, password: string): Promise<void>;
  signInHelfer(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getToken(): Promise<string>;
}

const AuthContext = createContext<AuthState | null>(null);

export function isHelperEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(HELPER_EMAIL_DOMAIN);
}

/** Benutzername („VorstandLamm“) oder E-Mail → E-Mail */
export function vorstandEmail(login: string) {
  const value = login.trim();
  if (value.includes('@')) return value;
  const alias = VORSTAND_LOGIN_ALIASES[value.toLowerCase()];
  if (!alias) throw Object.assign(new Error('Ungültiger Benutzername'), { code: 'app/unknown-user' });
  return alias;
}

export function helperEmail(username: string) {
  const value = username.trim().toLowerCase();
  return value.includes('@') ? value : `${value}${HELPER_EMAIL_DOMAIN}`;
}

export function loginErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/too-many-requests') return 'Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.';
  if (code === 'auth/network-request-failed') return 'Keine Verbindung. Bitte prüfe deine Internetverbindung.';
  if (code === 'auth/user-disabled') return 'Dieses Konto ist deaktiviert.';
  return 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (next) => {
        if (!next) {
          setUser(null);
          setIsAdmin(false);
          setStatus('signedOut');
          return;
        }
        try {
          const token = await next.getIdTokenResult();
          // Vorstandsrecht: "admin"-Claim oder das Vereinskonto (Login "VorstandLamm")
          setIsAdmin(token.claims.admin === true || next.email?.toLowerCase() === VEREINSKONTO);
        } catch {
          setIsAdmin(false);
        }
        setUser(next);
        setStatus('signedIn');
      }),
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      isHelper: isHelperEmail(user?.email),
      isAdmin,
      async signInVorstand(login, password) {
        await signInWithEmailAndPassword(auth, vorstandEmail(login), password);
      },
      async signInHelfer(username, password) {
        await signInWithEmailAndPassword(auth, helperEmail(username), password);
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
      async getToken() {
        if (!auth.currentUser) throw new Error('Nicht eingeloggt');
        return auth.currentUser.getIdToken(true);
      },
    }),
    [status, user, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}
