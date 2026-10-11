import { useEffect, useState } from 'react';
import { Eye, ShieldCheck, Snowflake, Target } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';
import { setWinterMode } from '../data/repo';
import { PageTitle } from '../ui/misc';
import { errorMessage, useToast } from '../ui/feedback';
import { formatDate } from '../../lib/dates';

function useSetting(id: string) {
  const [data, setData] = useState<Record<string, unknown> | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', id),
        (snap) => setData(snap.exists() ? snap.data() : null),
        () => setData(null),
      ),
    [id],
  );
  return data;
}

export function SettingsPage() {
  const auth = useAuth();
  const toast = useToast();
  const winter = useSetting('winterMode');
  const counter = useSetting('visitor-counter');
  const shooting = useSetting('schiesstermine');
  const [busy, setBusy] = useState(false);

  const enabled = winter?.enabled === true;
  const dates = Array.isArray(shooting?.dates) ? (shooting.dates as string[]) : [];

  async function toggleWinter() {
    setBusy(true);
    try {
      await setWinterMode(!enabled);
      toast.success(!enabled ? 'Wintermodus aktiviert! 🎄❄️' : 'Wintermodus deaktiviert');
    } catch (error) {
      toast.error(`Fehler beim Umschalten des Wintermodus: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Einstellungen" />
      <div className="settings-grid">
        <section className="panel">
          <header className="panel__header">
            <h2>
              <Snowflake aria-hidden="true" className="inline-icon" /> Wintermodus
            </h2>
          </header>
          <p className="muted">
            Zeigt auf der Webseite Schneefall, eine Lichterkette, Christbäume und das Banner „Frohe Weihnachten!“.
          </p>
          <div className="switch-row">
            <span className={`badge ${enabled ? 'badge--info' : ''}`}>{winter === undefined ? '…' : enabled ? 'AN' : 'AUS'}</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              className={`switch${enabled ? ' is-on' : ''}`}
              onClick={toggleWinter}
              disabled={busy || winter === undefined}
            >
              <span className="switch__knob" />
              <span className="visually-hidden">Wintermodus</span>
            </button>
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>
              <Target aria-hidden="true" className="inline-icon" /> Countdown „Nächstes Schießen“
            </h2>
          </header>
          <p className="muted">
            Die Startseite zeigt den nächsten Schießabend. Die Termine werden automatisch aus der Schießaufsicht-Einteilung
            übernommen (nur Daten, keine Namen), sobald der Kalender im Vorstandsbereich geöffnet ist.
          </p>
          <p>
            {dates.length
              ? `Veröffentlicht: ${dates.length === 1 ? '1 Termin' : `${dates.length} Termine`}, nächster am ${formatDate(dates[0]!)}.`
              : 'Noch keine kommenden Schießabende veröffentlicht – bis dahin zählt die Startseite bis zur nächsten Schieß-Veranstaltung.'}
          </p>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>
              <Eye aria-hidden="true" className="inline-icon" /> Besucherzähler
            </h2>
          </header>
          <p className="stat-inline">{typeof counter?.count === 'number' ? counter.count.toLocaleString('de-DE') : '–'}</p>
          <p className="muted">Gezählt wird ein Besuch pro Browser-Sitzung.</p>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>
              <ShieldCheck aria-hidden="true" className="inline-icon" /> Konto
            </h2>
          </header>
          <dl className="definition">
            <dt>Angemeldet als</dt>
            <dd>{auth.user?.email}</dd>
            <dt>Vorstandsrecht</dt>
            <dd>{auth.isAdmin ? 'Ja' : 'Nein'}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
