import { useMemo, useState } from 'react';
import { ArrowLeftRight, Repeat2, Save, Trash2, UserPlus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PersonChip, colorVar } from '../ui/misc';
import { useSchedule } from '../data/schedule-data';
import { slotText, useScheduleActions } from './useScheduleActions';
import { formatDateLong } from '../../lib/dates';
import { buildDay, indexAssignments, type SlotCell } from '../../lib/schedule/model';
import { swapTarget } from '../../lib/schedule/slots';
import { canTake, slotRestriction, slotTime, type Person, type ScheduleType, type Slot } from '../../lib/schedule/types';

interface Props {
  type: ScheduleType;
  date: string | null;
  mode: 'admin' | 'helper';
  onClose(): void;
}

export function DayDialog({ type, date, mode, onClose }: Props) {
  const schedule = useSchedule();
  const day = useMemo(() => {
    if (!date) return null;
    const index = indexAssignments(type, schedule.assignments[type], schedule.dayRules);
    return buildDay(
      type,
      date,
      index,
      new Map(schedule.notes[type].map((n) => [n.date, n])),
      new Map(schedule.wirteDays.map((d) => [d.date, d])),
      schedule.dayRules,
    );
  }, [date, type, schedule]);

  return (
    <Modal
      open={!!date}
      onClose={onClose}
      title={date ? formatDateLong(date) : ''}
      description={
        day?.customDay ? `🎉 ${day.customDay.description || 'Feiertag/Sondertag'}` : day && !day.allowed ? 'An diesem Tag ist kein Dienst vorgesehen.' : undefined
      }
      size="m"
    >
      {day && (
        <div className="day-dialog">
          {day.slots.length === 0 && (
            <p className="muted">
              {type === 'aufsicht'
                ? 'Schießaufsicht nur an Schießabenden: Samstage zwischen Anfangs- und Endschießen sowie am 26.12.'
                : 'Wirte an Sonntagen, eingetragenen Wirte-Tagen und Schießabenden (Samstage zwischen Anfangs- und Endschießen sowie 26.12.). Ein Feiertag an einem Samstag außerhalb der Saison hat nur Frühschoppen.'}
            </p>
          )}
          {day.slots.map((cell) => (
            <SlotSection key={cell.slot} type={type} date={day.date} cell={cell} mode={mode} />
          ))}
          <NoteSection type={type} date={day.date} mode={mode} allowed={day.allowed} />
        </div>
      )}
    </Modal>
  );
}

function PersonPicker({
  type,
  slot,
  persons,
  exclude,
  onPick,
  disabled,
}: {
  type: ScheduleType;
  slot: Slot;
  persons: Person[];
  exclude?: string;
  onPick(person: Person): void;
  disabled?: boolean;
}) {
  // Wer den Dienst sonst nicht übernimmt (z. B. „nur Frühschoppen“), bleibt wählbar, steht aber hinten und ist markiert
  const list = persons
    .filter((p) => p.name !== exclude)
    .sort((a, b) => Number(canTake(type, b, slot)) - Number(canTake(type, a, slot)));
  if (!list.length) return <p className="muted">Keine weiteren Personen vorhanden – bitte unter „Helfer“ anlegen.</p>;
  return (
    <div className="person-picker">
      {list.map((person) => (
        <button
          key={person.id}
          type="button"
          className="person-picker__item"
          style={colorVar(person.color)}
          onClick={() => onPick(person)}
          disabled={disabled}
        >
          {person.name}
          {!canTake(type, person, slot) && <small className="person-picker__note"> ({slotRestriction(type, person)})</small>}
        </button>
      ))}
    </div>
  );
}

