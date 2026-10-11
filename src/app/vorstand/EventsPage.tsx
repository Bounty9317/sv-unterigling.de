import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { Ban, CalendarPlus, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { col, toEvent, useLiveCollection } from '../data/collections';
import { createEvent, deleteEvent, updateEvent, type EventInput } from '../data/repo';
import { Modal } from '../ui/Modal';
import { EmptyState, ErrorNotice, PageTitle, Spinner } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { useRouter } from '../router';
import { MONTHS_SHORT, WEEKDAYS_SHORT, formatDate, formatDateLong, parseISODate, todayISO } from '../../lib/dates';
import { pastEvents, upcomingEvents, type VereinsEvent } from '../../lib/events';

const EMPTY: EventInput = {
  title: '',
  date: '',
  time: '',
  description: '',
  registrationRequired: false,
  cancelled: false,
};

export function EventsPage() {
  const events = useLiveCollection(col.events, toEvent);
  const confirm = useConfirm();
  const toast = useToast();
  const { search, navigate, path } = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; values: EventInput } | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(search).get('neu') === '1') {
      setEditing({ id: null, values: { ...EMPTY } });
      navigate(path, { replace: true });
    }
  }, [search, navigate, path]);

  const today = todayISO();
  const upcoming = useMemo(() => upcomingEvents(events.data, today), [events.data, today]);
  const past = useMemo(() => pastEvents(events.data, today), [events.data, today]);

  async function remove(event: VereinsEvent) {
    const ok = await confirm({
      title: 'Veranstaltung löschen?',
      message: `Möchten Sie „${event.title}“ am ${formatDate(event.date)} wirklich löschen?`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEvent(event.id);
      toast.success('Veranstaltung gelöscht.');
    } catch (error) {
      toast.error(`Fehler beim Löschen der Veranstaltung: ${errorMessage(error)}`);
    }
  }

  async function toggleCancelled(event: VereinsEvent) {
    try {
      await updateEvent(event.id, toInput(event, { cancelled: !event.cancelled }));
      toast.success(event.cancelled ? 'Veranstaltung findet wieder statt.' : 'Veranstaltung als abgesagt markiert.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const renderList = (list: VereinsEvent[]) => (
    <ul role="list" className="admin-events">
      {list.map((event) => {
        const d = parseISODate(event.date);
        return (
          <li key={event.id} className={`admin-event${event.cancelled ? ' is-cancelled' : ''}`}>
            <div className="admin-event__date" aria-hidden="true">
              <span className="admin-event__day">{d.getDate()}</span>
              <span className="admin-event__month">{MONTHS_SHORT[d.getMonth()]}</span>
              <span className="admin-event__weekday">{WEEKDAYS_SHORT[d.getDay()]}</span>
            </div>
            <div className="admin-event__body">
              <div className="admin-event__meta">
                {event.cancelled && <span className="badge badge--danger">❌ ABGESAGT</span>}
                {event.registrationRequired && <span className="badge badge--warning">⚠️ Anmeldung erforderlich</span>}
                <span className="muted">
                  {formatDateLong(event.date)}
                  {event.time ? ` · ${event.time} Uhr` : ''}
                </span>
              </div>
              <h3>{event.title}</h3>
              {event.description && <p className="admin-event__desc">{event.description}</p>}
            </div>
            <div className="admin-event__actions">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setEditing({ id: event.id, values: toInput(event) })}
              >
                <Pencil aria-hidden="true" /> Bearbeiten
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleCancelled(event)}>
                {event.cancelled ? <RotateCcw aria-hidden="true" /> : <Ban aria-hidden="true" />}
                {event.cancelled ? 'Findet statt' : 'Absagen'}
              </button>
              <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => remove(event)}>
                <Trash2 aria-hidden="true" /> Löschen
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <PageTitle
        title="Veranstaltungen verwalten"
        description="Termine erscheinen sofort auf der Startseite und unter „Veranstaltungen“."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing({ id: null, values: { ...EMPTY } })}>
            <Plus aria-hidden="true" /> Neue Veranstaltung erstellen
          </button>
        }
      />

      {events.loading ? (
        <Spinner label="Lade Veranstaltungen…" />
      ) : events.error ? (
        <ErrorNotice>Fehler beim Laden der Veranstaltungen. {errorMessage(events.error)}</ErrorNotice>
      ) : (
        <>
          <section className="section-block">
            <h2>Kommende Veranstaltungen ({upcoming.length})</h2>
            {upcoming.length ? (
              renderList(upcoming)
            ) : (
              <EmptyState icon={<CalendarPlus aria-hidden="true" />} title="Noch keine kommenden Veranstaltungen vorhanden." />
            )}
          </section>
          <section className="section-block">
            <button type="button" className="btn btn--ghost" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
              {showPast ? 'Vergangene ausblenden' : `Vergangene Veranstaltungen anzeigen (${past.length})`}
            </button>
            {showPast && past.length > 0 && renderList(past)}
          </section>
        </>
      )}

      <EventDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(created) => {
          setEditing(null);
          toast.success(created ? 'Veranstaltung erfolgreich erstellt!' : 'Veranstaltung erfolgreich aktualisiert!');
        }}
      />
    </>
  );
}

function toInput(event: VereinsEvent, override: Partial<EventInput> = {}): EventInput {
  return {
    title: event.title,
    date: event.date,
    time: event.time ?? '',
    description: event.description ?? '',
    registrationRequired: !!event.registrationRequired,
    cancelled: !!event.cancelled,
    ...override,
  };
}

function EventDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: { id: string | null; values: EventInput } | null;
  onClose(): void;
  onSaved(created: boolean): void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<EventInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) setValues(editing.values);
  }, [editing]);

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setValues((v) => ({ ...v, [key]: value }));
  const isEdit = !!editing?.id;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!values.title.trim() || !values.date) return;
    setBusy(true);
    const data: EventInput = { ...values, title: values.title.trim(), description: values.description.trim() };
    try {
      if (isEdit) await updateEvent(editing!.id!, data);
      else await createEvent(data);
      onSaved(!isEdit);
    } catch (error) {
      toast.error(`Fehler beim Speichern der Veranstaltung: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={isEdit ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung erstellen'}
      size="m"
    >
      <form className="form" onSubmit={submit} id="event-form">
        <div className="field">
          <label className="label" htmlFor="ev-title">
            Titel *
          </label>
          <input
            id="ev-title"
            className="input"
            required
            maxLength={200}
            placeholder="z.B. Weihnachtsschießen"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            autoFocus
          />
        </div>
        <div className="form__row">
          <div className="field">
            <label className="label" htmlFor="ev-date">
              Datum *
            </label>
            <input id="ev-date" className="input" type="date" required value={values.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="ev-time">
              Uhrzeit
            </label>
            <input id="ev-time" className="input" type="time" value={values.time} onChange={(e) => set('time', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="ev-desc">
            Beschreibung
          </label>
          <textarea
            id="ev-desc"
            className="textarea"
            maxLength={2000}
            placeholder="Beschreibung der Veranstaltung..."
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={values.registrationRequired}
            onChange={(e) => set('registrationRequired', e.target.checked)}
          />
          <span>Anmeldung erforderlich</span>
        </label>
        <label className="check check--danger">
          <input type="checkbox" checked={values.cancelled} onChange={(e) => set('cancelled', e.target.checked)} />
          <span>⚠️ Veranstaltung abgesagt</span>
        </label>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !values.title.trim() || !values.date}>
            {busy ? (isEdit ? 'Wird gespeichert...' : 'Wird erstellt...') : isEdit ? 'Änderungen speichern' : 'Veranstaltung erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
