import { addDays, datesBetween, weekday } from '../dates';
import { effectiveSlot, expectedSlots, type DayRules } from './slots';
import { MAX_GAP_DAYS } from './streaks';
import { isPlaceholder, type Assignment, type Person, type ScheduleType, type Slot } from './types';

export interface RotationDayOptions {
  includeSaturdays: boolean;
  includeSundays: boolean;
  /** Feiertage/Sondertage aus „Wirte-Tage“ sowie der 26.12. */
  includeHolidays: boolean;
}

export interface RotationEntry {
  date: string;
  slot: Slot;
}

/** Alle Dienste im Zeitraum, die die Rotation besetzen soll. */
export function rotationEntries(
  type: ScheduleType,
  start: string,
  end: string,
  options: RotationDayOptions,
  rules: DayRules,
): RotationEntry[] {
  const entries: RotationEntry[] = [];
  for (const date of datesBetween(start, end)) {
    const dow = weekday(date);
    const isCustom = rules.customDays.has(date);
    const is26Dec = date.slice(5) === '12-26';
    for (const slot of expectedSlots(type, date, rules)) {
      const include =
        slot === 'schiessabend'
          ? (dow === 6 && options.includeSaturdays) || (is26Dec && options.includeHolidays)
          : (dow === 0 && options.includeSundays) || (isCustom && options.includeHolidays);
      if (include) entries.push({ date, slot });
    }
  }
  return entries;
}

export interface RotationPlan {
  /** IDs der Einteilungen, die durch die Rotation ersetzt werden */
  deleteIds: string[];
  creates: { date: string; slot: Slot; person: string; color: string }[];
  uniqueDays: number;
  /** Dienste, die mit einem Platzhalter („Kein Schießen“) belegt sind und unverändert bleiben */
  skipped: RotationEntry[];
}

/**
 * Faire Rotation: Für jeden Dienst wird die Person gewählt, die am längsten nicht dran war
 * (wer noch nie eingeteilt war, kommt zuerst; bei Gleichstand gilt die Reihenfolge der Liste).
 * Wenn möglich wird vermieden, dass jemand am selben Abend Wirt und Schießaufsicht ist, zweimal am selben Tag
 * oder mehrmals innerhalb einer Woche eingeteilt wird (z. B. zwei Samstage hintereinander). Dienste mit einem Platzhalter („Kein Schießen“) bleiben unverändert.
 */
export function planRotation(params: {
  type: ScheduleType;
  entries: RotationEntry[];
  persons: Person[];
  existing: Assignment[];
  otherType: Assignment[];
  rules: DayRules;
}): RotationPlan {
  const { type, existing, otherType, rules } = params;
  const persons = params.persons.filter((p) => !isPlaceholder(p.name));
  const blocked = new Set(
    existing.filter((a) => isPlaceholder(a.person)).map((a) => `${a.date}|${effectiveSlot(type, a, rules)}`),
  );
  const entries = params.entries.filter((e) => !blocked.has(`${e.date}|${e.slot}`));
  const skipped = params.entries.filter((e) => blocked.has(`${e.date}|${e.slot}`));
  const targets = new Set(entries.map((e) => `${e.date}|${e.slot}`));

  const deleteIds = existing
    .filter((a) => targets.has(`${a.date}|${effectiveSlot(type, a, rules)}`))
    .map((a) => a.id);
  const deleted = new Set(deleteIds);

  const lastAssignment = new Map<string, string>();
  const remember = (person: string, date: string) => {
    const last = lastAssignment.get(person);
    if (!last || date > last) lastAssignment.set(person, date);
  };
  existing.filter((a) => !deleted.has(a.id)).forEach((a) => remember(a.person, a.date));

  // Abendtermine des jeweils anderen Dienstes (für die Konfliktvermeidung)
  const otherEvening = new Set(
    otherType
      .filter((a) => type === 'wirte' || effectiveSlot('wirte', a, rules) === 'schiessabend')
      .map((a) => `${a.date}|${a.person}`),
  );

  const creates: RotationPlan['creates'] = [];
  // Wer ist an welchem Tag schon dran (bestehend + neu verteilt)? – gegen mehrere Dienste innerhalb einer Woche
  const onDay = new Set(existing.filter((a) => !deleted.has(a.id)).map((a) => `${a.date}|${a.person}`));
  const otherOnDay = new Set(otherType.map((a) => `${a.date}|${a.person}`));
  const busy = (date: string, name: string) => onDay.has(`${date}|${name}`) || otherOnDay.has(`${date}|${name}`);
  const sortedEntries = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.slot === 'fruehschoppen' ? -1 : 1) - (b.slot === 'fruehschoppen' ? -1 : 1),
  );

  for (const entry of sortedEntries) {
    const ranked = persons
      .map((person, order) => ({ person, order, last: lastAssignment.get(person.name) }))
      .sort((a, b) => {
        if (!a.last && !b.last) return a.order - b.order;
        if (!a.last) return -1;
        if (!b.last) return 1;
        return a.last.localeCompare(b.last) || a.order - b.order;
      })
      .map((r) => r.person);

    /** frei am Tag selbst und `range` Tage davor und danach */
    const isFree = (p: Person, range: number) => {
      if (onDay.has(`${entry.date}|${p.name}`)) return false;
      if (entry.slot === 'schiessabend' && otherEvening.has(`${entry.date}|${p.name}`)) return false;
      for (let i = 1; i <= range; i++) {
        if (busy(addDays(entry.date, -i), p.name) || busy(addDays(entry.date, i), p.name)) return false;
      }
      return true;
    };
    // Erst jemanden mit einer Woche Abstand suchen, dann wenigstens Vor- und Folgetag frei – nur notfalls lockern
    const chosen =
      ranked.find((p) => isFree(p, MAX_GAP_DAYS)) ??
      ranked.find((p) => isFree(p, 1)) ??
      ranked.find((p) => isFree(p, 0)) ??
      ranked[0];
    if (!chosen) continue;

    creates.push({ date: entry.date, slot: entry.slot, person: chosen.name, color: chosen.color });
    onDay.add(`${entry.date}|${chosen.name}`);
    remember(chosen.name, entry.date);
  }

  return { deleteIds, creates, uniqueDays: new Set(entries.map((e) => e.date)).size, skipped };
}
