import { useMemo, useState } from 'react';
import { CircleCheck, FileDown, GripVertical, Repeat2, TriangleAlert, UserRound } from 'lucide-react';
import { useSchedule } from '../data/schedule-data';
import { useScheduleActions } from './useScheduleActions';
import { setDragData } from './CalendarGrid';
import { PersonChip, colorVar } from '../ui/misc';
import { errorMessage, useToast } from '../ui/feedback';
import { formatDate, formatDateWithWeekday, todayISO } from '../../lib/dates';
import { findConflicts } from '../../lib/schedule/conflicts';
import { personData } from '../../lib/schedule/pdf-data';
import { downloadPersonPdf } from '../../lib/schedule/pdf';
import { effectiveSlot, isOpenSwap, swapTarget } from '../../lib/schedule/slots';
import { SLOT_LABEL, TYPE_LABEL, isPlaceholder, type Person, type ScheduleType, type Slot } from '../../lib/schedule/types';

export function usePersonPdf(type: ScheduleType) {
  const schedule = useSchedule();
  const toast = useToast();
  return async (person: Person) => {
    const data = personData({
      type,
      person: person.name,
      assignments: schedule.assignments[type],
      notes: schedule.notes[type],
      wirteDays: schedule.wirteDays,
      today: todayISO(),
      seasons: schedule.dayRules.seasons,
    });
    if (!data.rows.length) {
      toast.error(data.emptyMessage);
      return;
    }
    try {
      await downloadPersonPdf({ type, person: person.name, color: person.color, data });
    } catch (error) {
      toast.error(`Fehler beim Erstellen der PDF: ${errorMessage(error)}`);
    }
  };
}

