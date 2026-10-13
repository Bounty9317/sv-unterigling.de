import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileDown,
  LayoutGrid,
  List,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useSchedule } from '../data/schedule-data';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/misc';
import { useToast } from '../ui/feedback';
import { Link } from '../router';
import { DayList, MonthGrid, type DragPayload } from './CalendarGrid';
import { DayDialog } from './DayDialog';
import { ConflictsPanel, MyDutiesPanel, PersonPanel, SwapPanel, useMyPerson } from './SidePanels';
import { RotationDialog } from './RotationDialog';
import { RangePdfDialog } from './RangePdfDialog';
import { DuplicatesDialog } from './DuplicatesDialog';
import { StreaksDialog, StreaksPanel } from './StreaksDialog';
import { useScheduleActions } from './useScheduleActions';
import { formatMonth, shiftMonth, todayISO } from '../../lib/dates';
import { buildMonth } from '../../lib/schedule/model';
import { findConflicts } from '../../lib/schedule/conflicts';
import { expectedSlots, swapTarget } from '../../lib/schedule/slots';
import { SLOT_LABEL, TYPE_LABEL, slotTime, type ScheduleType, type Slot } from '../../lib/schedule/types';

type ViewMode = 'grid' | 'list';

function useIsSmall() {
  const query = '(max-width: 760px)';
  const [small, setSmall] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setSmall(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return small;
}

export function ScheduleView({ type, mode }: { type: ScheduleType; mode: 'admin' | 'helper' }) {
  const schedule = useSchedule();
  const actions = useScheduleActions(type);
  const toast = useToast();
  const isSmall = useIsSmall();
  const editable = mode === 'admin' && !isSmall;

  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [view, setView] = useState<ViewMode | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [slotPick, setSlotPick] = useState<{ payload: DragPayload; date: string; slots: Slot[] } | null>(null);
  const [dialog, setDialog] = useState<'rotation' | 'pdf' | 'duplicates' | 'streaks' | null>(null);
  const [me, setMe] = useMyPerson(type);

  const effectiveView: ViewMode = view ?? (isSmall ? 'list' : 'grid');

  const days = useMemo(
    () =>
      buildMonth(type, month, {
        assignments: schedule.assignments[type],
        notes: schedule.notes[type],
        wirteDays: schedule.wirteDays,
        seasons: schedule.dayRules.seasons,
      }),
    [type, month, schedule.assignments, schedule.notes, schedule.wirteDays, schedule.dayRules],
  );

  const conflictKeys = useMemo(
    () =>
      new Set(
        findConflicts(schedule.assignments.wirte, schedule.assignments.aufsicht, schedule.dayRules).map(
          (c) => `${c.date}|${c.person}`,
        ),
      ),
    [schedule.assignments, schedule.dayRules],
  );

  const pendingSwapIds = useMemo(() => {
    const ids = new Set<string>();
    for (const swap of schedule.swaps[type]) {
      if (swap.status !== 'pending') continue;
      if (swap.assignmentId) ids.add(swap.assignmentId);
      else {
        const target = swapTarget(swap);
        schedule.assignments[type]
          .filter((a) => a.date === target.date && a.person === swap.requestPerson)
          .forEach((a) => ids.add(a.id));
      }
    }
    return ids;
  }, [schedule.swaps, schedule.assignments, type]);

  const stats = useMemo(() => {
    let open = 0;
    let filled = 0;
    for (const day of days) {
      for (const cell of day.slots) {
        if (!cell.expected) continue;
        if (cell.assignment) filled++;
        else open++;
      }
    }
    return { open, filled };
  }, [days]);

  async function perform(payload: DragPayload, date: string, slot: Slot) {
    if (payload.kind === 'person') {
      const person = schedule.persons[type].find((p) => p.id === payload.id);
      if (person) await actions.assign(date, slot, person);
    } else {
      const assignment = schedule.assignments[type].find((a) => a.id === payload.id);
      if (assignment) await actions.move(assignment, date, slot);
    }
  }

  function handleDrop(payload: DragPayload, date: string, slot: Slot | null) {
    const allowed = expectedSlots(type, date, schedule.dayRules);
    if (!allowed.length) {
      toast.error(
        type === 'aufsicht'
          ? 'Nur an Schießabenden möglich (Samstage in der Saison und 26.12.)'
          : 'Nur an Sonn- und Feiertagen sowie an Schießabenden (Samstage zwischen Anfangs- und Endschießen) möglich',
      );
      return;
    }
    const target = slot && allowed.includes(slot) ? slot : allowed.length === 1 ? allowed[0]! : null;
    if (target) void perform(payload, date, target);
    else setSlotPick({ payload, date, slots: allowed });
  }

  if (schedule.loading) return <Spinner label="Lade Einteilungen…" />;

  return (
    <div className="schedule">
      <div className="schedule__main">
        {mode === 'admin' && <ConflictsPanel onJump={(date) => { setMonth(date.slice(0, 7)); setOpenDay(date); }} />}
        {mode === 'admin' && (
          <StreaksPanel type={type} onJump={(date) => setMonth(date.slice(0, 7))} onFix={() => setDialog('streaks')} />
        )}

        <div className="schedule-toolbar">
          <div className="month-nav">
            <button type="button" className="btn btn--icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Vorheriger Monat">
              <ChevronLeft aria-hidden="true" />
            </button>
            <h2 className="month-nav__label" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <button type="button" className="btn btn--icon" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Nächster Monat">
              <ChevronRight aria-hidden="true" />
            </button>
            {month !== todayISO().slice(0, 7) && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMonth(todayISO().slice(0, 7))}>
                Heute
              </button>
            )}
          </div>
          <div className="schedule-toolbar__actions">
            <div className="segmented segmented--icons" role="group" aria-label="Ansicht">
              <button
                type="button"
                className={effectiveView === 'grid' ? 'is-active' : undefined}
                aria-pressed={effectiveView === 'grid'}
                onClick={() => setView('grid')}
                title="Monatsansicht"
              >
                <LayoutGrid aria-hidden="true" /> <span>Monat</span>
              </button>
              <button
                type="button"
                className={effectiveView === 'list' ? 'is-active' : undefined}
                aria-pressed={effectiveView === 'list'}
                onClick={() => setView('list')}
                title="Listenansicht"
              >
                <List aria-hidden="true" /> <span>Liste</span>
              </button>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => setDialog('pdf')}>
              <FileDown aria-hidden="true" /> Zeitraum wählen (PDF)
            </button>
            {mode === 'admin' && (
              <>
                <button type="button" className="btn btn--sm" onClick={() => setDialog('rotation')}>
                  <RefreshCw aria-hidden="true" /> Auto-Rotation
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setDialog('duplicates')}>
                  <Sparkles aria-hidden="true" /> Duplikate bereinigen
                </button>
                {type === 'wirte' && (
                  <Link className="btn btn--sm btn--ghost" to="/vorstand/wirte-tage">
                    <CalendarRange aria-hidden="true" /> Wirte-Tage verwalten
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <div className="schedule-legend" aria-hidden="true">
          <span className="legend legend--complete">eingeteilt</span>
          <span className="legend legend--partial">teilweise</span>
          <span className="legend legend--missing">fehlt</span>
          <span className="schedule-legend__stats">
            {stats.filled} eingeteilt · {stats.open} offen
          </span>
        </div>

        {editable && effectiveView === 'grid' && (
          <p className="hint schedule-hint">
            Tipp: Personen aus der rechten Liste auf einen Tag ziehen, eingeteilte Personen zum Verschieben ziehen, oder einen Tag
            anklicken.
          </p>
        )}

        {effectiveView === 'grid' ? (
          <MonthGrid
            type={type}
            days={days}
            editable={editable}
            highlight={mode === 'helper' ? me : null}
            conflictKeys={conflictKeys}
            pendingSwapIds={pendingSwapIds}
            onOpenDay={setOpenDay}
            onDrop={handleDrop}
          />
        ) : (
          <DayList
            type={type}
            days={days}
            editable={false}
            highlight={mode === 'helper' ? me : null}
            conflictKeys={conflictKeys}
            pendingSwapIds={pendingSwapIds}
            onOpenDay={setOpenDay}
          />
        )}
      </div>

      <aside className="schedule__aside" aria-label="Personen und Tauschanfragen">
        {mode === 'helper' && <MyDutiesPanel type={type} me={me} setMe={setMe} />}
        <PersonPanel type={type} editable={editable} />
        <SwapPanel type={type} />
      </aside>

      <DayDialog type={type} date={openDay} mode={mode} onClose={() => setOpenDay(null)} />

      <Modal
        open={!!slotPick}
        onClose={() => setSlotPick(null)}
        title="Für welchen Zeitraum einteilen?"
        size="s"
      >
        <div className="slot-choice">
          {slotPick?.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              className="btn btn--lg btn--block"
              onClick={() => {
                const pick = slotPick;
                setSlotPick(null);
                if (pick) void perform(pick.payload, pick.date, slot);
              }}
            >
              {SLOT_LABEL[slot]} ({slotTime(type, slot)})
            </button>
          ))}
        </div>
      </Modal>

      {mode === 'admin' && <RotationDialog type={type} open={dialog === 'rotation'} onClose={() => setDialog(null)} />}
      {mode === 'admin' && <DuplicatesDialog type={type} open={dialog === 'duplicates'} onClose={() => setDialog(null)} />}
      {mode === 'admin' && <StreaksDialog type={type} open={dialog === 'streaks'} onClose={() => setDialog(null)} />}
      <RangePdfDialog type={type} open={dialog === 'pdf'} onClose={() => setDialog(null)} />
      <span className="visually-hidden">{TYPE_LABEL[type]}</span>
    </div>
  );
}
