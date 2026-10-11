import { compareForKeep } from './model';
import { effectiveSlot, type DayRules } from './slots';
import type { Assignment, ScheduleType, Slot } from './types';

export interface DuplicateGroup {
  date: string;
  slot: Slot;
  keep: Assignment;
  remove: Assignment[];
}

/** Mehrere Einteilungen für denselben Dienst am selben Tag – die im Kalender angezeigte bleibt. */
export function findDuplicates(
  type: ScheduleType,
  assignments: Assignment[],
  rules: DayRules,
): DuplicateGroup[] {
  const groups = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!a.date) continue;
    const key = `${a.date}|${effectiveSlot(type, a, rules)}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  const result: DuplicateGroup[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const [date, slot] = key.split('|') as [string, Slot];
    const sorted = [...list].sort(compareForKeep);
    result.push({ date, slot, keep: sorted[0]!, remove: sorted.slice(1) });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