function SlotSection({ type, date, cell, mode }: { type: ScheduleType; date: string; cell: SlotCell; mode: 'admin' | 'helper' }) {
  const schedule = useSchedule();
  const actions = useScheduleActions(type);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const assignment = cell.assignment;

  const pendingSwap = assignment
    ? schedule.swaps[type].find(
        (s) =>
          s.status === 'pending' &&
          (s.assignmentId ? s.assignmentId === assignment.id : swapTarget(s).date === date && s.requestPerson === assignment.person),
      )
    : undefined;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setPicking(false);
    }
  };

  return (
    <section className={`slot-section${cell.expected ? '' : ' slot-section--extra'}`}>
      <header className="slot-section__header">
        <h3>{slotText(type, cell.slot)}</h3>
        <span className="muted">{slotTime(type, cell.slot)} Uhr</span>
        {!cell.expected && <span className="badge badge--warning">nicht vorgesehen</span>}
      </header>

      <div className="slot-section__current">
        {assignment ? (
          <>
            <PersonChip name={assignment.person} color={assignment.color} />
            {assignment.swappedWith && assignment.originalPerson && (
              <span className="muted slot-section__swap">
                <ArrowLeftRight aria-hidden="true" className="inline-icon" /> übernimmt für {assignment.originalPerson}
              </span>
            )}
          </>
        ) : (
          <span className="badge badge--danger">Nicht eingeteilt</span>
        )}
      </div>

      {pendingSwap && (
        <div className="alert alert--warning slot-section__pending">
          <Repeat2 aria-hidden="true" />
          <div>
            <p>
              <strong>{pendingSwap.requestPerson}</strong> sucht Ersatz
              {pendingSwap.replacementPerson ? <> – angefragt: <strong>{pendingSwap.replacementPerson}</strong></> : ' – warte auf Zusage...'}
            </p>
            <div className="slot-section__actions">
              {pendingSwap.replacementPerson && (
                <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => run(() => actions.accept(pendingSwap))}>
                  {pendingSwap.replacementPerson} übernimmt
                </button>
              )}
              <button type="button" className="btn btn--sm" disabled={busy} onClick={() => run(() => actions.dismissSwap(pendingSwap))}>
                Anfrage zurückziehen
              </button>
            </div>
          </div>
        </div>
      )}

      {cell.duplicates.length > 0 && (
        <div className="alert alert--warning">
          <div>
            <p>
              <strong>Doppelt eingeteilt:</strong> Für diesen Dienst gibt es weitere Einträge.
            </p>
            <ul role="list" className="dup-list">
              {cell.duplicates.map((dup) => (
                <li key={dup.id}>
                  <PersonChip name={dup.person} color={dup.color} small />
                  {mode === 'admin' && (
                    <button type="button" className="btn btn--danger-ghost btn--sm" disabled={busy} onClick={() => run(() => actions.remove(dup))}>
                      <Trash2 aria-hidden="true" /> Entfernen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mode === 'admin' && (
        <div className="slot-section__actions">
          <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            {picking ? <X aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {picking ? 'Abbrechen' : assignment ? 'Ersetzen' : 'Einteilen'}
          </button>
          {assignment && (
            <button type="button" className="btn btn--danger-ghost btn--sm" disabled={busy} onClick={() => run(() => actions.remove(assignment))}>
              <Trash2 aria-hidden="true" /> Einteilung löschen
            </button>
          )}
        </div>
      )}

      {mode === 'helper' && assignment && !pendingSwap && (
        <div className="slot-section__actions">
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            {picking ? <X aria-hidden="true" /> : <Repeat2 aria-hidden="true" />}
            {picking ? 'Abbrechen' : 'Tausch anfragen'}
          </button>
        </div>
      )}

      {picking && (
        <div className="slot-section__picker">
          <p className="hint">
            {mode === 'admin' ? 'Person auswählen:' : `Du bist eingeteilt: ${assignment?.person}. Wähle einen Ersatz-Helfer:`}
          </p>
          <PersonPicker
            type={type}
            slot={cell.slot}
            persons={schedule.persons[type]}
            exclude={mode === 'helper' ? assignment?.person : undefined}
            disabled={busy}
            onPick={(person) =>
              run(() => (mode === 'admin' ? actions.assign(date, cell.slot, person) : actions.requestSwap(assignment!, person)))
            }
          />
        </div>
      )}
    </section>
  );
}

function NoteSection({ type, date, mode, allowed }: { type: ScheduleType; date: string; mode: 'admin' | 'helper'; allowed: boolean }) {
  const schedule = useSchedule();
  const actions = useScheduleActions(type);
  const existing = schedule.notes[type].find((n) => n.date === date);
  const [text, setText] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);

  if (mode === 'helper') {
    return existing?.note ? (
      <section className="slot-section">
        <h3>Info</h3>
        <p>{existing.note}</p>
      </section>
    ) : null;
  }
  if (!allowed && !existing) return null;

  const changed = text.trim() !== (existing?.note ?? '');
  return (
    <section className="slot-section">
      <label className="label" htmlFor={`note-${date}`}>
        Info für diesen Tag
      </label>
      <textarea
        id={`note-${date}`}
        className="textarea textarea--small"
        maxLength={120}
        placeholder={type === 'aufsicht' ? 'z.B. „Anfangsschießen“ oder „Endschießen“' : 'z.B. „Anfangsschießen“'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="hint">
        Erscheint im Kalender und als Bemerkung in den PDF-Listen.
        {type === 'aufsicht' && ' „Anfangsschießen“ und „Endschießen“ legen die Saison für die PDF-Listen fest.'} Leer lassen zum
        Löschen.
      </p>
      <div className="slot-section__actions">
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={busy || !changed}
          onClick={async () => {
            setBusy(true);
            await actions.note(date, text, existing);
            setBusy(false);
          }}
        >
          <Save aria-hidden="true" /> Info speichern
        </button>
      </div>
    </section>
  );
}
