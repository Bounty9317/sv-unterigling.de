import { Beer, Crosshair } from 'lucide-react';
import { useRouter } from '../router';
import { useSchedule } from '../data/schedule-data';
import { PageTitle } from '../ui/misc';
import { ScheduleView } from '../schedule/ScheduleView';
import { todayISO } from '../../lib/dates';
import { isOpenSwap } from '../../lib/schedule/slots';
import type { ScheduleType } from '../../lib/schedule/types';

export function TypeTabs({ type, onChange }: { type: ScheduleType; onChange(type: ScheduleType): void }) {
  const schedule = useSchedule();
  const today = todayISO();
  const pending = (t: ScheduleType) => schedule.swaps[t].filter((s) => isOpenSwap(s, today)).length;
  return (
    <div className="tabs" role="tablist" aria-label="Kalender">
      {(['wirte', 'aufsicht'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={type === t}
          className={`tab${type === t ? ' is-active' : ''}`}
          onClick={() => onChange(t)}
        >
          {t === 'wirte' ? <Beer aria-hidden="true" /> : <Crosshair aria-hidden="true" />}
          {t === 'wirte' ? 'Wirte' : 'Schießaufsicht'}
          {pending(t) > 0 && <span className="tab__badge">{pending(t)}</span>}
        </button>
      ))}
    </div>
  );
}

export function CalendarPage() {
  const { search, path, navigate } = useRouter();
  const type: ScheduleType = new URLSearchParams(search).get('typ') === 'aufsicht' ? 'aufsicht' : 'wirte';

  return (
    <>
      <PageTitle
        title="Kalender-Verwaltung"
        description="Wirte und Schießaufsicht einteilen, Tausch-Anfragen bearbeiten und Listen als PDF erstellen."
      />
      <TypeTabs
        type={type}
        onChange={(t) => navigate(t === 'aufsicht' ? `${path}?typ=aufsicht` : path, { replace: true })}
      />
      <ScheduleView key={type} type={type} mode="admin" />
    </>
  );
}
