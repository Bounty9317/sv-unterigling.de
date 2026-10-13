import { addDays, datesBetween, weekday } from '../dates';
import { effectiveSlot, expectedSlots, type DayRules } from './slots';
import { SAME_DUTY_GAP_DAYS, SAME_WEEKEND_DAYS, daysApart } from './streaks';
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

/** Je Dienst die Reihe der Personen in der festgelegten Reihenfolge – die erste Person beginnt. */
export type RotationQueues = Partial<Record<Slot, Person[]>>;

export interface PlannedDuty {
  date: string;
  slot: Slot;
  person: string;
  color: string;
}

export interface RotationPlan {
  /** IDs der Einteilungen, die durch die Rotation ersetzt werden */
  deleteIds: string[];
  creates: PlannedDuty[];
  uniqueDays: number;
  /** Dienste, die mit einem Platzhalter („Kein Schießen“) belegt sind und unverändert bleiben */
  skipped: RotationEntry[];
  /** Dienste ohne Reihe (niemand ausgewählt) – bleiben unverändert */
  unfillable: RotationEntry[];
  /** Dienste, bei denen die Reihenfolge nicht eingehalten werden konnte (z. B. Schießaufsicht am selben Abend) */
  swaps: (PlannedDuty & { expected: string })[];
}

/**
 * Feste Rotation je Dienst: Jede Reihe läuft von Nr. 1 bis Nr. x und beginnt dann wieder bei Nr. 1.
 * Abgewichen wird nur, wenn es nicht anders geht – wenn die Person am selben Abend Schießaufsicht hat, am selben
 * Wochenende schon eingeteilt ist oder denselben Dienst eine Woche davor/danach hätte. Dann übernimmt der Nächste in
 * der Reihe, und die übersprungene Person kommt beim nächsten Dienst dieser Reihe dran; danach geht es normal weiter.
 * Dienste mit einem Platzhalter („Kein Schießen“) bleiben unverändert.
 */
export function planRotation(params: {
  type: ScheduleType;
  entries: RotationEntry[];
  queues: RotationQueues;
  existing: Assignment[];
  otherType: Assignment[];
  rules: DayRules;
}): RotationPlan {
  const { type, existing, otherType, rules } = params;
  const members = (slot: Slot) => (params.queues[slot] ?? []).filter((p) => !isPlaceholder(p.name));
  const blocked = new Set(
    existing.filter((a) => isPlaceholder(a.person)).map((a) => `${a.date}|${effectiveSlot(type, a, rules)}`),
  );
  const unfillable = params.entries.filter((e) => !blocked.has(`${e.date}|${e.slot}`) && !members(e.slot).length);
  const entries = params.entries.filter((e) => !blocked.has(`${e.date}|${e.slot}`) && members(e.slot).length > 0);
  const skipped = params.entries.filter((e) => blocked.has(`${e.date}|${e.slot}`));
  const targets = new Set(entries.map((e) => `${e.date}|${e.slot}`));

  const deleteIds = existing
    .filter((a) => targets.has(`${a.date}|${effectiveSlot(type, a, rules)}`))
    .map((a) => a.id);
  const deleted = new Set(deleteIds);

  // Platz jeder Person in ihrer Reihe: Wer dran war, rückt eine Runde nach hinten; wer übersprungen wurde, behält seinen Platz.
  const queues = new Map<Slot, { list: Person[]; turn: Map<string, number> }>();
  const queueFor = (slot: Slot) => {
    let queue = queues.get(slot);
    if (!queue) {
      const list = members(slot);
      queue = { list, turn: new Map(list.map((p, index) => [p.id, index])) };
      queues.set(slot, queue);
    }
    return queue;
  };

  // Abendtermine des jeweils anderen Dienstes (Wirt und Schießaufsicht am selben Abend geht nicht)
  const otherEvening = new Set(
    otherType
      .filter((a) => type === 'wirte' || effectiveSlot('wirte', a, rules) === 'schiessabend')
      .map((a) => `${a.date}|${a.person}`),
  );

  const creates: PlannedDuty[] = [];
  const swaps: RotationPlan['swaps'] = [];
  // Wer ist an welchem Tag schon dran (bestehend + neu verteilt) – und mit welchem Dienst?
  const kept = existing.filter((a) => !deleted.has(a.id));
  const onDay = new Set(kept.map((a) => `${a.date}|${a.person}`));
  const dutyOnDay = new Set(kept.map((a) => `${a.date}|${a.person}|${effectiveSlot(type, a, rules)}`));
  const otherOnDay = new Set(otherType.map((a) => `${a.date}|${a.person}`));
  const busy = (date: string, name: string) => onDay.has(`${date}|${name}`) || otherOnDay.has(`${date}|${name}`);
  const sortedEntries = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.slot === 'fruehschoppen' ? -1 : 1) - (b.slot === 'fruehschoppen' ? -1 : 1),
  );

  for (const entry of sortedEntries) {
    const { list, turn } = queueFor(entry.slot);
    const ranked = [...list].sort((a, b) => turn.get(a.id)! - turn.get(b.id)!);

    /** frei am Tag selbst; mit `weekend` auch am Vor- und Folgetag (Wirt und Aufsicht), mit `sameDuty` ohne denselben Dienst eine Woche davor/danach */
    const isFree = (p: Person, weekend: boolean, sameDuty: boolean) => {
      if (onDay.has(`${entry.date}|${p.name}`)) return false;
      if (entry.slot === 'schiessabend' && otherEvening.has(`${entry.date}|${p.name}`)) return false;
      for (let i = 1; weekend && i <= SAME_WEEKEND_DAYS; i++) {
        if (busy(addDays(entry.date, -i), p.name) || busy(addDays(entry.date, i), p.name)) return false;
      }
      for (let i = 1; sameDuty && i <= SAME_DUTY_GAP_DAYS; i++) {
        for (const d of [addDays(entry.date, -i), addDays(entry.date, i)]) if (dutyOnDay.has(`${d}|${p.name}|${entry.slot}`)) return false;
      }
      return true;
    };
    // Wer dran ist, bekommt den Dienst – nur wenn es nicht geht, der Nächste; notfalls lockern
    const chosen =
      ranked.find((p) => isFree(p, true, true)) ??
      ranked.find((p) => isFree(p, true, false)) ??
      ranked.find((p) => isFree(p, false, false)) ??
      ranked[0]!;

    const duty = { date: entry.date, slot: entry.slot, person: chosen.name, color: chosen.color };
    creates.push(duty);
    if (chosen !== ranked[0]) swaps.push({ ...duty, expected: ranked[0]!.name });
    onDay.add(`${entry.date}|${chosen.name}`);
    dutyOnDay.add(`${entry.date}|${chosen.name}|${entry.slot}`);
    const position = turn.get(chosen.id)!;
    turn.set(chosen.id, position + list.length);
    // Höchstens eine Runde Rückstand – wer immer wieder übersprungen wurde, holt nicht mehrere Dienste kurz hintereinander nach
    for (const p of list) {
      let t = turn.get(p.id)!;
      while (t <= position - list.length) t += list.length;
      turn.set(p.id, t);
    }
  }

  return { deleteIds, creates, uniqueDays: new Set(entries.map((e) => e.date)).size, skipped, unfillable, swaps };
}

