import { useEffect, useState } from 'react';
import { FileDown, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { errorMessage, useToast } from '../ui/feedback';
import { useSchedule } from '../data/schedule-data';
import { shiftMonth, todayISO } from '../../lib/dates';
import { dateRangeData } from '../../lib/schedule/pdf-data';
import { downloadDateRangePdf } from '../../lib/schedule/pdf';
import { TYPE_LABEL, type ScheduleType } from '../../lib/schedule/types';

export function RangePdfDialog({ type, open, onClose }: { type: ScheduleType; open: boolean; onClose(): void }) {
  const schedule = useSchedule();
  const toast = useToast();
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const current = todayISO().slice(0, 7);
    setStartMonth(current);
    setEndMonth(shiftMonth(current, 3));
  }, [open]);

  async function create() {
    if (!startMonth || !endMonth) {
      toast.error('Bitte wähle Start- und End-Monat aus!');
      return;
    }
    if (startMonth > endMonth) {
      toast.error('Start-Monat muss vor End-Monat liegen!');
      return;
    }
    const data = dateRangeData({
      type,
      startMonth,
      endMonth,
      assignments: schedule.assignments[type],
      notes: schedule.notes[type],
      wirteDays: schedule.wirteDays,
      seasons: schedule.dayRules.seasons,
    });
    if (!data.left.length && !data.right.length) {
      toast.error('Keine Einteilungen im gewählten Zeitraum gefunden!');
      return;
    }
    setBusy(true);
    try {
      await downloadDateRangePdf({ type, startMonth, endMonth, data });
      onClose();
    } catch (error) {
      toast.error(`Fehler beim Erstellen des PDFs: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Zeitraum für PDF wählen"
      description={TYPE_LABEL[type]}
      size="s"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn--primary" onClick={create} disabled={busy}>
            <FileDown aria-hidden="true" /> {busy ? 'Wird erstellt…' : 'PDF erstellen'}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="form__row">
          <div className="field">
            <label className="label" htmlFor="pdf-start">
              Von (Monat/Jahr):
            </label>
            <input id="pdf-start" className="input" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pdf-end">
              Bis (Monat/Jahr):
            </label>
            <input id="pdf-end" className="input" type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </div>
        </div>
        <p className="alert alert--brand">
          <Info aria-hidden="true" />
          <span>
            Es wird eine PDF mit allen Einteilungen im gewählten Zeitraum erstellt.
            {type === 'aufsicht' && ' Bei der Schießaufsicht nur Samstage innerhalb der Saison (Anfangs- bis Endschießen).'}
          </span>
        </p>
      </div>
    </Modal>
  );
}
