import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CircleCheck, Shuffle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PersonChip } from '../ui/misc';
import { errorMessage, useToast } from '../ui/feedback';
import { useSchedule } from '../data/schedule-data';
import { reassignMany } from '../data/repo';
import { formatDateWithWeekday, todayISO } from '../../lib/dates';
import { findStreaks, planStreakFix } from '../../lib/schedule/streaks';
import { slotText } from './useScheduleActions';
import { TYPE_LABEL, type ScheduleType } from '../../lib/schedule/types';

const shortDate = (date: string) => formatDateWithWeekday(date).replace(/\.\d{4}$/, '.');

/** Hinweis über dem Kalender, wenn jemand mehrere Dienste innerhalb einer Woche hat. */
export function StreaksPanel({ type, onJump, onFix }: { type: ScheduleType; onJump(date: string): void; onFix(): void }) {
  const schedule = useSchedule();
  const today = todayISO();
  const streaks = useMemo(() => findStreaks(schedule.assignments[type], today), [schedule.assignments, type, today]);
  if (!streaks.length) return null;

  return (
    <section className="alert alert--warning conflicts" aria-labelledby={`streaks-${type}`}>
      <CalendarClock aria-hidden="true" />
      <div>
        <h2 id={`streaks-${type}`} className="conflicts__title conflicts__title--warning">
          Mehrere Dienste innerhalb einer Woche
        </h2>
        <p className="muted">Diese Personen sind zu dicht hintereinander eingeteilt (z. B. Samstag und Sonntag oder zwei Samstage in Folge):</p>
        <ul role="list" className="conflicts__list">
          {streaks.map((s) => (
            <li key={`${s.person}-${s.assignments[0]!.date}`}>
              <button type="button" className="conflicts__item" onClick={() => onJump(s.assignments[0]!.date)}>
                <PersonChip name={s.person} color={s.assignments[0]!.color} small />
                <span>{s.assignments.map((a) => shortDate(a.date)).join(' + ')}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--sm conflicts__action" onClick={onFix}>
          <Shuffle aria-hidden="true" /> Entzerren…
        </button>
      </div>
    </section>
  );
}

/** Vorschläge zum Entzerren: weitere Dienste innerhalb einer Woche gehen an jemand anderen – vor dem Speichern anpassbar. */
export function StreaksDialog({ type, open, onClose }: { type: ScheduleType; open: boolean; onClose(): void }) {
  const schedule = useSchedule();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});

  // Vorschläge nur beim Öffnen berechnen, damit sie sich während der Auswahl nicht verschieben
  const changes = useMemo(
    () =>
      open
        ? planStreakFix({
            type,
            assignments: schedule.assignments[type],
            otherType: schedule.assignments[type === 'wirte' ? 'aufsicht' : 'wirte'],
            persons: schedule.persons[type],
            rules: schedule.dayRules,
            from: todayISO(),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, type],
  );

  useEffect(() => {
    if (open) setChoice(Object.fromEntries(changes.map((c) => [c.assignment.id, c.suggestion?.name ?? ''])));
  }, [open, changes]);

  const selected = changes
    .map((c) => ({ change: c, person: schedule.persons[type].find((p) => p.name === choice[c.assignment.id]) }))
    .filter((x) => x.person);

  async function apply() {
    setBusy(true);
    try {
      await reassignMany(
        type,
        selected.map(({ change, person }) => ({ assignment: change.assignment, slot: change.slot, person: person! })),
        schedule.swaps[type],
      );
      toast.success(
        `✓ ${selected.length === 1 ? '1 Dienst wurde' : `${selected.length} Dienste wurden`} neu vergeben.`,
      );
      onClose();
    } catch (error) {
      toast.error(`Fehler beim Speichern: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Dienste entzerren – ${TYPE_LABEL[type]}`}
      description="Der erste Dienst bleibt, weitere Dienste innerhalb einer Woche gehen an jemand anderen. Vorgeschlagen wird, wer eine Woche davor und danach frei ist und in diesen Wochen am wenigsten Dienste hat."
      size="m"
      footer={
        changes.length ? (
          <>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
            <button type="button" className="btn btn--primary" onClick={apply} disabled={busy || !selected.length}>
              <Shuffle aria-hidden="true" />{' '}
              {busy ? 'Wird gespeichert…' : `${selected.length === 1 ? '1 Änderung' : `${selected.length} Änderungen`} übernehmen`}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Schließen
          </button>
        )
      }
    >
      {changes.length === 0 ? (
        <p className="alert alert--success">
          <CircleCheck aria-hidden="true" />
          <span>✓ Niemand hat mehrere Dienste innerhalb einer Woche.</span>
        </p>
      ) : (
        <ul role="list" className="dup-groups streak-list">
          {changes.map((c) => (
            <li key={c.assignment.id} className="dup-group">
              <strong>
                {formatDateWithWeekday(c.assignment.date)} · {slotText(type, c.slot)}
              </strong>
              {!c.suggestion && c.candidates.length > 0 && (
                <p className="hint">Niemand hat hier eine Woche Abstand – bitte selbst entscheiden oder so lassen.</p>
              )}
              <div className="dup-group__row">
                <PersonChip name={c.assignment.person} color={c.assignment.color} small struck />
                <ArrowRight aria-hidden="true" className="inline-icon" />
                {c.candidates.length ? (
                  <select
                    className="select streak-select"
                    aria-label={`Ersatz für ${c.assignment.person} am ${formatDateWithWeekday(c.assignment.date)}`}
                    value={choice[c.assignment.id] ?? ''}
                    onChange={(e) => setChoice((prev) => ({ ...prev, [c.assignment.id]: e.target.value }))}
                  >
                    {!c.suggestion && <option value="">– nicht ändern –</option>}
                    {c.candidates.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                        {p === c.suggestion ? ' (Vorschlag)' : c.tight.has(p.name) ? ' – unter 1 Woche Abstand' : ''}
                      </option>
                    ))}
                    {c.suggestion && <option value="">– nicht ändern –</option>}
                  </select>
                ) : (
                  <span className="muted">Niemand ist an den Nachbartagen frei – bitte von Hand lösen.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