/** Bestehende Einteilungen ohne die, die an diesen Diensten neu besetzt werden (Platzhalter bleiben). */
export function withoutTargets(type: ScheduleType, existing: Assignment[], entries: RotationEntry[], rules: DayRules): Assignment[] {
  const targets = new Set(entries.map((e) => `${e.date}|${e.slot}`));
  return existing.filter((a) => isPlaceholder(a.person) || !targets.has(`${a.date}|${effectiveSlot(type, a, rules)}`));
}

/**
 * Mehrere Dienste nacheinander planen (z. B. erst die Schießabende, dann die Frühschoppen passend dazu).
 * Was der Lauf neu besetzt, zählt beim Planen nicht mehr mit – die Schießabende richten sich also nicht nach
 * Sonntagen, die gleich ersetzt werden. Jeder Schritt sieht die Einteilungen der vorigen Schritte.
 */
export function planInSequence(
  steps: { entries: RotationEntry[]; queues: RotationQueues }[],
  base: { type: ScheduleType; existing: Assignment[]; otherType: Assignment[]; rules: DayRules },
): RotationPlan {
  const { type, rules } = base;
  const allEntries = steps.flatMap((s) => s.entries.filter((e) => (s.queues[e.slot] ?? []).length > 0));
  const remaining = withoutTargets(type, base.existing, allEntries, rules);
  const kept = new Set(remaining.map((a) => a.id));
  const total: RotationPlan = {
    deleteIds: base.existing.filter((a) => !kept.has(a.id)).map((a) => a.id),
    creates: [],
    uniqueDays: 0,
    skipped: [],
    unfillable: [],
    swaps: [],
  };
  let existing = remaining;
  steps.forEach((step, s) => {
    const plan = planRotation({ ...base, existing, entries: step.entries, queues: step.queues });
    total.creates.push(...plan.creates);
    total.skipped.push(...plan.skipped);
    total.unfillable.push(...plan.unfillable);
    total.swaps.push(...plan.swaps);
    existing = [...existing, ...plan.creates.map((c, i) => ({ id: `geplant-${s}-${i}`, ...c }))];
  });
  total.uniqueDays = new Set(total.creates.map((c) => c.date)).size;
  return total;
}

/** Einteilungen nach dem Plan (bestehende ohne die ersetzten, plus die neuen) */
export function applyPlan(existing: Assignment[], plan: RotationPlan): Assignment[] {
  const deleted = new Set(plan.deleteIds);
  return [...existing.filter((a) => !deleted.has(a.id)), ...plan.creates.map((c, i) => ({ id: `neu-${i}`, ...c }))];
}

/** Dieselbe Person an zwei Wochenenden direkt hintereinander (höchstens 8 Tage Abstand, egal welcher Dienst) */
export interface BackToBack {
  person: string;
  first: string;
  second: string;
}

