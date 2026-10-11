import { useState, type DragEvent, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarHeart, StickyNote, TriangleAlert } from 'lucide-react';
import { colorVar } from '../ui/misc';
import { WEEKDAYS_SHORT, formatDateLong, todayISO } from '../../lib/dates';
import type { DayModel, SlotCell } from '../../lib/schedule/model';
import { SLOT_LABEL, type Assignment, type ScheduleType, type Slot } from '../../lib/schedule/types';

export type DragPayload = { kind: 'person'; id: string } | { kind: 'assignment'; id: string };

const DND_TYPE = 'application/x-svu-einteilung';

export function setDragData(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(DND_TYPE, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', payload.id);
  event.dataTransfer.effectAllowed = 'copyMove';
}

function readDragData(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData(DND_TYPE);
    return raw ? (JSON.parse(raw) as DragPayload) : null;
  } catch {
    return null;
  }
}

export interface CalendarProps {
  type: ScheduleType;
  days: DayModel[];
  editable: boolean;
  highlight?: string | null;
  conflictKeys: Set<string>;
  pendingSwapIds: Set<string>;
  onOpenDay(date: string): void;
  onDrop?(payload: DragPayload, date: string, slot: Slot | null): void;
}

const statusLabel: Record<DayModel['status'], string> = {
  complete: 'vollständig eingeteilt',
  partial: 'teilweise eingeteilt',
  missing: 'Einteilung fehlt',
  disabled: 'kein Dienst',
  orphan: 'Einteilung an einem nicht vorgesehenen Tag',
};

function AssignmentChip({
  assignment,
  type,
  editable,
  highlighted,
  conflict,
  pendingSwap,
}: {
  assignment: Assignment;
  type: ScheduleType;
  editable: boolean;
  highlighted: boolean;
  conflict: boolean;
  pendingSwap: boolean;
}) {
  const swapped = !!(assignment.swappedWith && assignment.originalPerson);
  return (
    <span className="cal-assignment">
      <span
        className={`chip chip--sm${highlighted ? ' chip--highlight' : ''}${conflict ? ' chip--conflict' : ''}`}
        style={colorVar(assignment.color)}
        draggable={editable}
        onDragStart={editable ? (e) => setDragData(e, { kind: 'assignment', id: assignment.id }) : undefined}
        title={editable ? 'Ziehen zum Verschieben' : undefined}
      >
        {conflict && <TriangleAlert aria-label="Doppelt eingeteilt" />}
        {assignment.person}
      </span>
      {swapped && (
        <span className="cal-assignment__swap" title={`${assignment.person} übernimmt für ${assignment.originalPerson}`}>
          <ArrowLeftRight aria-hidden="true" /> für {assignment.originalPerson}
        </span>
      )}
      {pendingSwap && <span className="cal-assignment__pending">Tausch angefragt</span>}
      <span className="visually-hidden">{type === 'wirte' ? ' (Wirt)' : ' (Schießaufsicht)'}</span>
    </span>
  );
}

function SlotRow({
  cell,
  day,
  props,
  showLabel,
}: {
  cell: SlotCell;
  day: DayModel;
  props: CalendarProps;
  showLabel: boolean;
}) {
  const [over, setOver] = useState(false);
  const { editable, onDrop, type } = props;
  const dropHandlers = editable && onDrop && day.allowed
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          const payload = readDragData(e);
          if (payload) onDrop(payload, day.date, cell.slot);
        },
      }
    : {};

  return (
    <div className={`cal-slot${over ? ' is-over' : ''}${!cell.expected ? ' cal-slot--extra' : ''}`} {...dropHandlers}>
      {showLabel && <span className="cal-slot__label">{SLOT_LABEL[cell.slot]}</span>}
      {cell.assignment ? (
        <AssignmentChip
          assignment={cell.assignment}
          type={type}
          editable={editable}
          highlighted={!!props.highlight && cell.assignment.person === props.highlight}
          conflict={props.conflictKeys.has(`${day.date}|${cell.assignment.person}`) && cell.slot === 'schiessabend'}
          pendingSwap={props.pendingSwapIds.has(cell.assignment.id)}
        />
      ) : (
        <span className="cal-slot__empty">{editable ? '+ einteilen' : 'offen'}</span>
      )}
      {cell.duplicates.length > 0 && (
        <span className="badge badge--warning cal-slot__dup" title="Mehrere Einteilungen für denselben Dienst">
          +{cell.duplicates.length} doppelt
        </span>
      )}
    </div>
  );
}

