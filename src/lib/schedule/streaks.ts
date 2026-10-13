import { addDays, weekday } from '../dates';
import { compareForKeep } from './model';
import { effectiveSlot, isExplicitSlot, type DayRules } from './slots';
import { canTake, isPlaceholder, type Assignment, type Person, type ScheduleType, type Slot } from './types';

/**
 * Zu dicht sind zwei Dienste derselben Person, wenn sie am selben Wochenende liegen (höchstens 1 Tag Abstand,
 * z. B. Samstag + Sonntag) oder wenn es derselbe Dienst eine Woche früher oder später ist (z. B. zwei Samstage
 * in Folge). Schießabend und Frühschoppen an zwei Wochenenden hintereinander sind erlaubt – sonst könnte die
 * Rotation die festgelegte Reihenfolge für Wirte, die beides machen, nicht einhalten.
 */
export const SAME_WEEKEND_DAYS = 1;
export const SAME_DUTY_GAP_DAYS = 7;

type Duty = Pick<Assignment, 'date'> & { slot: Slot };

export function tooClose(a: Duty, b: Duty): boolean {
  const days = daysApart(a.date, b.date);
  return days <= SAME_WEEKEND_DAYS || (a.slot === b.slot && days <= SAME_DUTY_GAP_DAYS);
}

/** Dienst einer Einteilung ohne Tagesregeln: gespeicherter Slot, sonst Samstag = Schießabend */
export function plainSlot(a: Pick<Assignment, 'date' | 'slot'>): Slot {
  if (isExplicitSlot(a.slot)) return a.slot;
  return weekday(a.date) === 6 ? 'schiessabend' : 'fruehschoppen';
}

/** Eine Person hat mehrere Dienste zu dicht hintereinander (siehe tooClose). */
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
  /** Diese Kandidaten hätten denselben Dienst schon eine Woche davor oder danach */
  tight: ReadonlySet<string>;
  /** Vorschlag (nur wenn jemand mit genug Abstand frei ist) */
  suggestion: Person | null;
}

export function daysApart(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000));
}

/** Häufungen je Person (zu dichte Dienste, siehe tooClose), die heute oder später noch andauern. */
export function findStreaks(
  assignments: Assignment[],
  from: string,
  slotOf: (a: Assignment) => Slot = plainSlot,
): Streak[] {
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
      const duty = { date: a.date, slot: slotOf(a) };
      if (run.some((r) => tooClose({ date: r.date, slot: slotOf(r) }, duty))) run.push(a);
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
 * Entzerren: Der erste Dienst einer Häufung bleibt; jeder weitere, der zu dicht an einem behaltenen liegt, geht an
 * jemand anderen. Vergangene und per Tausch übernommene Dienste bleiben.
 * Vorschlag: wer am selben Wochenende frei ist (weder Wirt noch Aufsicht), denselben Dienst nicht eine Woche davor
 * oder danach hat und in diesen Wochen am wenigsten Dienste hat; die Vorschläge werden auf mehrere Personen verteilt.
 * Ist niemand so frei, gibt es keinen Vorschlag – zur Auswahl stehen dann alle, die wenigstens an den Nachbartagen frei sind.
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

  const slotOf = (a: Assignment) => effectiveSlot(type, a, rules);
  // Arbeitskopie: Wer ist wann eingeteilt – eigene Dienste mit Slot, der andere Dienst (Aufsicht/Wirt) ohne?
  // (wird mit jedem Vorschlag fortgeschrieben)
  const dutiesOf = new Map<string, Map<string, Slot | null>>();
  const add = (person: string, date: string, slot: Slot | null) =>
    dutiesOf.set(person, (dutiesOf.get(person) ?? new Map<string, Slot | null>()).set(date, slot));
  otherType.filter((a) => a.date && a.person).forEach((a) => add(a.person, a.date, null));
  assignments.filter((a) => a.date && a.person).forEach((a) => add(a.person, a.date, slotOf(a)));
  const proposed = new Map<string, number>();
  const otherEvening = new Set(
    otherType
      .filter((a) => a.date && (type === 'wirte' || effectiveSlot('wirte', a, rules) === 'schiessabend'))
      .map((a) => `${a.date}|${a.person}`),
  );

  const changeable = (a: Assignment) => a.date >= from && !(a.swappedWith && a.originalPerson);
  const toChange: Assignment[] = [];
  for (const streak of findStreaks(assignments, from, slotOf)) {
    let kept: Assignment[] = [];
    for (const a of streak.assignments) {
      const clashes = kept.filter((k) => tooClose({ date: k.date, slot: slotOf(k) }, { date: a.date, slot: slotOf(a) }));
      if (clashes.length) {
        if (changeable(a)) {
          toChange.push(a);
          continue;
        }
        // nicht änderbar (Vergangenheit/Tausch) – dann lieber die zuvor behaltenen abgeben
        for (const k of clashes) if (changeable(k) && !toChange.includes(k)) toChange.push(k);
        kept = kept.filter((k) => !clashes.includes(k) || !changeable(k));
      }
      kept.push(a);
    }
  }
  toChange.sort((a, b) => a.date.localeCompare(b.date));

  const changes: StreakChange[] = [];
  for (const assignment of toChange) {
    const slot = effectiveSlot(type, assignment, rules);
    const { date } = assignment;
    const own = (name: string) => [...(dutiesOf.get(name) ?? new Map<string, Slot | null>())];
    const busyWithin = (name: string, range: number) => own(name).some(([d]) => daysApart(d, date) <= range);
    const windowStart = addDays(date, -LOAD_WINDOW_DAYS);
    const windowEnd = addDays(date, LOAD_WINDOW_DAYS);

    const eligible = persons
      .filter((p) => p.name !== assignment.person)
      .filter((p) => canTake(type, p, slot))
      .filter((p) => slot !== 'schiessabend' || !otherEvening.has(`${date}|${p.name}`))
      .filter((p) => !busyWithin(p.name, 1))
      .map((p) => {
        const duties = own(p.name);
        // Dienste in den Wochen davor und danach (Wirt und Aufsicht) – wer schon einen Vorschlag hat, rückt nach hinten
        const load = duties.filter(([d]) => d >= windowStart && d <= windowEnd).length + (proposed.get(p.name) ?? 0);
        const gap = duties.reduce((min, [d]) => Math.min(min, daysApart(d, date)), Infinity);
        const roomy = !duties.some(([d, s]) => s !== null && tooClose({ date: d, slot: s }, { date, slot }));
        return { p, roomy, load, gap };
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
      dutiesOf.get(assignment.person)?.delete(date);
      add(chosen.name, date, slot);
      proposed.set(chosen.name, (proposed.get(chosen.name) ?? 0) + 1);
    }
  }
  return changes;
}
