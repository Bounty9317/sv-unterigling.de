import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { colorVar } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { useSchedule } from '../data/schedule-data';
import { applyRotation } from '../data/repo';
import { formatDate, formatDateWithWeekday, todayISO } from '../../lib/dates';
import { lastBeforeStart, planRotation, rotationEntries, type RotationDayOptions } from '../../lib/schedule/rotation';
import { effectiveSlot } from '../../lib/schedule/slots';
import {
  SLOTS,
  SLOT_LABEL,
  TYPE_LABEL,
  byRotationOrder,
  isPlaceholder,
  type Person,
  type ScheduleType,
  type Slot,
} from '../../lib/schedule/types';

interface Row {
  person: Person;
  included: boolean;
  /** Wirte: Dienste, für die die Person eingeteilt werden kann */
  slots: Slot[];
}

export function RotationDialog({ type, open, onClose }: { type: ScheduleType; open: boolean; onClose(): void }) {
  const schedule = useSchedule();
  const confirm = useConfirm();
  const toast = useToast();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [options, setOptions] = useState<RotationDayOptions>({ includeSaturdays: true, includeSundays: true, includeHolidays: true });
  const [rows, setRows] = useState<Row[]>([]);
  const [startWith, setStartWith] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = todayISO();
    setStart(today);
    setEnd(`${new Date().getFullYear() + 1}-12-31`);
    setOptions(
      type === 'aufsicht'
        ? { includeSaturdays: true, includeSundays: false, includeHolidays: true }
        : { includeSaturdays: true, includeSundays: true, includeHolidays: true },
    );
    setRows(
      [...schedule.persons[type]].sort(byRotationOrder).map((person) => ({
        person,
        included: !isPlaceholder(person.name),
        slots: person.slots ?? [...SLOTS],
      })),
    );
    setStartWith(null);
    // nur beim Öffnen initialisieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const entries = useMemo(
    () => (start && end && start <= end ? rotationEntries(type, start, end, options, schedule.dayRules) : []),
    [type, start, end, options, schedule.dayRules],
  );
  const activeRows = rows.filter((r) => r.included && !isPlaceholder(r.person.name));
  // Die Rotation beginnt mit der gewählten Person und läuft dann in der Reihenfolge der Liste weiter
  const firstIndex = Math.max(0, activeRows.findIndex((r) => r.person.id === startWith));
  const ordered = [...activeRows.slice(firstIndex), ...activeRows.slice(0, firstIndex)];
  const active = ordered.map((r) => (type === 'wirte' ? { ...r.person, slots: r.slots } : r.person));
  const previous = start ? lastBeforeStart(schedule.assignments[type], activeRows.map((r) => r.person), start) : null;
  const nextAfterPrevious = (() => {
    if (!previous) return null;
    const i = activeRows.findIndex((r) => r.person.name === previous.person);
    return i < 0 ? null : activeRows[(i + 1) % activeRows.length]!.person;
  })();

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    setRows((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  }

  function toggleSlot(index: number, slot: Slot, on: boolean) {
    setRows((list) =>
      list.map((r, i) => (i === index ? { ...r, slots: SLOTS.filter((s) => (s === slot ? on : r.slots.includes(s))) } : r)),
    );
  }

  async function start_() {
    if (!start || !end || start > end) {
      toast.error('Bitte gültige Start- und End-Daten eingeben!');
      return;
    }
    if (!active.length) {
      toast.error('Bitte mindestens eine Person aktivieren!');
      return;
    }
    if (!entries.length) {
      toast.error('Keine passenden Tage im ausgewählten Zeitraum gefunden!');
      return;
    }
    const plan = planRotation({
      type,
      entries,
      persons: active,
      existing: schedule.assignments[type],
      otherType: schedule.assignments[type === 'wirte' ? 'aufsicht' : 'wirte'],
      rules: schedule.dayRules,
    });
    const dayTypes = [
      options.includeSaturdays && (type === 'wirte' ? 'Schießabende' : 'Samstage'),
      options.includeSundays && type === 'wirte' && 'Sonntage',
      options.includeHolidays && (type === 'wirte' ? 'Feiertage/Sondertage' : '26.12.'),
    ]
      .filter(Boolean)
      .join(', ');
    const ok = await confirm({
      title: 'Rotation starten?',
      message: (
        <div className="stack">
          <p>
            Rotation von {formatDate(start)} bis {formatDate(end)} starten?
          </p>
          <ul>
            <li>Tage: {dayTypes}</li>
            <li>Anzahl Tage: {plan.uniqueDays}</li>
            <li>Anzahl Einteilungen: {plan.creates.length}</li>
            <li>
              Reihenfolge: {active.map((p, i) => `${i + 1}. ${p.name}`).join(', ')} – danach wieder von vorne
            </li>
          </ul>
          {plan.skipped.length > 0 && (
            <p>
              Unverändert bleiben (Platzhalter wie „Kein Schießen“):{' '}
              {plan.skipped.map((e) => formatDate(e.date)).join(', ')}
            </p>
          )}
          {plan.unfillable.length > 0 && (
            <p>
              Niemand der Ausgewählten kann diese Dienste übernehmen, sie bleiben unverändert:{' '}
              {plan.unfillable.map((e) => `${formatDate(e.date)} (${SLOT_LABEL[e.slot]})`).join(', ')}
            </p>
          )}
          <p>
            <strong>{plan.deleteIds.length} bestehende Einteilung(en) an diesen Terminen werden überschrieben!</strong>
          </p>
        </div>
      ),
      confirmLabel: 'Rotation starten',
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Reihenfolge und Dienstauswahl merken, damit die nächste Rotation genauso weiterläuft
      await applyRotation(
        type,
        plan,
        rows.map((r, index) => ({ person: r.person, rotationOrder: index, slots: type === 'wirte' ? r.slots : undefined })),
      );
      toast.success(`✓ Rotation abgeschlossen! ${plan.uniqueDays === 1 ? '1 Tag' : `${plan.uniqueDays} Tage`} mit ${plan.creates.length === 1 ? '1 Einteilung' : `${plan.creates.length} Einteilungen`} – reihum in der festgelegten Reihenfolge.`);
      onClose();
    } catch (error) {
      toast.error(`Fehler bei der Rotation: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Automatische Rotation – ${TYPE_LABEL[type]}`}
      description="Verteilt die Dienste reihum in der festgelegten Reihenfolge: Nr. 1, Nr. 2, … und dann wieder von vorne."
      size="m"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            ✗ Abbrechen
          </button>
          <button type="button" className="btn btn--primary" onClick={start_} disabled={busy}>
            <RefreshCw aria-hidden="true" /> {busy ? 'Wird verteilt…' : `Rotation starten (${entries.length === 1 ? '1 Dienst' : `${entries.length} Dienste`})`}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="form__row">
          <div className="field">
            <label className="label" htmlFor="rot-start">
              Start-Datum:
            </label>
            <input id="rot-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="rot-end">
              End-Datum:
            </label>
            <input id="rot-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <fieldset className="field">
          <legend className="label">Tage einbeziehen:</legend>
          <div className="check-group">
            <label className="check">
              <input
                type="checkbox"
                checked={options.includeSaturdays}
                onChange={(e) => setOptions((o) => ({ ...o, includeSaturdays: e.target.checked }))}
              />
              <span>{type === 'wirte' ? 'Schießabende (Samstage und 26.12.)' : 'Samstage'}</span>
            </label>
            {type === 'wirte' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={options.includeSundays}
                  onChange={(e) => setOptions((o) => ({ ...o, includeSundays: e.target.checked }))}
                />
                <span>Sonntage (Frühschoppen)</span>
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={options.includeHolidays}
                onChange={(e) => setOptions((o) => ({ ...o, includeHolidays: e.target.checked }))}
              />
              <span>{type === 'wirte' ? 'Feiertage/Sondertage (Frühschoppen)' : '26.12. (Weihnachtsschießen)'}</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="label">Rotations-Reihenfolge:</legend>
          <p className="hint">
            Ziehe die Personen in die gewünschte Reihenfolge (oder nutze die Pfeile). Deaktiviere Personen, die nicht
            eingeteilt werden sollen.
            {type === 'wirte' &&
              ' Bei jedem Wirt legst du fest, ob er Schießabende und/oder Frühschoppen übernimmt. Wer einen Dienst nicht macht, wird dort übersprungen und kommt beim nächsten passenden Dienst als Erster dran.'}{' '}
            Reihenfolge und Auswahl werden beim Start gespeichert.
          </p>
          <ol className="rotation-list">
            {rows.map((row, index) => (
              <li
                key={row.person.id}
                className={`rotation-item${dragIndex === index ? ' is-dragging' : ''}${row.included ? '' : ' is-off'}`}
                style={colorVar(row.person.color)}
                draggable
                onDragStart={onDragStart(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (!Number.isNaN(from)) move(from, index);
                  setDragIndex(null);
                }}
              >
                <label className="rotation-item__check">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) =>
                      setRows((list) => list.map((r, i) => (i === index ? { ...r, included: e.target.checked } : r)))
                    }
                  />
                  <span>
                    {index + 1}. {row.person.name}
                  </span>
                </label>
                {type === 'wirte' && !isPlaceholder(row.person.name) && (
                  <span className="rotation-item__slots" role="group" aria-label={`Dienste von ${row.person.name}`}>
                    {(['schiessabend', 'fruehschoppen'] as const).map((slot) => {
                      const on = row.slots.includes(slot);
                      return (
                        <label key={slot} className={`slot-toggle${on ? ' is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            // mindestens einen Dienst behalten
                            disabled={on && row.slots.length === 1}
                            onChange={(e) => toggleSlot(index, slot, e.target.checked)}
                          />
                          <span>{SLOT_LABEL[slot]}</span>
                        </label>
                      );
                    })}
                  </span>
                )}
                <span className="rotation-item__tools">
                  <button type="button" className="icon-btn" onClick={() => move(index, index - 1)} aria-label="Nach oben" disabled={index === 0}>
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(index, index + 1)}
                    aria-label="Nach unten"
                    disabled={index === rows.length - 1}
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <GripVertical aria-hidden="true" className="rotation-item__grip" />
                </span>
              </li>
            ))}
          </ol>
        </fieldset>

        {activeRows.length > 1 && (
          <div className="field">
            <label className="label" htmlFor="rot-first">
              Beginnen mit:
            </label>
            <select
              id="rot-first"
              className="input"
              value={ordered[0]?.person.id ?? ''}
              onChange={(e) => setStartWith(e.target.value)}
            >
              {activeRows.map((r) => (
                <option key={r.person.id} value={r.person.id}>
                  {r.person.name}
                </option>
              ))}
            </select>
            {previous && (
              <span className="hint">
                Zuletzt vor dem Start: {previous.person} am {formatDateWithWeekday(previous.date)}
                {type === 'wirte' && ` (${SLOT_LABEL[effectiveSlot(type, previous, schedule.dayRules)]})`}
                {nextAfterPrevious && nextAfterPrevious.id !== ordered[0]?.person.id && (
                  <>
                    {' – '}
                    <button type="button" className="link-btn" onClick={() => setStartWith(nextAfterPrevious.id)}>
                      mit {nextAfterPrevious.name} weitermachen
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
