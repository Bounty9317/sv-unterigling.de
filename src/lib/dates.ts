/**
 * Datums-Hilfen. Alle Termine werden als lokale Kalendertage im Format "YYYY-MM-DD"
 * gespeichert. Wir rechnen deshalb bewusst mit lokaler Zeit statt UTC – sonst würde
 * z. B. zwischen 0 und 2 Uhr nachts noch der Vortag als „heute“ gelten.
 */

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
export const WEEKDAYS_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;
export const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;
export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD" (lokale Zeit) */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Heutiges Datum als "YYYY-MM-DD" (lokale Zeit) */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Prüft auf ein gültiges Kalenderdatum "YYYY-MM-DD" (optional mit Anhang wie "-schiessabend"). */
export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** "YYYY-MM-DD…" → Date um 00:00 Uhr lokaler Zeit. */
export function parseISODate(value: string): Date {
  const m = ISO_DATE.exec(value);
  if (!m) return new Date(Number.NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Nur der Datumsteil eines Schlüssels wie "2026-01-10-schiessabend". */
export function baseDate(value: string): string {
  return value.slice(0, 10);
}

export function weekday(value: string): number {
  return parseISODate(value).getDay();
}

export function addDays(value: string, days: number): string {
  const d = parseISODate(value);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "2026-10-17" → "17.10.2026" */
export function formatDate(value: string): string {
  const m = ISO_DATE.exec(value);
  if (!m) return value;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** "2026-10-17" → "Sa, 17.10.2026" */
export function formatDateWithWeekday(value: string): string {
  return `${WEEKDAYS_SHORT[weekday(value)]}, ${formatDate(value)}`;
}

/** "2026-10-17" → "Samstag, 17. Oktober 2026" */
export function formatDateLong(value: string): string {
  const d = parseISODate(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-10" → "Oktober 2026" */
export function formatMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y ?? 2000, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y ?? 2000, m ?? 1, 0).getDate();
}

/** Alle Tage eines Monats als "YYYY-MM-DD". */
export function datesOfMonth(yearMonth: string): string[] {
  const total = daysInMonth(yearMonth);
  return Array.from({ length: total }, (_, i) => `${yearMonth}-${pad2(i + 1)}`);
}

/** Alle Tage zwischen zwei Daten (inklusive). */
export function datesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  if (!isISODate(start) || !isISODate(end) || start > end) return result;
  let current = start;
  while (current <= end) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
}

/**
 * Saison-Bezeichnung wie „25/26“. Die Schießsaison beginnt im Herbst,
 * ab August wird deshalb schon die neue Saison angezeigt.
 */
export function seasonLabel(now: Date = new Date()): string {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const two = (y: number) => String(y % 100).padStart(2, '0');
  return `${two(startYear)}/${two(startYear + 1)}`;
}