/** Personen: im Vorstand zum Einteilen ziehen, für alle als PDF herunterladen. */
export function PersonPanel({ type, editable }: { type: ScheduleType; editable: boolean }) {
  const schedule = useSchedule();
  const pdf = usePersonPdf(type);
  const persons = schedule.persons[type];

  return (
    <section className="panel side-panel">
      <header className="panel__header">
        <h2>{TYPE_LABEL[type]}</h2>
      </header>
      <p className="hint">
        {editable
          ? 'Person auf einen Tag ziehen zum Einteilen. Mit dem PDF-Symbol entsteht eine Liste aller Termine der Person.'
          : 'Klicke auf eine Person, um eine PDF mit allen Terminen zu erstellen:'}
      </p>
      {persons.length === 0 ? (
        <p className="muted">Keine Helfer vorhanden.</p>
      ) : (
        <ul role="list" className="palette">
          {persons.map((person) => (
            <li key={person.id} className="palette__item">
              <span
                className={`chip palette__chip${editable ? ' is-draggable' : ''}`}
                style={colorVar(person.color)}
                draggable={editable}
                onDragStart={editable ? (e) => setDragData(e, { kind: 'person', id: person.id }) : undefined}
              >
                {editable && <GripVertical aria-hidden="true" />}
                {person.name}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => pdf(person)}
                aria-label={`PDF mit allen Terminen von ${person.name}`}
                title="PDF mit allen Terminen"
              >
                <FileDown aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MY_KEY = (type: ScheduleType) => `svu-ich-${type}`;

export function useMyPerson(type: ScheduleType): [string | null, (name: string | null) => void] {
  const [name, setName] = useState<string | null>(() => {
    try {
      return localStorage.getItem(MY_KEY(type));
    } catch {
      return null;
    }
  });
  const update = (next: string | null) => {
    setName(next);
    try {
      if (next) localStorage.setItem(MY_KEY(type), next);
      else localStorage.removeItem(MY_KEY(type));
    } catch {
      /* ignorieren */
    }
  };
  return [name, update];
}

/** Helfer: eigene Person wählen → eigene Termine hervorheben und auflisten. */
export function MyDutiesPanel({ type, me, setMe }: { type: ScheduleType; me: string | null; setMe(name: string | null): void }) {
  const schedule = useSchedule();
  const persons = schedule.persons[type];
  const today = todayISO();
  const mine = useMemo(
    () =>
      me
        ? schedule.assignments[type]
            .filter((a) => a.person === me && a.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 8)
        : [],
    [me, schedule.assignments, type, today],
  );

  return (
    <section className="panel side-panel">
      <header className="panel__header">
        <h2>
          <UserRound aria-hidden="true" className="inline-icon" /> Meine Termine
        </h2>
      </header>
      <div className="field">
        <label className="label" htmlFor={`me-${type}`}>
          Ich bin…
        </label>
        <select id={`me-${type}`} className="select" value={me ?? ''} onChange={(e) => setMe(e.target.value || null)}>
          <option value="">– bitte wählen –</option>
          {persons.filter((p) => !isPlaceholder(p.name)).map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="hint">Wird nur in diesem Browser gespeichert und hebt deine Termine im Kalender hervor.</span>
      </div>
      {me &&
        (mine.length ? (
          <ul role="list" className="my-duties">
            {mine.map((a) => (
              <li key={a.id}>
                <strong>{formatDateWithWeekday(a.date)}</strong>
                {type === 'wirte' && <span className="muted">{SLOT_LABEL[effectiveSlot(type, a, schedule.dayRules)]}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Keine kommenden Termine.</p>
        ))}
    </section>
  );
}

/** Tauschbörse: offene und erledigte Tauschanfragen. */
export function SwapPanel({ type }: { type: ScheduleType }) {
  const schedule = useSchedule();
  const actions = useScheduleActions(type);
  const [busy, setBusy] = useState<string | null>(null);

  const swaps = useMemo(
    () => [...schedule.swaps[type]].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [schedule.swaps, type],
  );
  const today = todayISO();
  const pending = swaps.filter((s) => isOpenSwap(s, today));
  const expired = swaps.filter((s) => s.status === 'pending' && !isOpenSwap(s, today));
  const done = swaps.filter((s) => s.status === 'completed' && s.replacementPerson).slice(0, 8);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const slotSuffix = (slot: Slot | null) => (type === 'wirte' && slot ? ` (${SLOT_LABEL[slot]})` : '');

  return (
    <section className="panel side-panel">
      <header className="panel__header">
        <h2>
          <Repeat2 aria-hidden="true" className="inline-icon" /> Tausch-Anfragen
        </h2>
        {pending.length > 0 && <span className="badge badge--warning">{pending.length} offen</span>}
      </header>
      {pending.length === 0 && done.length === 0 && expired.length === 0 && <p className="muted">Keine Anfragen</p>}
      {pending.length > 0 && (
        <ul role="list" className="swap-list">
          {pending.map((swap) => {
            const target = swapTarget(swap);
            return (
              <li key={swap.id} className="swap">
                <p>
                  <strong>{swap.requestPerson}</strong> sucht Ersatz für {formatDate(target.date)}
                  {slotSuffix(target.slot)}
                </p>
                <p className="muted">{swap.replacementPerson ? `Angefragt: ${swap.replacementPerson}` : 'Warte auf Zusage...'}</p>
                <div className="swap__actions">
                  {swap.replacementPerson && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={busy === swap.id}
                      onClick={() => run(swap.id, () => actions.accept(swap))}
                    >
                      ✓ {swap.replacementPerson} übernimmt
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busy === swap.id}
                    onClick={() => run(swap.id, () => actions.dismissSwap(swap))}
                  >
                    ✗ Zurückziehen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {expired.length > 0 && (
        <>
          <h3 className="side-panel__subtitle">Abgelaufen (nie bestätigt)</h3>
          <ul role="list" className="swap-list swap-list--done">
            {expired.map((swap) => {
              const target = swapTarget(swap);
              return (
                <li key={swap.id} className="swap swap--done">
                  <Repeat2 aria-hidden="true" />
                  <span>
                    <strong>{swap.requestPerson}</strong> suchte Ersatz für {formatDate(target.date)}
                    {slotSuffix(target.slot)}
                    {swap.replacementPerson ? ` (angefragt: ${swap.replacementPerson})` : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    aria-label="Eintrag entfernen"
                    title="Eintrag entfernen"
                    disabled={busy === swap.id}
                    onClick={() => run(swap.id, () => actions.dismissSwap(swap, 'Eintrag entfernen'))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h3 className="side-panel__subtitle">Erledigt</h3>
          <ul role="list" className="swap-list swap-list--done">
            {done.map((swap) => {
              const target = swapTarget(swap);
              return (
                <li key={swap.id} className="swap swap--done">
                  <CircleCheck aria-hidden="true" />
                  <span>
                    <strong>{swap.replacementPerson}</strong> hat für <strong>{swap.requestPerson}</strong> am {formatDate(target.date)}
                    {slotSuffix(target.slot)} übernommen
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    aria-label="Eintrag entfernen"
                    title="Eintrag entfernen"
                    disabled={busy === swap.id}
                    onClick={() => run(swap.id, () => actions.dismissSwap(swap, 'Eintrag entfernen'))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Warnung bei Wirt (Schießabend) + Schießaufsicht am selben Tag. */
export function ConflictsPanel({ onJump }: { onJump(date: string): void }) {
  const schedule = useSchedule();
  const today = todayISO();
  const conflicts = useMemo(
    () => findConflicts(schedule.assignments.wirte, schedule.assignments.aufsicht, schedule.dayRules).filter((c) => c.date >= today),
    [schedule.assignments, schedule.dayRules, today],
  );
  if (!conflicts.length) return null;
  return (
    <section className="alert alert--danger conflicts" aria-labelledby="conflicts-title">
      <TriangleAlert aria-hidden="true" />
      <div>
        <h2 id="conflicts-title" className="conflicts__title">
          Doppelte Einteilungen gefunden!
        </h2>
        <p className="muted">Diese Personen sind gleichzeitig als Wirt und Schießaufsicht eingeteilt:</p>
        <ul role="list" className="conflicts__list">
          {conflicts.map((c) => (
            <li key={`${c.date}-${c.person}`}>
              <button type="button" className="conflicts__item" onClick={() => onJump(c.date)}>
                <PersonChip
                  name={c.person}
                  color={schedule.persons.wirte.find((p) => p.name === c.person)?.color ?? '#c62828'}
                  small
                />
                <span>{formatDateWithWeekday(c.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