export function findBackToBack(assignments: Pick<Assignment, 'date' | 'person'>[], from: string, to: string): BackToBack[] {
  const byPerson = new Map<string, string[]>();
  for (const a of assignments) {
    if (!a.person || isPlaceholder(a.person)) continue;
    byPerson.set(a.person, [...(byPerson.get(a.person) ?? []), a.date]);
  }
  const result: BackToBack[] = [];
  for (const [person, dates] of byPerson) {
    const sorted = [...new Set(dates)].sort();
    sorted.forEach((date, i) => {
      const previous = sorted[i - 1];
      if (previous && daysApart(previous, date) <= 8 && date >= from && previous <= to) result.push({ person, first: previous, second: date });
    });
  }
  return result.sort((a, b) => a.first.localeCompare(b.first) || a.person.localeCompare(b.person, 'de'));
}

/** Reihe so drehen, dass sie mit dem Nachfolger der zuletzt (vor dem Start) eingeteilten Person dieses Dienstes beginnt. */
export function continueAfterLast(
  order: Person[],
  last: Pick<Assignment, 'person'> | null,
): Person[] {
  const index = last ? order.findIndex((p) => p.name === last.person) : -1;
  return index < 0 ? order : [...order.slice(index + 1), ...order.slice(0, index + 1)];
}

/** Letzte Einteilung dieses Dienstes vor dem Start (nur Personen der Reihe) */
export function lastBeforeStart(
  type: ScheduleType,
  existing: Assignment[],
  members: Person[],
  slot: Slot,
  start: string,
  rules: DayRules,
): Assignment | null {
  const names = new Set(members.map((p) => p.name));
  let last: Assignment | null = null;
  for (const a of existing) {
    if (a.date < start && names.has(a.person) && effectiveSlot(type, a, rules) === slot && (!last || a.date > last.date)) last = a;
  }
  return last;
}

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
}

export interface OrderResult {
  order: Person[];
  backToBack: BackToBack[];
  /** Abstände von höchstens 13 Tagen (nur ein freies Wochenende dazwischen) */
  close: number;
  swaps: number;
}

/**
 * Beste Reihenfolge für eine Reihe (z. B. Frühschoppen), passend zu den übrigen Einteilungen (z. B. den Schießabenden):
 * möglichst wenige Wirte an zwei Wochenenden hintereinander, dann möglichst wenige Platztausche (die Reihe soll
 * sichtbar 1 bis x laufen), dann möglichst wenige mit nur einem freien Wochenende dazwischen, dann möglichst nah an
 * der bisherigen Reihenfolge.
 * Bis 8 Personen werden alle Reihenfolgen durchgerechnet, darüber wird schrittweise verbessert.
 */
export function bestOrder(params: {
  type: ScheduleType;
  slot: Slot;
  entries: RotationEntry[];
  current: Person[];
  existing: Assignment[];
  otherType: Assignment[];
  rules: DayRules;
}): { best: OrderResult; current: OrderResult; tried: number } {
  const { type, slot, entries, current, existing, otherType, rules } = params;
  const from = entries[0]?.date ?? '';
  const to = entries.at(-1)?.date ?? '';
  const evaluate = (order: Person[]): OrderResult => {
    const plan = planRotation({ type, entries, queues: { [slot]: order }, existing, otherType, rules });
    const all = applyPlan(existing, plan);
    const backToBack = findBackToBack(all, from, to);
    let close = 0;
    const byPerson = new Map<string, string[]>();
    for (const a of all) byPerson.set(a.person, [...(byPerson.get(a.person) ?? []), a.date]);
    for (const dates of byPerson.values()) {
      const sorted = [...new Set(dates)].sort();
      sorted.forEach((d, i) => {
        const prev = sorted[i - 1];
        if (prev && d >= from && prev <= to && daysApart(prev, d) > 8 && daysApart(prev, d) <= 13) close++;
      });
    }
    return { order, backToBack, close, swaps: plan.swaps.length };
  };
  const distance = (order: Person[]) => order.reduce((sum, p, i) => sum + Math.abs(current.indexOf(p) - i), 0);
  const better = (a: OrderResult, b: OrderResult) =>
    a.backToBack.length - b.backToBack.length || a.swaps - b.swaps || a.close - b.close || distance(a.order) - distance(b.order);

  const currentResult = evaluate(current);
  let best = currentResult;
  let tried = 1;
  if (current.length <= 8) {
    for (const order of permutations(current)) {
      const result = evaluate(order);
      tried++;
      if (better(result, best) < 0) best = result;
    }
  } else {
    // viele Personen: Plätze tauschen, solange es besser wird
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < best.order.length; i++) {
        for (let j = i + 1; j < best.order.length; j++) {
          const order = [...best.order];
          [order[i], order[j]] = [order[j]!, order[i]!];
          const result = evaluate(order);
          tried++;
          if (better(result, best) < 0) {
            best = result;
            improved = true;
          }
        }
      }
    }
  }
  return { best, current: currentResult, tried };
}
