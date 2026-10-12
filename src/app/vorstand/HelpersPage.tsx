import { useState, type SubmitEvent } from 'react';
import { CalendarDays, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useSchedule } from '../data/schedule-data';
import { addPerson, deletePerson, updatePerson } from '../data/repo';
import { Modal } from '../ui/Modal';
import { EmptyState, PageTitle, PersonChip, Spinner, colorVar } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { Link } from '../router';
import { todayISO } from '../../lib/dates';
import {
  PERSON_COLORS,
  SLOTS,
  SLOT_LABEL,
  TYPE_LABEL,
  TYPE_LABEL_SINGULAR,
  isPlaceholder,
  slotRestriction,
  type Person,
  type ScheduleType,
  type Slot,
} from '../../lib/schedule/types';

export function HelpersPage() {
  const schedule = useSchedule();
  const [editing, setEditing] = useState<{ type: ScheduleType; person: Person | null } | null>(null);

  return (
    <>
      <PageTitle
        title="Helfer verwalten"
        description="Wirte und Schießaufsicht mit ihrer Kachelfarbe. Die Farbe erscheint im Kalender und in den PDF-Listen."
      />
      {schedule.loading ? (
        <Spinner />
      ) : (
        <div className="two-col">
          {(['wirte', 'aufsicht'] as const).map((type) => (
            <PersonList key={type} type={type} onEdit={(person) => setEditing({ type, person })} />
          ))}
        </div>
      )}
      <PersonDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function PersonList({ type, onEdit }: { type: ScheduleType; onEdit(person: Person | null): void }) {
  const schedule = useSchedule();
  const confirm = useConfirm();
  const toast = useToast();
  const persons = schedule.persons[type];
  const today = todayISO();

  async function remove(person: Person) {
    const future = schedule.assignments[type].filter((a) => a.person === person.name && a.date >= today).length;
    const ok = await confirm({
      title: 'Helfer löschen?',
      message: (
        <>
          <p>Möchten Sie „{person.name}“ wirklich löschen?</p>
          {future > 0 && (
            <p className="muted">
              {person.name} hat noch {future} zukünftige Einteilung(en). Diese bleiben im Kalender erhalten und können dort
              neu vergeben werden.
            </p>
          )}
        </>
      ),
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deletePerson(type, person.id);
      toast.success(`${person.name} wurde gelöscht.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>{TYPE_LABEL[type]}</h2>
        <div className="panel__tools">
          <Link className="btn btn--sm btn--ghost" to={`/vorstand/kalender${type === 'aufsicht' ? '?typ=aufsicht' : ''}`}>
            <CalendarDays aria-hidden="true" /> Kalender
          </Link>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => onEdit(null)}>
            <Plus aria-hidden="true" /> {TYPE_LABEL_SINGULAR[type]} hinzufügen
          </button>
        </div>
      </header>
      {persons.length === 0 ? (
        <EmptyState icon={<UserRound aria-hidden="true" />} title="Keine Helfer vorhanden" />
      ) : (
        <ul role="list" className="person-list">
          {persons.map((person) => {
            const upcoming = schedule.assignments[type].filter((a) => a.person === person.name && a.date >= today).length;
            const restriction = slotRestriction(type, person);
            return (
              <li key={person.id} className="person-row" style={colorVar(person.color)}>
                <PersonChip name={person.name} color={person.color} />
                <span className="person-row__meta">
                  {upcoming === 1 ? '1 kommender Termin' : `${upcoming} kommende Termine`}
                  {restriction && <span className="badge badge--info">{restriction}</span>}
                </span>
                <div className="person-row__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(person)}>
                    <Pencil aria-hidden="true" /> Bearbeiten
                  </button>
                  <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => remove(person)}>
                    <Trash2 aria-hidden="true" /> Löschen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function splitName(name: string) {
  const [first = '', ...rest] = name.split(' ');
  return { first, last: rest.join(' ') };
}

function PersonDialog({
  editing,
  onClose,
}: {
  editing: { type: ScheduleType; person: Person | null } | null;
  onClose(): void;
}) {
  const schedule = useSchedule();
  const toast = useToast();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([...SLOTS]);
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState<typeof editing>(null);

  if (editing !== openFor) {
    setOpenFor(editing);
    const parts = splitName(editing?.person?.name ?? '');
    setFirst(parts.first);
    setLast(parts.last);
    setColor(editing?.person?.color ?? null);
    setSlots(editing?.person?.slots ?? [...SLOTS]);
  }

  const type = editing?.type ?? 'wirte';
  const person = editing?.person ?? null;
  const usedColors = new Set(schedule.persons[type].filter((p) => p.id !== person?.id).map((p) => p.color));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!color) {
      toast.error('Bitte wählen Sie eine Farbe!');
      return;
    }
    const name = `${first.trim()} ${last.trim()}`.trim();
    if (!name) return;
    if (schedule.persons[type].some((p) => p.name === name && p.id !== person?.id)) {
      toast.error(`„${name}“ gibt es bereits.`);
      return;
    }
    setBusy(true);
    try {
      if (person) {
        await updatePerson(type, person, { name, color, slots }, { assignments: schedule.assignments[type], swaps: schedule.swaps[type] });
        toast.success(`${name} gespeichert.`);
      } else {
        await addPerson(type, name, color, slots);
        toast.success(`${name} hinzugefügt.`);
      }
      onClose();
    } catch (error) {
      toast.error(`Fehler beim Speichern: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const title = `${TYPE_LABEL_SINGULAR[type]} ${person ? 'bearbeiten' : 'hinzufügen'}`;

  return (
    <Modal open={!!editing} onClose={onClose} title={title} size="s">
      <form className="form" onSubmit={submit}>
        <div className="form__row">
          <div className="field">
            <label className="label" htmlFor="p-first">
              Vorname
            </label>
            <input id="p-first" className="input" required value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-last">
              Nachname
            </label>
            <input id="p-last" className="input" required value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>
        <fieldset className="field">
          <legend className="label">Kachelfarbe</legend>
          <div className="color-picker" role="radiogroup">
            {PERSON_COLORS.map((c) => {
              const used = usedColors.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Farbe ${c}${used ? ' (bereits vergeben)' : ''}`}
                  disabled={used}
                  className={`color-option${color === c ? ' is-selected' : ''}`}
                  style={colorVar(c, '--swatch')}
                  onClick={() => setColor(c)}
                />
              );
            })}
          </div>
          <span className="hint">Bereits vergebene Farben sind ausgegraut.</span>
        </fieldset>
        {type === 'wirte' && !isPlaceholder(`${first} ${last}`.trim() || 'x') && (
          <fieldset className="field">
            <legend className="label">Einteilen für</legend>
            <div className="check-group">
              {(['schiessabend', 'fruehschoppen'] as const).map((slot) => {
                const on = slots.includes(slot);
                return (
                  <label key={slot} className="check">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={on && slots.length === 1}
                      onChange={(e) => setSlots((list) => SLOTS.filter((s) => (s === slot ? e.target.checked : list.includes(s))))}
                    />
                    <span>{SLOT_LABEL[slot]}</span>
                  </label>
                );
              })}
            </div>
            <span className="hint">Die Auto-Rotation teilt die Person nur für die angehakten Dienste ein (mindestens einer).</span>
          </fieldset>
        )}
        {person && (
          <p className="hint">Bestehende Einteilungen und offene Tauschanfragen werden auf den neuen Namen bzw. die neue Farbe umgestellt.</p>
        )}
        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !first.trim() || !color}>
            {person ? 'Speichern' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
