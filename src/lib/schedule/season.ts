import type { DayNote } from './types';

/** Schießsaison von „Anfangsschießen“ bis „Endschießen“ (aus den Schießaufsicht-Infos). */
export interface Season {
  start: string;
  end: string | null;
}

const START = /anfangsschie(ß|ss)en/i;
const END = /endschie(ß|ss)en/i;

export function seasonsFromNotes(notes: Pick<DayNote, 'date' | 'note'>[]): Season[] {
  const starts = notes.filter((n) => START.test(n.note)).map((n) => n.date).sort();
  const ends = notes.filter((n) => END.test(n.note)).map((n) => n.date).sort();
  return starts.map((start, i) => {
    const nextStart = starts[i + 1];
    const end = ends.find((e) => e >= start && (!nextStart || e < nextStart)) ?? null;
    return { start, end };
  });
}

export function isInSeason(date: string, season: Season): boolean {
  return date >= season.start && (season.end === null || date <= season.end);
}

export function isInAnySeason(date: string, seasons: readonly Season[]): boolean {
  return seasons.some((s) => isInSeason(date, s));
}

/** Saisonjahr eines Datums: Juli–Dezember gehört zum eigenen Jahr, Januar–Juni zum Vorjahr. */
function winterOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 7 ? year : year - 1;
}

/** Samstags-Öffnung laut Öffnungszeiten: Oktober bis März. */
export function isWinterMonth(date: string): boolean {
  const month = Number(date.slice(5, 7));
  return month >= 10 || month <= 3;
}

/**
 * Wird an diesem Tag geschossen? Maßgeblich ist die Saison dieses Winters (Anfangs- bis Endschießen).
 * Ist dafür noch nichts eingetragen, gilt Oktober bis März. Ohne Endschießen endet die Saison am 31.03.
 */
export function isShootingSeason(date: string, seasons: readonly Season[]): boolean {
  const winter = winterOf(date);
  const own = seasons.filter((s) => winterOf(s.start) === winter);
  if (!own.length) return isWinterMonth(date);
  return own.some((s) => date >= s.start && date <= (s.end ?? `${winter + 1}-03-31`));
}

/** Laufende Saison – oder in der Sommerpause die nächste bzw. letzte. */
export function currentOrNextSeason(seasons: readonly Season[], today: string): Season | null {
  if (!seasons.length) return null;
  const running = seasons.find((s) => isInSeason(today, s));
  if (running) return running;
  const upcoming = seasons.filter((s) => s.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  return upcoming ?? seasons[seasons.length - 1]!;
}
