import { useMemo } from 'react';
import { ArrowRight, CalendarDays, FileUp, ImageUp, Plus, Repeat2, TriangleAlert } from 'lucide-react';
import { useSchedule } from '../data/schedule-data';
import { col, toEvent, useLiveCollection } from '../data/collections';
import { Link } from '../router';
import { PageTitle, PersonChip } from '../ui/misc';
import { addDays, formatDate, formatDateLong, todayISO, datesBetween } from '../../lib/dates';
import { upcomingEvents } from '../../lib/events';
import { buildDay, countOpenSlots, indexAssignments } from '../../lib/schedule/model';
import { findConflicts } from '../../lib/schedule/conflicts';
import { SLOT_LABEL, TYPE_LABEL, type ScheduleType } from '../../lib/schedule/types';
import { isOpenSwap, isShootingDay } from '../../lib/schedule/slots';

const BASE = '/vorstand';

const persons = (n: number) => (n === 1 ? '1 Person' : `${n} Personen`);

export function Overview() {
  const schedule = useSchedule();
  const events = useLiveCollection(col.events, toEvent);
  const today = todayISO();

  const nextEvents = useMemo(() => upcomingEvents(events.data, today).slice(0, 4), [events.data, today]);
  const window8Weeks = useMemo(() => datesBetween(today, addDays(today, 56)), [today]);

  const open = useMemo(() => {
    const result = {} as Record<ScheduleType, number>;
    for (const type of ['wirte', 'aufsicht'] as const) {
      result[type] = countOpenSlots(type, window8Weeks, {
        assignments: schedule.assignments[type],
        notes: [],
        wirteDays: schedule.wirteDays,
        seasons: schedule.dayRules.seasons,
      });
    }
    return result;
  }, [schedule.assignments, schedule.wirteDays, schedule.dayRules, window8Weeks]);

  const pendingSwaps = schedule.swaps.wirte.concat(schedule.swaps.aufsicht).filter((s) => isOpenSwap(s, today));
  const conflicts = useMemo(
    () =>
      findConflicts(schedule.assignments.wirte, schedule.assignments.aufsicht, schedule.dayRules).filter(
        (c) => c.date >= today,
      ),
    [schedule.assignments, schedule.dayRules, today],
  );

  // Die nächsten Diensttage mit Besetzung
  const upcomingDuty = useMemo(() => {
    const wirteDays = new Map(schedule.wirteDays.map((d) => [d.date, d]));
    const indexW = indexAssignments('wirte', schedule.assignments.wirte, schedule.dayRules);
    const indexA = indexAssignments('aufsicht', schedule.assignments.aufsicht, schedule.dayRules);
    const notesW = new Map(schedule.notes.wirte.map((n) => [n.date, n]));
    const notesA = new Map(schedule.notes.aufsicht.map((n) => [n.date, n]));
    return datesBetween(today, addDays(today, 21))
      .map((date) => ({
        date,
        wirte: buildDay('wirte', date, indexW, notesW, wirteDays, schedule.dayRules),
        aufsicht: buildDay('aufsicht', date, indexA, notesA, wirteDays, schedule.dayRules),
      }))
      .filter((d) => d.wirte.allowed || d.aufsicht.allowed)
      .slice(0, 4);
  }, [schedule, today]);

  return (
    <>
      <PageTitle
        title="Übersicht"
        description="Alles Wichtige auf einen Blick – Termine, offene Dienste und Tauschanfragen."
      />

      <div className="quick-actions">
        <Link className="btn btn--primary" to={`${BASE}/veranstaltungen?neu=1`}>
          <Plus aria-hidden="true" /> Neue Veranstaltung
        </Link>
        <Link className="btn" to={`${BASE}/kalender`}>
          <CalendarDays aria-hidden="true" /> Kalender verwalten
        </Link>
        <Link className="btn" to={`${BASE}/protokolle`}>
          <FileUp aria-hidden="true" /> Protokoll hochladen
        </Link>
        <Link className="btn" to={`${BASE}/galerie`}>
          <ImageUp aria-hidden="true" /> Bilder freigeben
        </Link>
      </div>

      <div className="stat-grid">
        <Link className="stat" to={`${BASE}/kalender`}>
          <span className="stat__value">{open.wirte}</span>
          <span className="stat__label">offene Wirte-Dienste (8 Wochen)</span>
        </Link>
        <Link className="stat" to={`${BASE}/kalender?typ=aufsicht`}>
          <span className="stat__value">{open.aufsicht}</span>
          <span className="stat__label">offene Schießaufsicht-Dienste (8 Wochen)</span>
        </Link>
        <Link className={`stat${pendingSwaps.length ? ' stat--attention' : ''}`} to={`${BASE}/kalender`}>
          <span className="stat__value">{pendingSwaps.length}</span>
          <span className="stat__label">offene Tauschanfragen</span>
        </Link>
        <Link className={`stat${conflicts.length ? ' stat--danger' : ''}`} to={`${BASE}/kalender`}>
          <span className="stat__value">{conflicts.length}</span>
          <span className="stat__label">Doppel-Einteilungen</span>
        </Link>
      </div>

      <div className="overview-grid">
        <section className="panel">
          <header className="panel__header">
            <h2>Nächste Dienste</h2>
            <Link to={`${BASE}/kalender`} className="panel__link">
              Kalender <ArrowRight aria-hidden="true" />
            </Link>
          </header>
          {upcomingDuty.length === 0 ? (
            <p className="muted">In den nächsten drei Wochen sind keine Dienste vorgesehen.</p>
          ) : (
            <ul role="list" className="duty-list">
              {upcomingDuty.map(({ date, wirte, aufsicht }) => (
                <li key={date} className="duty">
                  <div className="duty__date">
                    <strong>{formatDateLong(date)}</strong>
                    {wirte.customDay?.description && <span className="badge badge--accent">{wirte.customDay.description}</span>}
                    {aufsicht.note && <span className="badge badge--info">{aufsicht.note.note}</span>}
                  </div>
                  <div className="duty__rows">
                    {wirte.slots
                      .filter((s) => s.expected)
                      .map((s) => (
                        <div key={`w-${s.slot}`} className="duty__row">
                          <span className="duty__label">Wirt · {SLOT_LABEL[s.slot]}</span>
                          {s.assignment ? (
                            <PersonChip name={s.assignment.person} color={s.assignment.color} small />
                          ) : (
                            <span className="badge badge--danger">nicht eingeteilt</span>
                          )}
                        </div>
                      ))}
                    {isShootingDay(date) && (
                      <div className="duty__row">
                        <span className="duty__label">Schießaufsicht</span>
                        {aufsicht.slots[0]?.assignment ? (
                          <PersonChip name={aufsicht.slots[0].assignment.person} color={aufsicht.slots[0].assignment.color} small />
                        ) : (
                          <span className="badge badge--danger">nicht eingeteilt</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Nächste Veranstaltungen</h2>
            <Link to={`${BASE}/veranstaltungen`} className="panel__link">
              Alle <ArrowRight aria-hidden="true" />
            </Link>
          </header>
          {nextEvents.length === 0 ? (
            <p className="muted">Aktuell keine kommenden Veranstaltungen.</p>
          ) : (
            <ul role="list" className="mini-events">
              {nextEvents.map((event) => (
                <li key={event.id} className={event.cancelled ? 'is-cancelled' : undefined}>
                  <span className="mini-events__date">{formatDate(event.date)}</span>
                  <span className="mini-events__title">{event.title}</span>
                  {event.cancelled && <span className="badge badge--danger">abgesagt</span>}
                  {event.registrationRequired && !event.cancelled && <span className="badge badge--warning">Anmeldung</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {(pendingSwaps.length > 0 || conflicts.length > 0) && (
          <section className="panel panel--attention">
            <header className="panel__header">
              <h2>Braucht Aufmerksamkeit</h2>
            </header>
            <ul role="list" className="attention-list">
              {conflicts.map((c) => (
                <li key={`${c.date}-${c.person}`}>
                  <TriangleAlert aria-hidden="true" />
                  <span>
                    <strong>{c.person}</strong> ist am {formatDate(c.date)} Wirt (Schießabend) und Schießaufsicht.
                  </span>
                </li>
              ))}
              {pendingSwaps.map((s) => (
                <li key={s.id}>
                  <Repeat2 aria-hidden="true" />
                  <span>
                    <strong>{s.requestPerson}</strong> sucht Ersatz für {formatDate(s.date.slice(0, 10))}
                    {s.replacementPerson ? ` – angefragt: ${s.replacementPerson}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <Link to={`${BASE}/kalender`} className="btn btn--sm">
              Im Kalender bearbeiten
            </Link>
          </section>
        )}
      </div>

      <p className="muted overview-footnote">
        {TYPE_LABEL.wirte}: {persons(schedule.persons.wirte.length)} · {TYPE_LABEL.aufsicht}: {persons(schedule.persons.aufsicht.length)} ·{' '}
        {schedule.wirteDays.length === 1 ? '1 Wirte-Tag' : `${schedule.wirteDays.length} Wirte-Tage`} hinterlegt
      </p>
    </>
  );
}
