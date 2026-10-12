import { addDays } from '../dates';
import { compareForKeep } from './model';
import { effectiveSlot, type DayRules } from './slots';
import { canTake, isPlaceholder, type Assignment, type Person, type ScheduleType, type Slot } from './types';

/**
 * Mindestabstand zwischen zwei Diensten derselben Person: mehr als eine Woche.
 * Zu dicht sind also z. B. Samstag + Sonntag, zwei Samstage hintereinander oder Sonntag + folgender Samstag.
 */
export const MAX_GAP_DAYS = 7;

/** Eine Person hat mehrere Dienste innerhalb einer Woche. */
export interface Streak {
  person: string;
  /** je Tag eine Einteilung, nach Datum sortiert */
  assignments: Assignment[];
}

/** Vorschlag: Diese Einteilung an jemand anderen geben. */
export interface StreakChange {
  assignment: Assignment;
  slot: Slot;
  /** passende Personen, beste zuerst – leer, wenn niemand frei ist */
  candidates: Person[];
  /** Diese Kandidaten hätten selbst weniger als eine Woche Abstand zu einem anderen Dienst */
  tight: ReadonlySet<string>;
  /** Vorschlag (nur wenn jemand mit einer Woche Abstand frei ist) */
  suggestion: Person | null;
}

export function daysApart(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000));
}

/** Häufungen je Person (Dienste mit höchstens einer Woche Abstand), die heute oder später noch andauern. */
export function findStreaks(assignments: Assignment[], from: string): Streak[] {
  const byPerson = new Map<string, Map<string, Assignment>>();
  for (const a of [...assignments].sort(compareForKeep)) {
    if (!a.date || !a.person || isPlaceholder(a.person)) continue;
    const days = byPerson.get(a.person) ?? new Map<string, Assignment>();
    if (!days.has(a.date)) days.set(a.date, a);
    byPerson.set(a.person, days);
  }

  const streaks: Streak[] = [];
  for (const [person, days] of byPerson) {
    const sorted = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    let run: Assignment[] = [];
    const flush = () => {
      if (run.length > 1 && run[run.length - 1]!.date >= from) streaks.push({ person, assignments: run });
    };
    for (const a of sorted) {
      if (run.length && daysApart(run[run.length - 1]!.date, a.date) <= MAX_GAP_DAYS) run.push(a);
      else {
        flush();
        run = [a];
      }
    }
    flush();
  }
  return streaks.sort((a, b) => a.assignments[0]!.date.localeCompare(b.assignments[0]!.date) || a.person.localeCompare(b.person, 'de'));
}

const LOAD_WINDOW_DAYS = 28;

/**
 * Entzerren: Der erste Dienst einer Häufung bleibt; jeder weitere, der weniger als eine Woche nach dem zuletzt
 * behaltenen liegt, geht an jemand anderen. Vergangene und per Tausch übernommene Dienste bleiben.
 * Vorschlag: wer eine Woche davor und danach keinen Dienst hat (weder Wirt noch Aufsicht) und in diesen Wochen
 * am wenigsten Dienste hat; die Vorschläge werden auf mehrere Personen verteilt. Ist niemand mit einer Woche
 * Abstand frei, gibt es keinen Vorschlag – zur Auswahl stehen dann alle, die wenigstens an den Nachbartagen frei sind.
 */
export function planStreakFix(params: {
  type: ScheduleType;
  assignments: Assignment[];
  otherType: Assignment[];
  persons: Person[];
  rules: DayRules;
  from: string;
}): StreakChange[] {
  const { type, assignments, otherType, rules, from } = params;
  const persons = params.persons.filter((p) => !isPlaceholder(p.name));

  // Arbeitskopie: Wer ist wann eingeteilt – in beiden Diensten? (wird mit jedem Vorschlag fortgeschrieben)
  const daysOf = new Map<string, Set<string>>();
  const add = (person: string, date: string) => daysOf.set(person, (daysOf.get(person) ?? new Set()).add(date));
  assignments.filter((a) => a.date && a.person).forEach((a) => add(a.person, a.date));
  otherType.filter((a) => a.date && a.person).forEach((a) => add(a.person, a.date));
  const proposed = new Map<string, number>();
  const otherEvening = new Set(
    otherType
      .filter((a) => a.date && (type === 'wirte' || effectiveSlot('wirte', a, rules) === 'schiessabend'))
      .map((a) => `${a.date}|${a.person}`),
  );

  const changeable = (a: Assignment) => a.date >= from && !(a.swappedWith && a.originalPerson);
  const toChange: Assignment[] = [];
  for (const streak of findStreaks(assignments, from)) {
    let kept: Assignment | null = null;
    for (const a of streak.assignments) {
      if (kept && daysApart(kept.date, a.date) <= MAX_GAP_DAYS) {
        if (changeable(a)) {
          toChange.push(a);
          continue;
        }
        // nicht änderbar (Vergangenheit/Tausch) – dann lieber den zuvor behaltenen abgeben
        if (changeable(kept) && !toChange.includes(kept)) toChange.push(kept);
      }
      kept = a;
    }
  }
  toChange.sort((a, b) => a.date.localeCompare(b.date));

  const changes: StreakChange[] = [];
  for (const assignment of toChange) {
    const slot = effectiveSlot(type, assignment, rules);
    const { date } = assignment;
    const busyWithin = (name: string, range: number) =>
      [...(daysOf.get(name) ?? [])].some((d) => daysApart(d, date) <= range);
    const windowStart = addDays(date, -LOAD_WINDOW_DAYS);
    const windowEnd = addDays(date, LOAD_WINDOW_DAYS);

    const eligible = persons
      .filter((p) => p.name !== assignment.person)
      .filter((p) => canTake(type, p, slot))
      .filter((p) => slot !== 'schiessabend' || !otherEvening.has(`${date}|${p.name}`))
      .filter((p) => !busyWithin(p.name, 1))
      .map((p) => {
        const own = [...(daysOf.get(p.name) ?? [])];
        // Dienste in den Wochen davor und danach (Wirt und Aufsicht) – wer schon einen Vorschlag hat, rückt nach hinten
        const load = own.filter((d) => d >= windowStart && d <= windowEnd).length + (proposed.get(p.name) ?? 0);
        const gap = own.reduce((min, d) => Math.min(min, daysApart(d, date)), Infinity);
        return { p, roomy: gap > MAX_GAP_DAYS, load, gap };
      })
      .sort(
        (a, b) =>
          Number(b.roomy) - Number(a.roomy) || a.load - b.load || b.gap - a.gap || a.p.name.localeCompare(b.p.name, 'de'),
      );
    const candidates = eligible.map((c) => c.p);
    const tight = new Set(eligible.filter((c) => !c.roomy).map((c) => c.p.name));
    // Nur vorschlagen, wenn dadurch keine neue Häufung entsteht – sonst entscheidet der Vorstand
    const chosen = eligible.find((c) => c.roomy)?.p ?? null;

    changes.push({ assignment, slot, candidates, tight, suggestion: chosen });
    if (chosen) {
      daysOf.get(assignment.person)?.delete(date);
      add(chosen.name, date);
      proposed.set(chosen.name, (proposed.get(chosen.name) ?? 0) + 1);
    }
  }
  return changes;
}
