import { isISODate, parseISODate } from './dates';
import type { VereinsEvent } from './events';

export const DEFAULT_SHOOTING_TIME = '19:30';
/** So lange gilt ein Schießabend nach Beginn als „läuft gerade“ (Schießstand 19:30–21:00). */
export const SHOOTING_DURATION_MS = 90 * 60 * 1000;

const SHOOTING_TITLE = /schie(ß|ss)en/i;

export interface NextShooting {
  date: string;
  time: string;
  start: Date;
  running: boolean;
}

function startOf(date: string, time: string): Date {
  const d = parseISODate(date);
  const [h, m] = (/^\d{1,2}:\d{2}$/.test(time) ? time : DEFAULT_SHOOTING_TIME).split(':').map(Number);
  d.setHours(h ?? 19, m ?? 30, 0, 0);
  return d;
}

/**
 * Nächster Schießabend aus den veröffentlichten Schießaufsicht-Terminen und
 * Veranstaltungen wie „Anfangsschießen“ oder „Weihnachtsschießen“.
 */
export function findNextShooting(
  shootingDates: string[],
  events: Pick<VereinsEvent, 'date' | 'time' | 'title' | 'cancelled'>[],
  now: Date = new Date(),
): NextShooting | null {
  const byDate = new Map<string, string>();
  for (const date of shootingDates) {
    if (isISODate(date)) byDate.set(date.slice(0, 10), DEFAULT_SHOOTING_TIME);
  }
  for (const event of events) {
    if (event.cancelled || !SHOOTING_TITLE.test(event.title) || !isISODate(event.date)) continue;
    byDate.set(event.date, event.time && /^\d{1,2}:\d{2}$/.test(event.time) ? event.time : DEFAULT_SHOOTING_TIME);
  }

  let best: NextShooting | null = null;
  for (const [date, time] of byDate) {
    const start = startOf(date, time);
    if (start.getTime() + SHOOTING_DURATION_MS <= now.getTime()) continue;
    if (!best || start < best.start) {
      best = { date, time, start, running: now >= start };
    }
  }
  return best;
}

/** 6T 3h 12m 45s – Format wie auf der bisherigen Seite */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}T ${hours}h ${minutes}m ${seconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
