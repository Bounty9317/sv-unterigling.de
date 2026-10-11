import { datesOfMonth, weekday } from '../dates';
import type { Season } from './season';
import { dayRules, effectiveSlot, expectedSlots, isExplicitSlot, isShootingDay, type DayRules } from './slots';
import { SLOTS, type Assignment, type DayNote, type ScheduleType, type Slot, type WirteDay } from './types';

export interface SlotCell {
  slot: Slot;
  /** an diesem Tag regulär vorgesehen */
  expected: boolean;
  assignment?: Assignment;
  /** weitere Einträge im selben Slot (Duplikate) */
  duplicates: Assignment[];
}

export type DayStatus = 'disabled' | 'complete' | 'partial' | 'missing' | 'orphan';

export interface DayModel {
  date: string;
  day: number;
  weekday: number;
  allowed: boolean;
  shooting: boolean;
  customDay?: WirteDay;
  note?: DayNote;
  slots: SlotCell[];
  status: DayStatus;
}

export interface ScheduleData {
  assignments: Assignment[];
  notes: DayNote[];
  wirteDays: WirteDay[];
  /** Schießsaisons aus den Aufsicht-Infos */
  seasons?: readonly Season[];
}

/** Reihenfolge innerhalb eines Slots: explizit gespeicherte Slots zuerst, dann nach Name. */
export function compareForKeep(a: Assignment, b: Assignment): number {
  const aExplicit = isExplicitSlot(a.slot) ? 0 : 1;
  const bExplicit = isExplicitSlot(b.slot) ? 0 : 1;
  return aExplicit - bExplicit || a.person.localeCompare(b.person, 'de') || a.id.localeCompare(b.id);
}

function rulesFor(data: ScheduleData): DayRules {
  return dayRules(data.wirteDays.map((d) => d.date), data.seasons);
}

/** Einteilungen gruppiert nach Datum und Dienst. */
export function indexAssignments(
  type: ScheduleType,
  assignments: Assignment[],
  rules: DayRules,
): Map<string, Map<Slot, Assignment[]>> {
  const index = new Map<string, Map<Slot, Assignment[]>>();
  for (const assignment of assignments) {
    const slot = effectiveSlot(type, assignment, rules);
    let bySlot = index.get(assignment.date);
    if (!bySlot) {
      bySlot = new Map();
      index.set(assignment.date, bySlot);
    }
    const list = bySlot.get(slot) ?? [];
    list.push(assignment);
    bySlot.set(slot, list);
  }
  for (const bySlot of index.values()) {
    for (const list of bySlot.values()) list.sort(compareForKeep);
  }
  return index;
}

export function buildDay(
  type: ScheduleType,
  date: string,
  index: Map<string, Map<Slot, Assignment[]>>,
  notesByDate: Map<string, DayNote>,
  wirteDaysByDate: Map<string, WirteDay>,
  rules: DayRules,
): DayModel {
  const expected = expectedSlots(type, date, rules);
  const bySlot = index.get(date);
  const slots: SlotCell[] = [];
  for (const slot of SLOTS) {
    const list = bySlot?.get(slot) ?? [];
    const isExpected = expected.includes(slot);
    if (!isExpected && list.length === 0) continue;
    slots.push({ slot, expected: isExpected, assignment: list[0], duplicates: list.slice(1) });
  }

  const allowed = expected.length > 0;
  let status: DayStatus;
  if (!allowed) {
    status = slots.length ? 'orphan' : 'disabled';
  } else {
    const filled = slots.filter((s) => s.expected && s.assignment).length;
    status = filled === expected.length ? 'complete' : filled === 0 ? 'missing' : 'partial';
  }

  return {
    date,
    day: Number(date.slice(8, 10)),
    weekday: weekday(date),
    allowed,
    shooting: isShootingDay(date),
    customDay: wirteDaysByDate.get(date),
    note: notesByDate.get(date),
    slots,
    status,
  };
}

/** Alle Tage eines Monats ("YYYY-MM") mit Einteilungen, Notizen und Status. */
export function buildMonth(type: ScheduleType, yearMonth: string, data: ScheduleData): DayModel[] {
  const wirteDaysByDate = new Map(data.wirteDays.map((d) => [d.date, d]));
  const rules = rulesFor(data);
  const index = indexAssignments(type, data.assignments, rules);
  const notesByDate = new Map(data.notes.map((n) => [n.date, n]));
  return datesOfMonth(yearMonth).map((date) => buildDay(type, date, index, notesByDate, wirteDaysByDate, rules));
}

/** Offene Dienste in einem Zeitraum (für die Übersicht). */
export function countOpenSlots(type: ScheduleType, dates: string[], data: ScheduleData): number {
  const wirteDaysByDate = new Map(data.wirteDays.map((d) => [d.date, d]));
  const rules = rulesFor(data);
  const index = indexAssignments(type, data.assignments, rules);
  const notesByDate = new Map<string, DayNote>();
  let open = 0;
  for (const date of dates) {
    const day = buildDay(type, date, index, notesByDate, wirteDaysByDate, rules);
    open += day.slots.filter((s) => s.expected && !s.assignment).length;
  }
  return open;
}
