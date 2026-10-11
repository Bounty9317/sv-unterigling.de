import { addDays, pad2 } from '../dates';

/** Ostersonntag nach der Gaußschen Osterformel (Algorithmus nach Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export interface Holiday {
  date: string;
  name: string;
}

/** Gesetzliche Feiertage in Bayern (inkl. Mariä Himmelfahrt). */
export function bavarianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (md: string, name: string): Holiday => ({ date: `${year}-${md}`, name });
  return [
    fixed('01-01', 'Neujahr'),
    fixed('01-06', 'Heilige Drei Könige'),
    { date: addDays(easter, -2), name: 'Karfreitag' },
    { date: addDays(easter, 1), name: 'Ostermontag' },
    fixed('05-01', 'Tag der Arbeit'),
    { date: addDays(easter, 39), name: 'Christi Himmelfahrt' },
    { date: addDays(easter, 50), name: 'Pfingstmontag' },
    { date: addDays(easter, 60), name: 'Fronleichnam' },
    fixed('08-15', 'Mariä Himmelfahrt'),
    fixed('10-03', 'Tag der Deutschen Einheit'),
    fixed('11-01', 'Allerheiligen'),
    fixed('12-25', '1. Weihnachtsfeiertag'),
    fixed('12-26', '2. Weihnachtsfeiertag'),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
