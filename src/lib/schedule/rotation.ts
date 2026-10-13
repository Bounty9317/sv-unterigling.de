import { addDays, datesBetween, weekday } from '../dates';
import { effectiveSlot, expectedSlots, type DayRules } from './slots';
import { MAX_GAP_DAYS } from './streaks';
import { canTake, isPlaceholder, type Assignment, type Person, type ScheduleType, type Slot } from './types';

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
      // Wirte: jeder Schießabend (auch der 26.12.) hängt am Haken „Schießabende“, Feiertage betreffen nur den Frühschoppen.
      // Aufsicht: der 26.12. lässt sich getrennt von den Samstagen wählen (Weihnachtsschießen).
      const evening =
        type === 'wirte'
          ? options.includeSaturdays
          : (dow === 6 && options.includeSaturdays) || (is26Dec && options.includeHolidays);
      const include =
        slot === 'schiessabend' ? evening : (dow === 0 && options.includeSundays) || (isCustom && options.includeHolidays);
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
  /** Dienste, die keine der ausgewählten Personen übernehmen kann (z. B. Schießabende, wenn alle nur Frühschoppen machen) – bleiben unverändert */
  unfillable: RotationEntry[];
}

/**
 * Rotation reihum in der festgelegten Reihenfolge – je Dienst eine eigene Reihe: Die Schießabende laufen der Reihe nach
 * durch alle, die Schießabend machen, die Frühschoppen durch alle, die Frühschoppen machen (Nr. 1, Nr. 2, … und dann
 * wieder von vorne). Wer beides macht, steht in beiden Reihen.
 * Wer am selben Abend Schießaufsicht hat oder am Wochenende davor/danach schon dran ist, wird übersprungen und behält
 * seinen Platz: Er kommt beim nächsten Dienst dieser Reihe als Erster dran, danach geht es in der Reihenfolge weiter.
 * Dienste an zwei Wochenenden hintereinander werden so vermieden, solange genug Leute da sind.
 * Ob Schießabende und Frühschoppen gemeinsam oder in getrennten Läufen verteilt werden, ergibt dieselben Reihen.
 * Dienste mit einem Platzhalter („Kein Schießen“) bleiben unverändert.
 */
export function planRotation(params: {
  type: ScheduleType;
  entries: RotationEntry[];
  /** in Rotations-Reihenfolge, die erste Person beginnt */
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
  const unfillable = params.entries.filter((e) => !blocked.has(`${e.date}|${e.slot}`) && !persons.some((p) => canTake(type, p, e.slot)));
  const entries = params.entries.filter((e) => !blocked.has(`${e.date}|${e.slot}`) && !unfillable.includes(e));
  const skipped = params.entries.filter((e) => blocked.has(`${e.date}|${e.slot}`));
  const targets = new Set(entries.map((e) => `${e.date}|${e.slot}`));

  const deleteIds = existing
    .filter((a) => targets.has(`${a.date}|${effectiveSlot(type, a, rules)}`))
    .map((a) => a.id);
  const deleted = new Set(deleteIds);

  // Je Dienst eine Reihe (alle, die ihn übernehmen, in der festgelegten Reihenfolge) mit dem Platz jeder Person:
  // Wer dran war, rückt eine Runde nach hinten; wer übersprungen wurde, behält seinen Platz.
  const queues = new Map<Slot, { members: Person[]; turn: Map<string, number> }>();
  const queueFor = (slot: Slot) => {
    let queue = queues.get(slot);
    if (!queue) {
      const members = persons.filter((p) => canTake(type, p, slot));
      queue = { members, turn: new Map(members.map((p, index) => [p.id, index])) };
      queues.set(slot, queue);
    }
    return queue;
  };

  // Abendtermine des jeweils anderen Dienstes (für die Konfliktvermeidung)
  const otherEvening = new Set(
    otherType
      .filter((a) => type === 'wirte' || effectiveSlot('wirte', a, rules) === 'schiessabend')
      .map((a) => `${a.date}|${a.person}`),
  );

  const creates: RotationPlan['creates'] = [];
  // Wer ist an welchem Tag schon dran (bestehend + neu verteilt)? – gegen Dienste an zwei Wochenenden hintereinander
  const onDay = new Set(existing.filter((a) => !deleted.has(a.id)).map((a) => `${a.date}|${a.person}`));
  const otherOnDay = new Set(otherType.map((a) => `${a.date}|${a.person}`));
  // Eigene Dienste zählen eine Woche davor und danach, Schießaufsicht nur am selben Wochenende (Vor- und Folgetag)
  const busy = (date: string, name: string, daysAway: number) =>
    onDay.has(`${date}|${name}`) || (daysAway <= 1 && otherOnDay.has(`${date}|${name}`));
  const sortedEntries = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.slot === 'fruehschoppen' ? -1 : 1) - (b.slot === 'fruehschoppen' ? -1 : 1),
  );

  for (const entry of sortedEntries) {
    const { members, turn } = queueFor(entry.slot);
    const ranked = [...members].sort((a, b) => turn.get(a.id)! - turn.get(b.id)!);

    /** frei am Tag selbst und `range` Tage davor und danach */
    const isFree = (p: Person, range: number) => {
      if (onDay.has(`${entry.date}|${p.name}`)) return false;
      if (entry.slot === 'schiessabend' && otherEvening.has(`${entry.date}|${p.name}`)) return false;
      for (let i = 1; i <= range; i++) {
        if (busy(addDays(entry.date, -i), p.name, i) || busy(addDays(entry.date, i), p.name, i)) return false;
      }
      return true;
    };
    // Erst jemanden suchen, der am Wochenende davor und danach frei ist, dann wenigstens Vor- und Folgetag frei – nur notfalls lockern
    const chosen =
      ranked.find((p) => isFree(p, MAX_GAP_DAYS)) ??
      ranked.find((p) => isFree(p, 1)) ??
      ranked.find((p) => isFree(p, 0)) ??
      ranked[0];
    if (!chosen) continue;

    creates.push({ date: entry.date, slot: entry.slot, person: chosen.name, color: chosen.color });
    onDay.add(`${entry.date}|${chosen.name}`);
    const position = turn.get(chosen.id)!;
    turn.set(chosen.id, position + members.length);
    // Kein Nachholen: Wer immer wieder übersprungen wurde, ist höchstens eine Runde im Rückstand –
    // sonst bekäme er danach mehrere Dienste kurz hintereinander.
    for (const p of members) {
      let t = turn.get(p.id)!;
      while (t <= position - members.length) t += members.length;
      turn.set(p.id, t);
    }
  }

  return { deleteIds, creates, uniqueDays: new Set(entries.map((e) => e.date)).size, skipped, unfillable };
}

/** Wer hatte zuletzt (vor dem Start) einen Dienst? – Hilfe für die Wahl, mit wem die Rotation weitermacht. */
export function lastBeforeStart(existing: Assignment[], persons: Person[], start: string): Assignment | null {
  const names = new Set(persons.map((p) => p.name));
  let last: Assignment | null = null;
  for (const a of existing) {
    if (a.date < start && names.has(a.person) && (!last || a.date > last.date)) last = a;
  }
  return last;
}
