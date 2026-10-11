import { describe, expect, it } from 'vitest';
import { datesBetween, formatDate, formatDateLong, isISODate, seasonLabel, shiftMonth, todayISO } from './dates';
import { findNextShooting, formatCountdown } from './countdown';
import { eventToIcs, groupByMonth, icsFileName, normalizeEvent, upcomingEvents } from './events';
import { cloudinaryUrl, isValidFolderName } from './gallery';

describe('Datum', () => {
  it('formatiert deutsch', () => {
    expect(formatDate('2026-10-17')).toBe('17.10.2026');
    expect(formatDateLong('2026-10-17')).toBe('Samstag, 17. Oktober 2026');
  });

  it('rechnet mit lokalen Kalendertagen', () => {
    expect(todayISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(datesBetween('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-02-28')).toBe(true);
  });

  it('ermittelt die Saison-Bezeichnung', () => {
    expect(seasonLabel(new Date(2026, 9, 11))).toBe('26/27');
    expect(seasonLabel(new Date(2026, 2, 1))).toBe('25/26');
    expect(seasonLabel(new Date(2099, 11, 31))).toBe('99/00');
  });
});

describe('Countdown', () => {
  const now = new Date(2026, 9, 11, 12, 0);

  it('nimmt den nächsten Schießabend – Veranstaltungszeiten haben Vorrang', () => {
    const next = findNextShooting(
      ['2026-10-24'],
      [
        { date: '2026-10-17', time: '19:30', title: 'Anfangsschießen 2026/2027', cancelled: false },
        { date: '2026-10-12', time: '18:00', title: 'Generalversammlung', cancelled: false },
      ],
      now,
    );
    expect(next?.date).toBe('2026-10-17');
    expect(next?.running).toBe(false);
  });

  it('ignoriert abgesagte und vergangene Termine und zeigt laufende an', () => {
    const during = new Date(2026, 9, 17, 20, 0);
    const next = findNextShooting(
      ['2026-10-10', '2026-10-17'],
      [{ date: '2026-10-24', title: 'Preisschießen', cancelled: true }],
      during,
    );
    expect(next?.date).toBe('2026-10-17');
    expect(next?.running).toBe(true);
    expect(findNextShooting([], [], now)).toBeNull();
  });

  it('formatiert wie bisher', () => {
    expect(formatCountdown(((6 * 24 + 7) * 3600 + 30 * 60 + 5) * 1000)).toBe('6T 7h 30m 5s');
    expect(formatCountdown((2 * 3600 + 5) * 1000)).toBe('2h 0m 5s');
    expect(formatCountdown(59_000)).toBe('0m 59s');
  });
});

describe('Veranstaltungen', () => {
  const events = [
    normalizeEvent('a', { title: 'Adventsfeier', date: '2026-12-12', time: '18:30' }),
    normalizeEvent('b', { title: 'Anfangsschießen', date: '2026-10-17', time: '19:30', registrationRequired: true }),
    normalizeEvent('c', { title: 'Fasching', date: '2026-02-07' }),
    normalizeEvent('d', { title: 'kaputt', date: 'irgendwann' }),
  ].filter((e) => e !== null);

  it('filtert und gruppiert kommende Termine', () => {
    expect(events).toHaveLength(3);
    const upcoming = upcomingEvents(events, '2026-10-11');
    expect(upcoming.map((e) => e.id)).toEqual(['b', 'a']);
    expect(groupByMonth(upcoming).map((g) => g.label)).toEqual(['Oktober 2026', 'Dezember 2026']);
  });

  it('erzeugt Kalenderdateien', () => {
    const ics = eventToIcs(events.find((e) => e.id === 'b')!, new Date(Date.UTC(2026, 9, 11)));
    expect(ics).toContain('DTSTART:20261017T193000');
    expect(ics).toContain('SUMMARY:Anfangsschießen');
    expect(ics).toContain('\r\nEND:VCALENDAR\r\n');
    expect(icsFileName(events.find((e) => e.id === 'b')!)).toBe('2026-10-17-anfangsschiessen.ics');
  });
});

describe('Galerie', () => {
  it('fügt Cloudinary-Transformationen ein', () => {
    expect(cloudinaryUrl('https://res.cloudinary.com/x/image/upload/v1/events/a.jpg', 'w_100')).toBe(
      'https://res.cloudinary.com/x/image/upload/w_100/v1/events/a.jpg',
    );
  });

  it('prüft Ordnernamen', () => {
    expect(isValidFolderName('Fasching 2026')).toBe(true);
    expect(isValidFolderName('Königsschießen_2026')).toBe(true);
    expect(isValidFolderName('a"b')).toBe(false);
    expect(isValidFolderName('../x')).toBe(false);
  });
});
