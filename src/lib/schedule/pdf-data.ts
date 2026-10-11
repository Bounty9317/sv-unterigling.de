import { WEEKDAYS_SHORT, formatDate, monthKey, weekday } from '../dates';
import { compareForKeep } from './model';
import { currentOrNextSeason, isInAnySeason, isInSeason, seasonsFromNotes, type Season } from './season';
import { dayRules, effectiveSlot, isShootingDay, type DayRules } from './slots';
import { SLOT_LABEL, type Assignment, type DayNote, type ScheduleType, type Slot, type WirteDay } from './types';

export interface PdfRow {
  date: string;
  weekday: string;
  dateLabel: string;
  name: string;
  remark: string;
  color: string;
  slot: Slot;
  /** Nicht-Sonntag in der Frühschoppen-Spalte (Feiertag, Samstag-Frühschoppen) */
  irregular: boolean;
}

function remarkFor(type: ScheduleType, date: string, notes: Map<string, string>, wirteDays: Map<string, WirteDay>) {
  if (type === 'aufsicht') return notes.get(date) ?? '';
  const day = wirteDays.get(date);
  const parts = [day?.description?.trim(), notes.get(date)?.trim()].filter(Boolean) as string[];
  return [...new Set(parts)].join(' · ');
}

/** Pro Tag und Dienst nur eine Zeile (wie im Kalender angezeigt). */
function dedupe(type: ScheduleType, assignments: Assignment[], rules: DayRules) {
  const best = new Map<string, Assignment>();
  for (const a of [...assignments].sort(compareForKeep)) {
    const key = `${a.date}|${effectiveSlot(type, a, rules)}`;
    if (!best.has(key)) best.set(key, a);
  }
  return [...best.values()];
}

function toRow(
  type: ScheduleType,
  a: Assignment,
  rules: DayRules,
  notes: Map<string, string>,
  wirteDays: Map<string, WirteDay>,
): PdfRow {
  const slot = effectiveSlot(type, a, rules);
  return {
    date: a.date,
    weekday: WEEKDAYS_SHORT[weekday(a.date)],
    dateLabel: formatDate(a.date),
    name: a.person,
    remark: remarkFor(type, a.date, notes, wirteDays),
    color: a.color,
    slot,
    irregular: slot === 'fruehschoppen' && weekday(a.date) !== 0,
  };
}

export interface DateRangeData {
  left: PdfRow[];
  right: PdfRow[];
}

/**
 * Zeitraum-Liste. Wirte: links Schießabend (Samstag), rechts Frühschoppen (Sonntag/Feiertage).
 * Schießaufsicht: nur Schießabende innerhalb der Saison (Anfangs- bis Endschießen), falls hinterlegt.
 */
export function dateRangeData(params: {
  type: ScheduleType;
  startMonth: string;
  endMonth: string;
  assignments: Assignment[];
  notes: DayNote[];
  wirteDays: WirteDay[];
  /** Schießsaisons aus den Aufsicht-Infos (für die Zuordnung älterer Einträge) */
  seasons?: readonly Season[];
}): DateRangeData {
  const { type, startMonth, endMonth } = params;
  const wirteDays = new Map(params.wirteDays.map((d) => [d.date, d]));
  const notes = new Map(params.notes.map((n) => [n.date, n.note]));
  const seasons = type === 'aufsicht' ? seasonsFromNotes(params.notes) : (params.seasons ?? []);
  const rules = dayRules(wirteDays.keys(), seasons);

  const inRange = params.assignments.filter((a) => {
    const m = monthKey(a.date);
    return a.date && m >= startMonth && m <= endMonth;
  });
  const rows = dedupe(type, inRange, rules)
    .map((a) => toRow(type, a, rules, notes, wirteDays))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (type === 'aufsicht') {
    return {
      left: rows.filter((r) => isShootingDay(r.date) && (!seasons.length || isInAnySeason(r.date, seasons))),
      right: [],
    };
  }
  return {
    left: rows.filter((r) => r.slot === 'schiessabend'),
    right: rows.filter((r) => r.slot === 'fruehschoppen'),
  };
}

export interface PersonListData {
  rows: (PdfRow & { slotLabel: string })[];
  emptyMessage: string;
}

/** Termine einer Person: Wirte ab heute, Schießaufsicht für die laufende bzw. nächste Saison. */
export function personData(params: {
  type: ScheduleType;
  person: string;
  assignments: Assignment[];
  notes: DayNote[];
  wirteDays: WirteDay[];
  today: string;
  seasons?: readonly Season[];
}): PersonListData {
  const { type, person, today } = params;
  const wirteDays = new Map(params.wirteDays.map((d) => [d.date, d]));
  const notes = new Map(params.notes.map((n) => [n.date, n.note]));
  const seasons = type === 'aufsicht' ? seasonsFromNotes(params.notes) : (params.seasons ?? []);
  const rules = dayRules(wirteDays.keys(), seasons);
  const season = type === 'aufsicht' ? currentOrNextSeason(seasons, today) : null;

  const own = params.assignments.filter((a) => a.person === person && a.date);
  const filtered = own.filter((a) => (season ? isInSeason(a.date, season) : a.date >= today));
  const rows = dedupe(type, filtered, rules)
    .map((a) => ({ ...toRow(type, a, rules, notes, wirteDays), slotLabel: type === 'wirte' ? SLOT_LABEL[effectiveSlot(type, a, rules)] : '' }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.slot === 'fruehschoppen' ? -1 : 1));

  return {
    rows,
    emptyMessage:
      type === 'aufsicht' && season
        ? `Keine Einteilungen in der aktuellen Saison für ${person} gefunden!`
        : `Keine zukünftigen Einteilungen für ${person} gefunden!`,
  };
}
