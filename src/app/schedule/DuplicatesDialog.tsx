import { useMemo, useState } from 'react';
import { CircleCheck, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PersonChip } from '../ui/misc';
import { errorMessage, useToast } from '../ui/feedback';
import { useSchedule } from '../data/schedule-data';
import { removeAssignments } from '../data/repo';
import { formatDateWithWeekday } from '../../lib/dates';
import { findDuplicates } from '../../lib/schedule/duplicates';
import { slotText } from './useScheduleActions';
import { TYPE_LABEL, type ScheduleType } from '../../lib/schedule/types';

export function DuplicatesDialog({ type, open, onClose }: { type: ScheduleType; open: boolean; onClose(): void }) {
  const schedule = useSchedule();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const groups = useMemo(
    () => (open ? findDuplicates(type, schedule.assignments[type], schedule.dayRules) : []),
    [open, type, schedule.assignments, schedule.dayRules],
  );
  const toDelete = groups.flatMap((g) => g.remove.map((assignment) => ({ assignment, slot: g.slot })));

  async function cleanup() {
    setBusy(true);
    try {
      await removeAssignments(type, toDelete, schedule.swaps[type]);
      toast.success(`✅ Bereinigung abgeschlossen! ${toDelete.length === 1 ? '1 doppelter Eintrag wurde' : `${toDelete.length} doppelte Einträge wurden`} gelöscht.`);
      onClose();
    } catch (error) {
      toast.error(`Fehler beim Bereinigen: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Duplikate bereinigen – ${TYPE_LABEL[type]}`}
      description="Mehrere Einteilungen für denselben Dienst am selben Tag. Die im Kalender angezeigte Einteilung bleibt erhalten."
      size="m"
      footer={
        groups.length ? (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            <button type="button" className="btn btn--danger" onClick={cleanup} disabled={busy}>
              <Sparkles aria-hidden="true" /> {toDelete.length === 1 ? '1 Eintrag' : `${toDelete.length} Einträge`} löschen
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Schließen
          </button>
        )
      }
    >
      {groups.length === 0 ? (
        <p className="alert alert--success">
          <CircleCheck aria-hidden="true" />
          <span>✓ Keine doppelten Einträge gefunden!</span>
        </p>
      ) : (
        <>
          <p>
            Gefunden: <strong>{groups.length === 1 ? '1 Tag' : `${groups.length} Tage`}</strong> mit doppelten Einteilungen, zu löschen:{' '}
            <strong>{toDelete.length === 1 ? '1 Eintrag' : `${toDelete.length} Einträge`}</strong>.
          </p>
          <ul role="list" className="dup-groups">
            {groups.map((g) => (
              <li key={`${g.date}-${g.slot}`} className="dup-group">
                <strong>
                  {formatDateWithWeekday(g.date)} · {slotText(type, g.slot)}
                </strong>
                <div className="dup-group__row">
                  <span className="badge badge--success">bleibt</span>
                  <PersonChip name={g.keep.person} color={g.keep.color} small />
                </div>
                <div className="dup-group__row">
                  <span className="badge badge--danger">wird gelöscht</span>
                  {g.remove.map((r) => (
                    <PersonChip key={r.id} name={r.person} color={r.color} small struck />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
