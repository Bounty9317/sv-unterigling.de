import { baseDate, weekday } from '../dates';
import { isShootingSeason, type Season } from './season';
import type { Assignment, ScheduleType, Slot, SwapRequest } from './types';

/** Was für die Diensttage gilt: eingetragene Wirte-Tage und die Schießsaisons aus den Aufsicht-Infos. */
export interface DayRules {
  customDays: ReadonlySet<string>;
  seasons: readonly Season[];
}

export function dayRules(customDays: Iterable<string> = [], seasons: readonly Season[] = []): DayRules {
  return { customDays: new Set(customDays), seasons };
}

/** Schießabend-Wochentag: jeden Samstag sowie am 26.12. (Weihnachtsschießen). */
export function isShootingDay(date: string): boolean {
  return weekday(date) === 6 || date.slice(5, 10) === '12-26';
}

/**
 * Wird an diesem Abend ein Dienst gebraucht? Wirte und Schießaufsicht nur an Schießabenden innerhalb der
 * Schießsaison – vom Anfangsschießen bis zum Endschießen (Infos im Aufsicht-Kalender, sonst Oktober bis März).
 */
function eveningNeeded(date: string, rules: DayRules): boolean {
  return isShootingDay(date) && isShootingSeason(date, rules.seasons);
}

/**
 * Welche Dienste an einem Tag gebraucht werden.
 * Wirte:  Schießabend an Samstagen der Saison, Frühschoppen an Sonntagen und Feier-/Sondertagen
 *         (ein Feiertag an einem Sommer-Samstag hat also nur Frühschoppen).
 * Aufsicht: nur an Schießabenden der Saison.
 */
export function expectedSlots(type: ScheduleType, date: string, rules: DayRules): Slot[] {
  const evening = eveningNeeded(date, rules);
  if (type === 'aufsicht') return evening ? ['schiessabend'] : [];
  const slots: Slot[] = [];
  if (weekday(date) === 0 || rules.customDays.has(date)) slots.push('fruehschoppen');
  if (evening) slots.push('schiessabend');
  return slots;
}

export function isAllowedDay(type: ScheduleType, date: string, rules: DayRules): boolean {
  return expectedSlots(type, date, rules).length > 0;
}

export function isExplicitSlot(value: unknown): value is Slot {
  return value === 'fruehschoppen' || value === 'schiessabend';
}

/**
 * Dienst einer Einteilung. Ältere Einträge haben keinen oder den Slot "default" –
 * dann ergibt er sich aus dem Tag (Samstag = Schießabend, Sonntag/Feiertag = Frühschoppen).
 */
export function effectiveSlot(type: ScheduleType, assignment: Pick<Assignment, 'date' | 'slot'>, rules: DayRules): Slot {
  if (type === 'aufsicht') return 'schiessabend';
  if (isExplicitSlot(assignment.slot)) return assignment.slot;
  const expected = expectedSlots(type, assignment.date, rules);
  if (expected.length === 1) return expected[0]!;
  if (expected.includes('schiessabend')) return 'schiessabend';
  if (!expected.length && isShootingDay(assignment.date)) return 'schiessabend';
  return 'fruehschoppen';
}

/** Wert für das Firestore-Feld "slot" beim Speichern. Aufsicht bleibt ohne Slot (wie bisher). */
export function storedSlot(type: ScheduleType, slot: Slot): Slot | null {
  return type === 'wirte' ? slot : null;
}

/** Offene Tauschanfrage für einen heutigen oder künftigen Dienst (ältere, nie erledigte Anfragen zählen nicht mehr). */
export function isOpenSwap(swap: Pick<SwapRequest, 'date' | 'slot' | 'status'>, today: string): boolean {
  return swap.status === 'pending' && swapTarget(swap).date >= today;
}

/** Datum und Slot einer Tauschanfrage – auch für ältere Anfragen mit "Datum-Slot"-Schlüssel. */
export function swapTarget(swap: Pick<SwapRequest, 'date' | 'slot'>): { date: string; slot: Slot | null } {
  const date = baseDate(swap.date);
  if (isExplicitSlot(swap.slot)) return { date, slot: swap.slot };
  const suffix = swap.date.slice(11);
  return { date, slot: isExplicitSlot(suffix) ? suffix : null };
}
