import { effectiveSlot, isShootingDay, type DayRules } from './slots';
import type { Assignment } from './types';

export interface Conflict {
  date: string;
  person: string;
}

/**
 * Doppelte Einteilungen: dieselbe Person ist am selben Schießabend Wirt (Schießabend)
 * und Schießaufsicht. Frühschoppen-Wirte sind kein Konflikt.
 */
export function findConflicts(
  wirte: Assignment[],
  aufsicht: Assignment[],
  rules: DayRules,
): Conflict[] {
  const aufsichtByDate = new Map<string, Set<string>>();
  for (const a of aufsicht) {
    if (!a.date || !a.person || !isShootingDay(a.date)) continue;
    const set = aufsichtByDate.get(a.date) ?? new Set<string>();
    set.add(a.person);
    aufsichtByDate.set(a.date, set);
  }

  const seen = new Set<string>();
  const conflicts: Conflict[] = [];
  for (const w of wirte) {
    if (!w.date || !w.person || !isShootingDay(w.date)) continue;
    if (effectiveSlot('wirte', w, rules) !== 'schiessabend') continue;
    if (!aufsichtByDate.get(w.date)?.has(w.person)) continue;
    const key = `${w.date}|${w.person}`;
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({ date: w.date, person: w.person });
  }
  return conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.person.localeCompare(b.person, 'de'));
}

/** Ist die Person an dem Tag schon für den jeweils anderen Dienst am Abend eingeteilt? */
export function eveningConflict(
  targetType: 'wirte' | 'aufsicht',
  person: string,
  date: string,
  other: Assignment[],
  rules: DayRules,
): Assignment | undefined {
  return other.find((a) => {
    if (a.date !== date || a.person !== person) return false;
    // Aufsicht einteilen → kollidiert mit Schießabend-Wirt; Wirt einteilen → mit Aufsicht
    return targetType === 'aufsicht' ? effectiveSlot('wirte', a, rules) === 'schiessabend' : true;
  });
}