function DayContent({ day, props }: { day: DayModel; props: CalendarProps }) {
  const showLabels = props.type === 'wirte' && day.slots.length > 1;
  return (
    <>
      {day.slots.map((cell) => (
        <SlotRow key={cell.slot} cell={cell} day={day} props={props} showLabel={showLabels} />
      ))}
      {day.note?.note && (
        <span className="cal-note" title={day.note.note}>
          <StickyNote aria-hidden="true" /> {day.note.note}
        </span>
      )}
    </>
  );
}

function useCellDrop(day: DayModel, props: CalendarProps) {
  const [over, setOver] = useState(false);
  if (!props.editable || !props.onDrop) return { over, handlers: {} };
  return {
    over,
    handlers: {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(false);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const payload = readDragData(e);
        if (payload) props.onDrop!(payload, day.date, null);
      },
    },
  };
}

function GridCell({ day, props }: { day: DayModel; props: CalendarProps }) {
  const { over, handlers } = useCellDrop(day, props);
  const today = day.date === todayISO();
  const label = `${formatDateLong(day.date)}${day.customDay ? `, ${day.customDay.description || 'Sondertag'}` : ''}: ${statusLabel[day.status]}`;
  return (
    <div
      className={`cal-cell cal-cell--${day.status}${today ? ' is-today' : ''}${over ? ' is-over' : ''}${day.customDay ? ' is-custom' : ''}`}
      {...handlers}
    >
      <button type="button" className="cal-cell__head" onClick={() => props.onOpenDay(day.date)} aria-label={label}>
        <span className="cal-cell__day">{day.day}</span>
        {day.customDay && (
          <span className="cal-cell__custom" title={day.customDay.description || 'Feiertag/Sondertag'}>
            <CalendarHeart aria-hidden="true" />
            <span className="cal-cell__custom-text">{day.customDay.description}</span>
          </span>
        )}
      </button>
      {(day.allowed || day.slots.length > 0) && (
        <div className="cal-cell__body" onClick={() => props.onOpenDay(day.date)}>
          <DayContent day={day} props={props} />
        </div>
      )}
    </div>
  );
}

export function MonthGrid(props: CalendarProps) {
  const first = props.days[0];
  const offset = first ? (first.weekday + 6) % 7 : 0; // Montag = 0
  const cells: ReactNode[] = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={`pad-${i}`} className="cal-cell cal-cell--pad" aria-hidden="true" />);
  props.days.forEach((day) => cells.push(<GridCell key={day.date} day={day} props={props} />));

  return (
    <div className="cal-grid">
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
        <div key={d} className="cal-grid__head" aria-hidden="true">
          {d}
        </div>
      ))}
      {cells}
    </div>
  );
}

/** Listenansicht (mobil): nur Tage mit Dienst oder Einträgen. */
export function DayList(props: CalendarProps) {
  const relevant = props.days.filter((d) => d.allowed || d.slots.length > 0);
  if (!relevant.length) return <p className="muted">In diesem Monat sind keine Dienste vorgesehen.</p>;
  return (
    <ul role="list" className="day-list">
      {relevant.map((day) => (
        <li key={day.date} className={`day-item day-item--${day.status}${day.date === todayISO() ? ' is-today' : ''}`}>
          <button type="button" className="day-item__head" onClick={() => props.onOpenDay(day.date)}>
            <span className="day-item__day">{day.day}</span>
            <span className="day-item__weekday">{WEEKDAYS_SHORT[day.weekday]}</span>
            {day.customDay && <span className="badge badge--accent">🎉 {day.customDay.description || 'Sondertag'}</span>}
            <span className="day-item__status">{statusLabel[day.status]}</span>
          </button>
          <div className="day-item__body" onClick={() => props.onOpenDay(day.date)}>
            {day.slots.map((cell) => (
              <div key={cell.slot} className="day-item__slot">
                {props.type === 'wirte' && <span className="day-item__slot-label">{SLOT_LABEL[cell.slot]}</span>}
                {cell.assignment ? (
                  <AssignmentChip
                    assignment={cell.assignment}
                    type={props.type}
                    editable={false}
                    highlighted={!!props.highlight && cell.assignment.person === props.highlight}
                    conflict={props.conflictKeys.has(`${day.date}|${cell.assignment.person}`) && cell.slot === 'schiessabend'}
                    pendingSwap={props.pendingSwapIds.has(cell.assignment.id)}
                  />
                ) : (
                  <span className="cal-slot__empty">Nicht eingeteilt</span>
                )}
              </div>
            ))}
            {day.note?.note && (
              <span className="cal-note">
                <StickyNote aria-hidden="true" /> {day.note.note}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
