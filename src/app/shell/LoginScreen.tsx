import { useState, type SubmitEvent } from 'react';
import { ArrowLeft, LogIn } from 'lucide-react';
import { loginErrorMessage, useAuth } from '../auth';

interface Props {
  area: 'vorstand' | 'helfer';
}

export function LoginScreen({ area }: Props) {
  const auth = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isVorstand = area === 'vorstand';

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isVorstand) await auth.signInVorstand(login, password);
      else await auth.signInHelfer(login, password);
    } catch (err) {
      setError(loginErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <a className="login__logo" href="/" aria-label="Zur Startseite">
          <img src="/icons/icon-192.png" alt="" width="72" height="72" />
        </a>
        <h1>{isVorstand ? 'Vorstandsbereich' : 'Helfer Login'}</h1>
        <p className="login__subtitle">
          {isVorstand ? 'Bitte melden Sie sich an' : 'Zugang für Wirte & Schießaufsicht'}
        </p>

        {error && (
          <p className="alert alert--danger login__error" role="alert">
            {error}
          </p>
        )}

        <div className="field">
          <label className="label" htmlFor="login">
            {isVorstand ? 'Benutzername oder E-Mail' : 'Benutzername'}
          </label>
          <input
            id="login"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || !login || !password}>
          <LogIn aria-hidden="true" /> {busy ? 'Anmeldung läuft…' : 'Anmelden'}
        </button>

        <div className="login__links">
          <a href="/">
            <ArrowLeft aria-hidden="true" /> Zurück zur Startseite
          </a>
          {isVorstand ? <a href="/helfer/login">Zum Helfer Login</a> : <a href="/vorstand/login">Zum Vorstand Login</a>}
        </div>
      </form>
    </div>
  );
}
