import { useEffect } from 'react';
import { Beer, Crosshair } from 'lucide-react';
import { AuthProvider, useAuth } from '../auth';
import { RouterProvider, useRouter } from '../router';
import { FeedbackProvider } from '../ui/feedback';
import { ErrorNotice, PageTitle, Spinner } from '../ui/misc';
import { AppShell, type NavItem } from '../shell/AppShell';
import { LoginScreen } from '../shell/LoginScreen';
import { ScheduleDataProvider, useSchedule } from '../data/schedule-data';
import { ScheduleView } from '../schedule/ScheduleView';
import { todayISO } from '../../lib/dates';
import { isOpenSwap } from '../../lib/schedule/slots';
import type { ScheduleType } from '../../lib/schedule/types';

const BASE = '/helfer';

export default function HelferApp() {
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
    if (auth.status === 'signedIn' && path === `${BASE}/login`) navigate(BASE, { replace: true });
  }, [auth.status, path, navigate]);

  if (auth.status === 'loading') return <div className="app-loading"><Spinner /></div>;
  if (auth.status === 'signedOut') return <LoginScreen area="helfer" />;

  return (
    <ScheduleDataProvider enabled>
      <Layout />
    </ScheduleDataProvider>
  );
}

function Layout() {
  const { path } = useRouter();
  const schedule = useSchedule();
  const type: ScheduleType = path === `${BASE}/schiessaufsicht` ? 'aufsicht' : 'wirte';
  const today = todayISO();
  const pending = (t: ScheduleType) => schedule.swaps[t].filter((s) => isOpenSwap(s, today)).length;

  const nav: NavItem[] = [
    { to: BASE, label: 'Wirte', icon: Beer, badge: pending('wirte') },
    { to: `${BASE}/schiessaufsicht`, label: 'Schießaufsicht', icon: Crosshair, badge: pending('aufsicht') },
  ];

  return (
    <AppShell areaLabel="Helferbereich" nav={nav}>
      <PageTitle
        title={type === 'wirte' ? 'Wirte-Kalender' : 'Schießaufsicht-Kalender'}
        description="Tippe auf einen Tag, um einen Tausch anzufragen. Unter „Ich bin…“ kannst du deine Termine hervorheben."
      />
      {schedule.error ? (
        <ErrorNotice>Die Einteilung konnte nicht geladen werden. Bitte melde dich erneut an.</ErrorNotice>
      ) : (
        <ScheduleView key={type} type={type} mode="helper" />
      )}
    </AppShell>
  );
}
