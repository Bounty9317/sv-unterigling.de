import { addDays, formatMonth, isISODate, monthKey, todayISO } from './dates';
import { verein, adresseEinzeilig } from '../data/verein';

/** Veranstaltung, wie sie in Firestore (Sammlung "events") gespeichert ist. */
export interface VereinsEvent {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" oder leer */
  time?: string;
  description?: string;
  registrationRequired?: boolean;
  cancelled?: boolean;
  createdAt?: string;
}

export function normalizeEvent(id: string, data: Record<string, unknown>): VereinsEvent | null {
  const date = typeof data.date === 'string' ? data.date : '';
  if (!isISODate(date)) return null;
  return {
    id,
    title: typeof data.title === 'string' ? data.title.trim() : '',
    date,
    time: typeof data.time === 'string' ? data.time : '',
    description: typeof data.description === 'string' ? data.description : '',
    registrationRequired: data.registrationRequired === true,
    cancelled: data.cancelled === true,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
  };
}

export function sortByDate<T extends { date: string; time?: string }>(events: T[], direction: 'asc' | 'desc' = 'asc') {
  const factor = direction === 'asc' ? 1 : -1;
  return [...events].sort(
    (a, b) => factor * (a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
  );
}

export function upcomingEvents(events: VereinsEvent[], today = todayISO()) {
  return sortByDate(events.filter((e) => e.date >= today));
}

export function pastEvents(events: VereinsEvent[], today = todayISO()) {
  return sortByDate(
    events.filter((e) => e.date < today),
    'desc',
  );
}

export interface MonthGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Gruppiert (bereits sortierte) Termine nach Monat – in der Reihenfolge des Auftretens. */
export function groupByMonth<T extends { date: string }>(events: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const event of events) {
    const key = monthKey(event.date);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: formatMonth(key), items: [] };
      groups.push(group);
    }
    group.items.push(event);
  }
  return groups;
}

/* ---------- Kalenderdatei (.ics) ---------- */

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen über 75 Zeichen müssen laut RFC 5545 umgebrochen werden. */
function icsFold(line: string) {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  parts.push(rest);
  return parts.join('\r\n');
}

function icsLocal(date: string, time: string) {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

export function eventToIcs(event: VereinsEvent, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const hasTime = !!event.time && /^\d{2}:\d{2}$/.test(event.time);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schuetzenverein Unterigling//Website//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@schuetzen-unterigling.de`,
    `DTSTAMP:${stamp}`,
  ];
  if (hasTime) {
    const [h, m] = event.time!.split(':').map(Number);
    const endHour = Math.min((h ?? 0) + 3, 23);
    // „Floating time“ (ohne Zeitzone) wird in der Ortszeit des Kalenders angezeigt.
    lines.push(`DTSTART:${icsLocal(event.date, event.time!)}`);
    lines.push(
      `DTEND:${icsLocal(event.date, `${String(endHour).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`)}`,
    );
  } else {
    lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, '')}`);
  }
  lines.push(`SUMMARY:${icsEscape((event.cancelled ? 'ABGESAGT: ' : '') + event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  lines.push(`LOCATION:${icsEscape(`${verein.kurzname}, ${adresseEinzeilig}`)}`);
  if (event.cancelled) lines.push('STATUS:CANCELLED');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** Dateiname ohne Sonderzeichen, z. B. "2026-12-26-weihnachtsschiessen.ics" */
export function icsFileName(event: VereinsEvent) {
  const slug = event.title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${event.date}-${slug || 'termin'}.ics`;
}
