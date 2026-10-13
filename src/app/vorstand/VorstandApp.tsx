import { useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays,
  CalendarRange,
  FileText,
  Images,
  LayoutDashboard,
  PartyPopper,
  Settings,
  Users,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../auth';
import { RouterProvider, useRouter } from '../router';
import { FeedbackProvider } from '../ui/feedback';
import { ErrorNotice, Spinner } from '../ui/misc';
import { AppShell, type NavItem } from '../shell/AppShell';
import { LoginScreen } from '../shell/LoginScreen';
import { ScheduleDataProvider, useSchedule } from '../data/schedule-data';
import { db } from '../firebase';
import { publishShootingDates } from '../data/repo';
import { findConflicts } from '../../lib/schedule/conflicts';
import { isOpenSwap, isShootingDay } from '../../lib/schedule/slots';
import { isPlaceholder } from '../../lib/schedule/types';
import { todayISO } from '../../lib/dates';
import { useNewerVersion } from '../version';
import { Overview } from './Overview';
import { EventsPage } from './EventsPage';
import { CalendarPage } from './CalendarPage';
import { HelpersPage } from './HelpersPage';
import { WirteDaysPage } from './WirteDaysPage';
import { ProtocolsPage } from './ProtocolsPage';
import { GalleryPage } from './GalleryPage';
import { SettingsPage } from './SettingsPage';

export const BASE = '/vorstand';

export default function VorstandApp() {
  return (
    <RouterProvider>
      <AuthProvider>
        <FeedbackProvider>
          <Gate />
        </FeedbackProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

function Gate() {
  const auth = useAuth();
  const { path, navigate } = useRouter();

  useEffect(() => {
    if (auth.status === 'signedIn' && !auth.isHelper && path === `${BASE}/login`) navigate(BASE, { replace: true });
  }, [auth.status, auth.isHelper, path, navigate]);

  if (auth.status === 'loading') return <div className="app-loading"><Spinner /></div>;
  if (auth.status === 'signedOut') return <LoginScreen area="vorstand" />;

  if (auth.isHelper) {
    return (
      <div className="login">
        <div className="login__card">
          <h1>Kein Zugriff</h1>
          <ErrorNotice>Zugriff verweigert: Helfer haben keinen Zugang zum Vorstandsbereich.</ErrorNotice>
          <div className="login__links">
            <a href="/helfer">Zum Helferbereich</a>
            <button
              type="button"
              className="btn btn--sm"
              onClick={async () => {
                await auth.signOut();
              }}
            >
              Mit anderem Konto anmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScheduleDataProvider enabled>
      <ShootingDatesPublisher />
      <Layout />
    </ScheduleDataProvider>
  );
}

function Layout() {
  const { path } = useRouter();
  const auth = useAuth();
  const schedule = useSchedule();
  const newerVersion = useNewerVersion();

  const today = todayISO();
  const pendingSwaps = schedule.swaps.wirte.concat(schedule.swaps.aufsicht).filter((s) => isOpenSwap(s, today)).length;
  const conflicts = useMemo(
    () =>
      findConflicts(schedule.assignments.wirte, schedule.assignments.aufsicht, schedule.dayRules).filter(
        (c) => c.date >= todayISO(),
      ).length,
    [schedule.assignments, schedule.dayRules],
  );

  const nav: NavItem[] = [
    { to: BASE, label: 'Übersicht', icon: LayoutDashboard },
    { to: `${BASE}/veranstaltungen`, label: 'Veranstaltungen', icon: PartyPopper },
    { to: `${BASE}/kalender`, label: 'Kalender', icon: CalendarDays, badge: pendingSwaps + conflicts },
    { to: `${BASE}/helfer`, label: 'Helfer', icon: Users },
    { to: `${BASE}/wirte-tage`, label: 'Wirte-Tage', icon: CalendarRange },
    { to: `${BASE}/protokolle`, label: 'Protokolle', icon: FileText },
    { to: `${BASE}/galerie`, label: 'Galerie', icon: Images },
    { to: `${BASE}/einstellungen`, label: 'Einstellungen', icon: Settings },
  ];

  const sub = path.slice(BASE.length).replace(/^\//, '');
  let page;
  switch (sub) {
    case '':
    case 'login':
      page = <Overview />;
      break;
    case 'veranstaltungen':
      page = <EventsPage />;
      break;
    case 'kalender':
      page = <CalendarPage />;
      break;
    case 'helfer':
      page = <HelpersPage />;
      break;
    case 'wirte-tage':
      page = <WirteDaysPage />;
      break;
    case 'protokolle':
      page = <ProtocolsPage />;
      break;
    case 'galerie':
      page = <GalleryPage />;
      break;
    case 'einstellungen':
      page = <SettingsPage />;
      break;
    default:
      page = <ErrorNotice>Diese Seite gibt es im Vorstandsbereich nicht.</ErrorNotice>;
  }

  return (
    <AppShell areaLabel="Vorstandsbereich" nav={nav}>
      {newerVersion && (
        <div className="alert alert--warning app-notice" role="alert">
          <span>
            Die Seite wurde inzwischen aktualisiert. Bitte neu laden, damit Auto-Rotation und alle Funktionen in der
            neuen Version laufen.
          </span>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => window.location.reload()}>
            Jetzt neu laden
          </button>
        </div>
      )}
      {!auth.isAdmin && (
        <div className="alert alert--warning app-notice">
          <span>
            Diesem Konto fehlt das Vorstandsrecht („admin“). Galerie-Freigaben und weitere Änderungen können deshalb
            abgelehnt werden. Wie das Recht vergeben wird, steht in der README.
          </span>
        </div>
      )}
      {schedule.error ? (
        <ErrorNotice>
          Die Einteilungsdaten konnten nicht geladen werden. Bitte Seite neu laden oder erneut anmelden.
        </ErrorNotice>
      ) : null}
      {page}
    </AppShell>
  );
}

/**
 * Veröffentlicht die kommenden Schießabende (nur Daten) für den Countdown auf der Startseite,
 * sobald sich die Schießaufsicht-Einteilung ändert.
 */
function ShootingDatesPublisher() {
  const schedule = useSchedule();
  const auth = useAuth();
  const published = useRef<string | null>(null);

  useEffect(() => {
    if (schedule.loading || schedule.error || !auth.isAdmin) return;
    const today = todayISO();
    const dates = [...new Set(schedule.assignments.aufsicht.filter((a) => !isPlaceholder(a.person)).map((a) => a.date))]
      .filter((d) => d >= today && isShootingDay(d))
      .sort()
      .slice(0, 60);
    const json = JSON.stringify(dates);
    if (published.current === json) return;

    const timer = window.setTimeout(async () => {
      try {
        if (published.current === null) {
          const current = await getDoc(doc(db, 'settings', 'schiesstermine'));
          const existing = current.exists() ? JSON.stringify(current.data().dates ?? []) : null;
          if (existing === json) {
            published.current = json;
            return;
          }
        }
        await publishShootingDates(dates);
        published.current = json;
      } catch (error) {
        console.warn('Schießtermine konnten nicht veröffentlicht werden', error);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [schedule.loading, schedule.error, schedule.assignments.aufsicht, auth.isAdmin]);

  return null;
}
