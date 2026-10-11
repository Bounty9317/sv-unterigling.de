import { useMemo, useState, type SubmitEvent } from 'react';
import { CalendarDays, CalendarPlus, Info, PartyPopper, Trash2, Wand2 } from 'lucide-react';
import { useSchedule } from '../data/schedule-data';
import { addWirteDays, deleteWirteDay } from '../data/repo';
import { Modal } from '../ui/Modal';
import { EmptyState, PageTitle, Spinner } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { Link } from '../router';
import { formatDateLong, todayISO } from '../../lib/dates';
import { bavarianHolidays } from '../../lib/schedule/holidays';
import type { WirteDay } from '../../lib/schedule/types';

export function WirteDaysPage() {
  const schedule = useSchedule();
  const confirm = useConfirm();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('holiday');
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const today = todayISO();
  const days = schedule.wirteDays;
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.filter((d) => d.date < today).reverse();

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!date) {
      toast.error('Bitte wähle ein Datum aus!');
      return;
    }
    if (days.some((d) => d.date === date)) {
      toast.error('Für dieses Datum ist bereits ein Wirte-Tag eingetragen.');
      return;
    }
    setBusy(true);
    try {
      await addWirteDays([{ date, description: description.trim(), type }]);
      setDate('');
      setDescription('');
      setType('holiday');
      toast.success('Tag erfolgreich hinzugefügt!');
    } catch (error) {
      toast.error(`Fehler beim Hinzufügen des Tags: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(day: WirteDay) {
    const ok = await confirm({
      title: 'Wirte-Tag entfernen?',
      message: `Möchtest du ${formatDateLong(day.date)}${day.description ? ` (${day.description})` : ''} wirklich entfernen?`,
      confirmLabel: 'Entfernen',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteWirteDay(day.id);
      toast.success('Tag erfolgreich entfernt!');
    } catch (error) {
      toast.error(`Fehler beim Löschen des Tags: ${errorMessage(error)}`);
    }
  }

  const renderDays = (list: WirteDay[]) => (
    <ul role="list" className="day-cards">
      {list.map((day) => (
        <li key={day.id} className="day-card">
          <div className="day-card__info">
            <strong>{formatDateLong(day.date)}</strong>
            {day.description && <span>{day.description}</span>}
            <span className={`badge ${day.type === 'holiday' ? 'badge--accent' : 'badge--info'}`}>
              {day.type === 'holiday' ? '🎉 Feiertag' : '🎪 Veranstaltung'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn--danger-ghost btn--icon btn--sm"
            onClick={() => remove(day)}
            aria-label={`${formatDateLong(day.date)} entfernen`}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageTitle
        title="Wirte-Tage verwalten"
        description="Lege fest, an welchen Tagen ein Wirt gebraucht wird"
        actions={
          <Link className="btn" to="/vorstand/kalender">
            <CalendarDays aria-hidden="true" /> Zum Kalender
          </Link>
        }
      />

      <div className="alert alert--brand app-notice">
        <Info aria-hidden="true" />
        <span>
          <strong>Hinweis:</strong> Standardmäßig werden Wirte sonntags (Frühschoppen) und samstags von Oktober bis März
          (Schießabend) benötigt. Hier kannst du zusätzliche Tage (z.B. Feiertage, besondere Veranstaltungen) hinzufügen oder
          entfernen. An diesen Tagen gibt es einen Frühschoppen-Dienst – fällt der Tag auf einen Samstag von Oktober bis März,
          zusätzlich den Schießabend.
        </span>
      </div>

      <div className="two-col two-col--narrow-first">
        <section className="panel">
          <header className="panel__header">
            <h2>Neuen Wirte-Tag hinzufügen</h2>
          </header>
          <form className="form" onSubmit={add}>
            <div className="field">
              <label className="label" htmlFor="wd-date">
                Datum
              </label>
              <input id="wd-date" className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="wd-desc">
                Beschreibung (optional)
              </label>
              <input
                id="wd-desc"
                className="input"
                placeholder="z.B. Neujahr, Vereinsfest, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="wd-type">
                Typ
              </label>
              <select id="wd-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="holiday">Feiertag</option>
                <option value="custom">Besondere Veranstaltung</option>
              </select>
            </div>
            <div className="form__actions">
              <button type="button" className="btn" onClick={() => setImportOpen(true)}>
                <Wand2 aria-hidden="true" /> Feiertage eintragen…
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy || !date}>
                <CalendarPlus aria-hidden="true" /> Tag hinzufügen
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Zusätzliche Wirte-Tage</h2>
          </header>
          {schedule.loading ? (
            <Spinner label="Lade Daten..." />
          ) : upcoming.length === 0 ? (
            <EmptyState icon={<PartyPopper aria-hidden="true" />} title="Noch keine zusätzlichen Tage hinzugefügt" />
          ) : (
            renderDays(upcoming)
          )}
          {past.length > 0 && (
            <div className="panel__more">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
                {showPast ? 'Vergangene ausblenden' : `Vergangene anzeigen (${past.length})`}
              </button>
              {showPast && renderDays(past)}
            </div>
          )}
        </section>
      </div>

      <HolidayImport open={importOpen} onClose={() => setImportOpen(false)} existing={days} />
    </>
  );
}

function HolidayImport({ open, onClose, existing }: { open: boolean; onClose(): void; existing: WirteDay[] }) {
  const toast = useToast();
  const now = new Date();
  const thisYear = now.getFullYear();
  // Ab Oktober wird meist schon für das nächste Jahr geplant
  const [year, setYear] = useState(now.getMonth() >= 9 ? thisYear + 1 : thisYear);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const existingDates = useMemo(() => new Set(existing.map((d) => d.date)), [existing]);
  const holidays = useMemo(() => bavarianHolidays(year), [year]);
  const candidates = holidays.filter((h) => !existingDates.has(h.date) && h.date >= today);
  const selected = candidates.filter((h) => !excluded.has(h.date));

  async function save() {
    setBusy(true);
    try {
      await addWirteDays(selected.map((h) => ({ date: h.date, description: h.name, type: 'holiday' })));
      toast.success(`${selected.length} Feiertag(e) eingetragen.`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Feiertage eintragen"
      description="Gesetzliche Feiertage in Bayern. Bereits eingetragene Tage werden übersprungen."
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={busy || selected.length === 0}>
            {selected.length} Tag(e) eintragen
          </button>
        </>
      }
    >
      <div className="form">
        <div className="field">
          <label className="label" htmlFor="hol-year">
            Jahr
          </label>
          <select id="hol-year" className="select" value={year} onChange={(e) => { setYear(Number(e.target.value)); setExcluded(new Set()); }}>
            {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <ul role="list" className="check-list">
          {holidays.map((h) => {
            const already = existingDates.has(h.date);
            const past = h.date < today;
            return (
              <li key={h.date}>
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={already || past}
                    checked={!already && !past && !excluded.has(h.date)}
                    onChange={(e) =>
                      setExcluded((set) => {
                        const next = new Set(set);
                        if (e.target.checked) next.delete(h.date);
                        else next.add(h.date);
                        return next;
                      })
                    }
                  />
                  <span>
                    <strong>{h.name}</strong> · {formatDateLong(h.date)}
                    {already && <span className="muted"> (bereits eingetragen)</span>}
                    {!already && past && <span className="muted"> (vergangen)</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
