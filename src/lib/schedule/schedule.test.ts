import { describe, expect, it } from 'vitest';
import { buildMonth, countOpenSlots } from './model';
import { dayRules, effectiveSlot, expectedSlots, isOpenSwap, isShootingDay, swapTarget } from './slots';
import { eveningConflict, findConflicts } from './conflicts';
import {
  applyPlan,
  bestOrder,
  continueAfterLast,
  findBackToBack,
  lastBeforeStart,
  planInSequence,
  planRotation,
  rotationEntries,
  type RotationDayOptions,
  type RotationQueues,
} from './rotation';
import { findDuplicates } from './duplicates';
import { daysApart, findStreaks, planStreakFix } from './streaks';
import { currentOrNextSeason, seasonsFromNotes } from './season';
import { bavarianHolidays, easterSunday } from './holidays';
import { dateRangeData, personData } from './pdf-data';
import {
  byQueueOrder,
  byRotationOrder,
  canTake,
  isPlaceholder,
  queueMembers,
  slotRestriction,
  type Assignment,
  type Person,
  type ScheduleType,
  type Slot,
  type WirteDay,
} from './types';
import { WEEKDAYS_SHORT, weekday } from '../dates';

const none = dayRules();
const weekdayShort = (date: string) => WEEKDAYS_SHORT[weekday(date)];
/** Reihen wie im Rotationsdialog: alle, die den Dienst machen, in Listenreihenfolge */
const queuesOf = (type: ScheduleType, list: Person[]): RotationQueues => ({
  schiessabend: list.filter((p) => canTake(type, p, 'schiessabend')),
  ...(type === 'wirte' ? { fruehschoppen: list.filter((p) => canTake(type, p, 'fruehschoppen')) } : {}),
});
const custom = (...dates: string[]) => dayRules(dates);
const season2627 = [{ start: '2026-10-17', end: '2027-03-13' }];
let nextId = 1;
const a = (date: string, person: string, slot?: string | null, color = '#e57373'): Assignment => ({
  id: `a${nextId++}`,
  date,
  person,
  color,
  slot,
});
const day = (date: string, description = 'Feiertag'): WirteDay => ({
  id: `d-${date}`,
  date,
  description,
  type: 'holiday',
});

describe('Diensttage', () => {
  it('erkennt Schießabende (Samstag und 26.12.)', () => {
    expect(isShootingDay('2026-10-17')).toBe(true); // Samstag
    expect(isShootingDay('2026-10-18')).toBe(false); // Sonntag
    expect(isShootingDay('2025-12-26')).toBe(true); // Freitag, 2. Weihnachtsfeiertag
  });

  it('liefert die erwarteten Wirte-Dienste', () => {
    expect(expectedSlots('wirte', '2026-10-17', none)).toEqual(['schiessabend']);
    expect(expectedSlots('wirte', '2026-10-18', none)).toEqual(['fruehschoppen']);
    expect(expectedSlots('wirte', '2026-10-21', none)).toEqual([]);
    expect(expectedSlots('wirte', '2026-10-03', custom('2026-10-03'))).toEqual(['fruehschoppen', 'schiessabend']);
    expect(expectedSlots('wirte', '2026-11-01', custom('2026-11-01'))).toEqual(['fruehschoppen']); // Sonntag
    expect(expectedSlots('wirte', '2026-05-14', custom('2026-05-14'))).toEqual(['fruehschoppen']); // Donnerstag
  });

  it('liefert die erwarteten Aufsicht-Dienste', () => {
    expect(expectedSlots('aufsicht', '2026-10-17', none)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2026-10-18', custom('2026-10-18'))).toEqual([]);
    expect(expectedSlots('aufsicht', '2025-12-26', none)).toEqual(['schiessabend']);
  });

  it('kennt im Sommer keine Schießabende – Feiertag am Sommer-Samstag nur mit Frühschoppen', () => {
    expect(expectedSlots('wirte', '2027-06-12', none)).toEqual([]); // Samstag im Juni
    expect(expectedSlots('aufsicht', '2027-06-12', none)).toEqual([]);
    expect(expectedSlots('wirte', '2027-05-01', custom('2027-05-01'))).toEqual(['fruehschoppen']); // Tag der Arbeit, Samstag
    expect(expectedSlots('wirte', '2027-06-13', none)).toEqual(['fruehschoppen']); // Sonntag bleibt
    // Winter-Samstag mit Feiertag: beides
    expect(expectedSlots('wirte', '2026-10-03', custom('2026-10-03'))).toEqual(['fruehschoppen', 'schiessabend']);
  });

  it('richtet Schießaufsicht und Wirte-Schießabende nach Anfangs- und Endschießen', () => {
    const rules = dayRules([], season2627);
    expect(expectedSlots('aufsicht', '2026-10-10', rules)).toEqual([]); // vor dem Anfangsschießen
    expect(expectedSlots('aufsicht', '2026-10-17', rules)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2027-01-30', rules)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2027-03-20', rules)).toEqual([]); // nach dem Endschießen
    expect(expectedSlots('wirte', '2026-10-10', rules)).toEqual([]); // vor dem Anfangsschießen auch kein Wirt
    expect(expectedSlots('wirte', '2026-10-17', rules)).toEqual(['schiessabend']);
    expect(expectedSlots('wirte', '2027-03-13', rules)).toEqual(['schiessabend']); // Endschießen
    expect(expectedSlots('wirte', '2027-03-20', rules)).toEqual([]); // nach dem Endschießen
    expect(expectedSlots('wirte', '2027-03-21', rules)).toEqual(['fruehschoppen']); // Sonntag bleibt
    // Feiertag an einem Samstag vor dem Anfangsschießen: nur Frühschoppen
    expect(expectedSlots('wirte', '2026-10-03', dayRules(['2026-10-03'], season2627))).toEqual(['fruehschoppen']);
    // Anfangsschießen schon im September: dann auch Wirt und Aufsicht
    const early = dayRules([], [{ start: '2027-09-25', end: null }]);
    expect(expectedSlots('aufsicht', '2027-09-25', early)).toEqual(['schiessabend']);
    expect(expectedSlots('wirte', '2027-09-25', early)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2028-03-25', early)).toEqual(['schiessabend']); // ohne Endschießen bis 31.03.
    expect(expectedSlots('aufsicht', '2028-04-01', early)).toEqual([]);
  });

  it('ordnet alte Einträge an Sommer-Samstagen dem Abend zu', () => {
    expect(effectiveSlot('wirte', { date: '2027-06-12', slot: null }, none)).toBe('schiessabend');
    expect(effectiveSlot('wirte', { date: '2027-05-01', slot: null }, custom('2027-05-01'))).toBe('fruehschoppen');
  });

  it('ordnet ältere Einträge ohne Slot richtig zu', () => {
    expect(effectiveSlot('wirte', { date: '2026-10-17', slot: 'default' }, none)).toBe('schiessabend');
    expect(effectiveSlot('wirte', { date: '2026-10-18' }, none)).toBe('fruehschoppen');
    expect(effectiveSlot('wirte', { date: '2026-10-03', slot: null }, custom('2026-10-03'))).toBe('schiessabend');
    expect(effectiveSlot('wirte', { date: '2026-10-17', slot: 'fruehschoppen' }, none)).toBe('fruehschoppen');
    expect(effectiveSlot('aufsicht', { date: '2026-10-17', slot: 'fruehschoppen' }, none)).toBe('schiessabend');
  });

  it('liest auch alte Tauschanfragen mit Slot im Datum', () => {
    expect(swapTarget({ date: '2026-01-10-schiessabend' })).toEqual({ date: '2026-01-10', slot: 'schiessabend' });
    expect(swapTarget({ date: '2026-01-11' })).toEqual({ date: '2026-01-11', slot: null });
    expect(swapTarget({ date: '2026-01-11', slot: 'fruehschoppen' })).toEqual({ date: '2026-01-11', slot: 'fruehschoppen' });
  });
});

describe('Monatsansicht', () => {
  it('berechnet Status und Duplikate je Tag', () => {
    const days = buildMonth('wirte', '2026-10', {
      assignments: [
        a('2026-10-17', 'Anna', 'schiessabend'),
        a('2026-10-03', 'Bert', 'fruehschoppen'),
        a('2026-10-18', 'Carl', 'fruehschoppen'),
        a('2026-10-18', 'Dora', null), // Duplikat (Sonntag ohne Slot = Frühschoppen)
        a('2026-10-21', 'Emil', 'default'), // Mittwoch – nicht vorgesehen
      ],
      notes: [{ id: 'n1', date: '2026-10-17', note: 'Anfangsschießen' }],
      wirteDays: [day('2026-10-03', 'Tag der Deutschen Einheit')],
    });
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(days).toHaveLength(31);
    expect(byDate['2026-10-17']!.status).toBe('complete');
    expect(byDate['2026-10-17']!.note?.note).toBe('Anfangsschießen');
    expect(byDate['2026-10-03']!.status).toBe('partial'); // Feiertag am Samstag: Frühschoppen + Schießabend
    expect(byDate['2026-10-03']!.customDay?.description).toBe('Tag der Deutschen Einheit');
    expect(byDate['2026-10-18']!.slots[0]!.assignment?.person).toBe('Carl');
    expect(byDate['2026-10-18']!.slots[0]!.duplicates.map((d) => d.person)).toEqual(['Dora']);
    expect(byDate['2026-10-24']!.status).toBe('missing');
    expect(byDate['2026-10-21']!.status).toBe('orphan');
    expect(byDate['2026-10-20']!.status).toBe('disabled');
  });

  it('zählt offene Dienste', () => {
    const data = { assignments: [a('2026-10-17', 'Anna', 'schiessabend')], notes: [], wirteDays: [] };
    expect(countOpenSlots('wirte', ['2026-10-17', '2026-10-18', '2026-10-24'], data)).toBe(2);
    expect(countOpenSlots('aufsicht', ['2026-10-17', '2026-10-18'], { ...data, assignments: [] })).toBe(1);
  });
});

describe('Konflikte', () => {
  it('meldet Wirt am Schießabend und Aufsicht gleichzeitig', () => {
    const wirte = [a('2026-10-17', 'Anna', 'schiessabend'), a('2026-10-24', 'Bert', 'fruehschoppen')];
    const aufsicht = [a('2026-10-17', 'Anna'), a('2026-10-24', 'Bert')];
    expect(findConflicts(wirte, aufsicht, none)).toEqual([{ date: '2026-10-17', person: 'Anna' }]);
  });

  it('prüft vor dem Einteilen', () => {
    const wirte = [a('2026-10-17', 'Anna', 'schiessabend')];
    expect(eveningConflict('aufsicht', 'Anna', '2026-10-17', wirte, none)?.person).toBe('Anna');
    expect(eveningConflict('aufsicht', 'Bert', '2026-10-17', wirte, none)).toBeUndefined();
    const fruehschoppen = [a('2026-10-17', 'Anna', 'fruehschoppen')];
    expect(eveningConflict('aufsicht', 'Anna', '2026-10-17', fruehschoppen, none)).toBeUndefined();
  });
});

describe('Auto-Rotation', () => {
  const persons: Person[] = [
    { id: '1', name: 'Anna', color: '#e57373' },
    { id: '2', name: 'Bert', color: '#64b5f6' },
    { id: '3', name: 'Carl', color: '#81c784' },
  ];

  it('sammelt die passenden Dienste im Zeitraum', () => {
    const entries = rotationEntries(
      'wirte',
      '2026-10-01',
      '2026-10-18',
      { includeSaturdays: true, includeSundays: true, includeHolidays: true },
      custom('2026-10-03'),
    );
    expect(entries).toEqual([
      { date: '2026-10-03', slot: 'fruehschoppen' },
      { date: '2026-10-03', slot: 'schiessabend' },
      { date: '2026-10-04', slot: 'fruehschoppen' },
      { date: '2026-10-10', slot: 'schiessabend' },
      { date: '2026-10-11', slot: 'fruehschoppen' },
      { date: '2026-10-17', slot: 'schiessabend' },
      { date: '2026-10-18', slot: 'fruehschoppen' },
    ]);
    const onlySaturdays = rotationEntries(
      'wirte',
      '2026-10-01',
      '2026-10-18',
      { includeSaturdays: true, includeSundays: false, includeHolidays: false },
      custom('2026-10-03'),
    );
    expect(onlySaturdays.map((e) => e.date)).toEqual(['2026-10-03', '2026-10-10', '2026-10-17']);
  });

  it('nimmt den Weihnachts-Schießabend der Wirte nur mit den Schießabenden auf, nicht mit den Feiertagen', () => {
    const xmas = custom('2026-12-25', '2026-12-26');
    const holidaysOnly = rotationEntries(
      'wirte',
      '2026-12-24',
      '2026-12-27',
      { includeSaturdays: false, includeSundays: true, includeHolidays: true },
      xmas,
    );
    expect(holidaysOnly).toEqual([
      { date: '2026-12-25', slot: 'fruehschoppen' },
      { date: '2026-12-26', slot: 'fruehschoppen' },
      { date: '2026-12-27', slot: 'fruehschoppen' },
    ]);
    const eveningsOnly = rotationEntries(
      'wirte',
      '2026-12-24',
      '2026-12-27',
      { includeSaturdays: true, includeSundays: false, includeHolidays: false },
      xmas,
    );
    expect(eveningsOnly).toEqual([{ date: '2026-12-26', slot: 'schiessabend' }]);
    // Aufsicht: 26.12. weiterhin über den eigenen Haken wählbar
    expect(
      rotationEntries('aufsicht', '2026-12-24', '2026-12-27', { includeSaturdays: false, includeSundays: false, includeHolidays: true }, none),
    ).toEqual([{ date: '2026-12-26', slot: 'schiessabend' }]);
  });

  it('verteilt reihum in der Reihenfolge der Liste und ersetzt bestehende Einträge im Zeitraum', () => {
    const entries = [
      { date: '2026-10-10', slot: 'schiessabend' as const },
      { date: '2026-10-17', slot: 'schiessabend' as const },
      { date: '2026-10-24', slot: 'schiessabend' as const },
      { date: '2026-10-31', slot: 'schiessabend' as const },
    ];
    const plan = planRotation({
      type: 'wirte',
      entries,
      queues: queuesOf('wirte', persons),
      existing: [a('2026-09-26', 'Anna', 'schiessabend'), a('2026-10-17', 'Bert', 'schiessabend')],
      otherType: [],
      rules: none,
    });
    expect(plan.creates.map((c) => c.person)).toEqual(['Anna', 'Bert', 'Carl', 'Anna']);
    expect(plan.deleteIds).toHaveLength(1);
    expect(plan.uniqueDays).toBe(4);
  });

  it('läuft je Dienst immer wieder in der festgelegten Reihenfolge durch', () => {
    const order: Person[] = [
      { id: '4', name: 'Dora', color: '#ffb74d', slots: ['schiessabend'] },
      { id: '1', name: 'Anna', color: '#e57373', slots: ['fruehschoppen'] },
      { id: '3', name: 'Carl', color: '#81c784', slots: ['schiessabend'] },
      { id: '2', name: 'Bert', color: '#64b5f6', slots: ['fruehschoppen'] },
      { id: '5', name: 'Emil', color: '#f06292', slots: ['schiessabend'] },
    ];
    const entries = rotationEntries('wirte', '2026-10-17', '2026-12-06', { includeSaturdays: true, includeSundays: true, includeHolidays: true }, none);
    const plan = planRotation({ type: 'wirte', entries, queues: queuesOf('wirte', order), existing: [], otherType: [], rules: none });
    const column = (slot: string) => plan.creates.filter((c) => c.slot === slot).map((c) => c.person);
    expect(column('schiessabend')).toEqual(['Dora', 'Carl', 'Emil', 'Dora', 'Carl', 'Emil', 'Dora', 'Carl']);
    expect(column('fruehschoppen')).toEqual(['Anna', 'Bert', 'Anna', 'Bert', 'Anna', 'Bert', 'Anna', 'Bert']);
  });

  it('teilt jeden nur für seine Dienste ein – wer übersprungen wird, kommt beim nächsten passenden Dienst dran', () => {
    const team: Person[] = [
      { id: '1', name: 'Alex', color: '#81c784', slots: ['fruehschoppen'] },
      { id: '2', name: 'Benno', color: '#e57373' },
      { id: '3', name: 'Carl', color: '#64b5f6' },
      { id: '4', name: 'Dora', color: '#ffb74d' },
      { id: '5', name: 'Emil', color: '#f06292' },
    ];
    const entries = rotationEntries('wirte', '2026-10-17', '2026-11-15', { includeSaturdays: true, includeSundays: true, includeHolidays: true }, none);
    const plan = planRotation({ type: 'wirte', entries, queues: queuesOf('wirte', team), existing: [], otherType: [], rules: none });
    // Schießabend-Reihe: Benno, Carl, Dora, Emil – Frühschoppen-Reihe: Alex, Benno, Carl, Dora, Emil – beide strikt
    expect(plan.creates.map((c) => `${weekdayShort(c.date)} ${c.person}`)).toEqual([
      'Sa Benno',
      'So Alex',
      'Sa Carl',
      'So Benno', // Schießabend und Frühschoppen an zwei Wochenenden hintereinander sind erlaubt
      'Sa Dora',
      'So Carl',
      'Sa Emil',
      'So Dora',
      'Sa Benno', // zweite Runde der Schießabende
      'So Emil',
    ]);
    expect(plan.creates.filter((c) => c.person === 'Alex').every((c) => c.slot === 'fruehschoppen')).toBe(true);
    expect(findStreaks(plan.creates.map((c, i) => ({ id: `r${i}`, ...c })), '2026-10-01')).toEqual([]);
  });

  it('weicht der Schießaufsicht nur am selben Wochenende aus – eine Woche davor bleibt die Reihenfolge', () => {
    const plan = planRotation({
      type: 'wirte',
      entries: [
        { date: '2026-10-17', slot: 'schiessabend' },
        { date: '2026-10-24', slot: 'schiessabend' },
        { date: '2026-10-25', slot: 'fruehschoppen' },
      ],
      queues: queuesOf('wirte', persons),
      existing: [],
      otherType: [a('2026-10-10', 'Anna'), a('2026-10-24', 'Bert')],
      rules: none,
    });
    // Anna hatte eine Woche vorher Aufsicht → trotzdem dran; Bert hat am 24.10. Aufsicht → weder Wirt am Abend noch am
    // Sonntag danach. Am 25.10. bleibt nur Anna (Carl war am Vorabend dran) – mit drei Leuten geht es nicht anders.
    expect(plan.creates.map((c) => `${c.date.slice(5)} ${c.person}`)).toEqual(['10-17 Anna', '10-24 Carl', '10-25 Anna']);
  });

  it('lässt Dienste stehen, die keine der ausgewählten Personen übernehmen kann', () => {
    const morningOnly: Person[] = persons.map((p) => ({ ...p, slots: ['fruehschoppen'] }));
    const evening = a('2026-10-17', 'Dora', 'schiessabend');
    const plan = planRotation({
      type: 'wirte',
      entries: [
        { date: '2026-10-17', slot: 'schiessabend' },
        { date: '2026-10-18', slot: 'fruehschoppen' },
      ],
      queues: queuesOf('wirte', morningOnly),
      existing: [evening],
      otherType: [],
      rules: none,
    });
    expect(plan.creates.map((c) => `${c.slot}:${c.person}`)).toEqual(['fruehschoppen:Anna']);
    expect(plan.unfillable).toEqual([{ date: '2026-10-17', slot: 'schiessabend' }]);
    expect(plan.deleteIds).not.toContain(evening.id);
  });

  describe('Gruppen wie im Verein: nur Schießabend, nur Frühschoppen, beides', () => {
    const team: Person[] = [
      { id: '1', name: 'Ada', color: '', slots: ['fruehschoppen'] },
      { id: '2', name: 'Ben', color: '' },
      { id: '3', name: 'Mia', color: '', slots: ['schiessabend'] },
      { id: '4', name: 'Cem', color: '', slots: ['fruehschoppen'] },
      { id: '5', name: 'Fay', color: '', slots: ['fruehschoppen'] },
      { id: '6', name: 'Hal', color: '' },
      { id: '7', name: 'Kai', color: '', slots: ['schiessabend'] },
      { id: '8', name: 'Max', color: '', slots: ['schiessabend'] },
      { id: '9', name: 'Rob', color: '' },
    ];
    const evenings = { includeSaturdays: true, includeSundays: false, includeHolidays: false };
    const mornings = { includeSaturdays: false, includeSundays: true, includeHolidays: true };
    const everything = { includeSaturdays: true, includeSundays: true, includeHolidays: true };
    function rotate(runs: [string, string, RotationDayOptions, Person[]][]) {
      let all: Assignment[] = [];
      runs.forEach(([start, end, options, active], r) => {
        const plan = planRotation({ type: 'wirte', entries: rotationEntries('wirte', start, end, options, none), queues: queuesOf('wirte', active), existing: all, otherType: [], rules: none });
        const deleted = new Set(plan.deleteIds);
        all = [...all.filter((x) => !deleted.has(x.id)), ...plan.creates.map((c, i) => ({ id: `r${r}-${i}`, ...c }))];
      });
      return all;
    }
    const count = (all: Assignment[], name: string, slot?: string) => all.filter((x) => x.person === name && (!slot || x.slot === slot)).length;

    /** Plätze in der Reihe bis zum nächsten Dienst derselben Person (reihum mit n Personen: n). */
    const distances = (names: string[]) =>
      names.flatMap((name, i) => {
        const next = names.indexOf(name, i + 1);
        return next > 0 ? [next - i] : [];
      });
    const column = (all: Assignment[], slot: string) =>
      all.filter((x) => x.slot === slot).sort((x, y) => x.date.localeCompare(y.date)).map((x) => x.person);

    it('getrennte Läufe (erst Schießabende, dann Frühschoppen): jede Reihe läuft durch, nie zwei Wochenenden hintereinander', () => {
      // Fehlerfall aus dem Live-Betrieb: Benno, Hans und Roland hatten Schießabend am Samstag und Frühschoppen am Sonntag
      // eine Woche später; danach lief eine Reihe nur einmal sauber durch und wurde dann willkürlich.
      const all = rotate([
        ['2026-10-17', '2027-12-31', evenings, team.filter((p) => canTake('wirte', p, 'schiessabend'))],
        ['2026-10-17', '2027-12-31', mornings, team.filter((p) => canTake('wirte', p, 'fruehschoppen'))],
      ]);
      const evening = column(all, 'schiessabend');
      expect(evening.slice(0, 12)).toEqual(['Ben', 'Mia', 'Hal', 'Kai', 'Max', 'Rob', 'Ben', 'Mia', 'Hal', 'Kai', 'Max', 'Rob']);
      expect(new Set(distances(evening))).toEqual(new Set([6])); // jede Runde exakt in der Reihenfolge
      // Frühschoppen: Ben, Hal und Rob tauschen gelegentlich einen Platz, wenn sie am Wochenende davor/danach Schießabend haben
      const morning = distances(column(all, 'fruehschoppen'));
      expect(Math.min(...morning)).toBeGreaterThanOrEqual(4);
      expect(morning.filter((d) => d === 6).length / morning.length).toBeGreaterThan(0.75);
      expect(findStreaks(all, '2026-01-01')).toEqual([]);
      expect(all.every((x) => canTake('wirte', team.find((p) => p.name === x.person)!, x.slot as Slot))).toBe(true);
    });

    it('macht nach dem Sommer bei den Schießabenden dort weiter, wo sie aufgehört haben', () => {
      const all = rotate([['2027-03-01', '2028-03-31', everything, team]]);
      expect(findStreaks(all, '2027-01-01')).toEqual([]);
      // Sommer ohne Schießabende: die Reihe pausiert und läuft im Herbst einfach weiter
      for (const d of distances(column(all, 'schiessabend'))) expect(d).toBeGreaterThanOrEqual(5);
      for (const d of distances(column(all, 'schiessabend'))) expect(d).toBeLessThanOrEqual(7);
      for (const name of ['Mia', 'Kai', 'Max']) expect(count(all.filter((x) => x.date >= '2027-10-01'), name)).toBeLessThanOrEqual(5);
      // im Sommer reihum nur die Frühschoppen-Leute, in fester Reihenfolge
      const summer = all.filter((x) => x.date >= '2027-05-01' && x.date <= '2027-08-31').map((x) => x.person);
      expect([...summer.slice(0, 6)].sort()).toEqual(['Ada', 'Ben', 'Cem', 'Fay', 'Hal', 'Rob']);
      summer.slice(6).forEach((name, i) => expect(name).toBe(summer[i])); // alle 6 Dienste wieder dieselbe Reihe
    });

    it('ein gemeinsamer Lauf ergibt bei Wiederholung dasselbe', () => {
      const once = rotate([['2026-10-17', '2027-12-31', everything, team]]);
      const twice = rotate([
        ['2026-10-17', '2027-12-31', everything, team],
        ['2026-10-17', '2027-12-31', everything, team],
      ]);
      const key = (l: Assignment[]) => l.map((x) => `${x.date}|${x.slot}|${x.person}`).sort();
      expect(key(twice)).toEqual(key(once));
    });
  });

  describe('zwei feste Reihen: erst Schießabende, dann Frühschoppen passend dazu', () => {
    const team: Person[] = [
      { id: '1', name: 'Ada', color: '', slots: ['fruehschoppen'] },
      { id: '2', name: 'Ben', color: '' },
      { id: '3', name: 'Mia', color: '', slots: ['schiessabend'] },
      { id: '4', name: 'Cem', color: '', slots: ['fruehschoppen'] },
      { id: '5', name: 'Fay', color: '', slots: ['fruehschoppen'] },
      { id: '6', name: 'Hal', color: '' },
      { id: '7', name: 'Kai', color: '', slots: ['schiessabend'] },
      { id: '8', name: 'Max', color: '', slots: ['schiessabend'] },
      { id: '9', name: 'Rob', color: '' },
    ];
    const evening = queueMembers('wirte', team, 'schiessabend');
    const morning = queueMembers('wirte', team, 'fruehschoppen');
    const saturdays = rotationEntries('wirte', '2026-10-17', '2027-03-13', { includeSaturdays: true, includeSundays: false, includeHolidays: false }, none);
    const sundays = rotationEntries('wirte', '2026-10-18', '2027-03-14', { includeSaturdays: false, includeSundays: true, includeHolidays: true }, none);
    const base = { type: 'wirte' as const, existing: [], otherType: [], rules: none };

    it('Samstage laufen exakt 1 bis x und wieder von vorne, Sonntage weichen nur am selben Wochenende aus', () => {
      const plan = planInSequence(
        [
          { entries: saturdays, queues: { schiessabend: evening } },
          { entries: sundays, queues: { fruehschoppen: morning } },
        ],
        base,
      );
      const sat = plan.creates.filter((c) => c.slot === 'schiessabend').map((c) => c.person);
      expect(sat).toEqual(saturdays.map((_, i) => evening[i % evening.length]!.name));
      expect(plan.creates.filter((c) => c.slot === 'fruehschoppen')).toHaveLength(sundays.length);
      // niemand am selben Wochenende doppelt
      const all = applyPlan([], plan);
      expect(findBackToBack(all, '2026-10-01', '2027-03-31').every((b) => daysApart(b.first, b.second) > 1)).toBe(true);
    });

    it('richtet die Schießabende nicht nach alten Sonntagen, die derselbe Lauf ersetzt', () => {
      // Hal stünde am 31.10. als Wirt an der Reihe – ein alter Frühschoppen am 01.11. darf das nicht verschieben
      const old = a('2026-11-01', 'Hal', 'fruehschoppen');
      const plan = planInSequence(
        [
          { entries: saturdays, queues: { schiessabend: evening } },
          { entries: sundays, queues: { fruehschoppen: morning } },
        ],
        { ...base, existing: [old] },
      );
      expect(plan.creates.filter((c) => c.slot === 'schiessabend').map((c) => c.person).slice(0, 6)).toEqual(evening.map((p) => p.name));
      expect(plan.deleteIds).toEqual([old.id]);
      expect(plan.swaps.filter((s) => s.slot === 'schiessabend')).toEqual([]);
    });

    it('findet die Sonntags-Reihenfolge mit den wenigsten Wochenenden hintereinander', () => {
      const withSaturdays = applyPlan([], planRotation({ ...base, entries: saturdays, queues: { schiessabend: evening } }));
      const result = bestOrder({ ...base, slot: 'fruehschoppen', entries: sundays, current: morning, existing: withSaturdays });
      expect(result.tried).toBe(721); // 6 Personen: alle 720 Reihenfolgen + die bisherige
      expect([...result.best.order].sort((a, b) => a.name.localeCompare(b.name))).toEqual(
        [...morning].sort((a, b) => a.name.localeCompare(b.name)),
      );
      expect(result.best.backToBack.length).toBeLessThanOrEqual(result.current.backToBack.length);
      expect(result.best.backToBack.length).toBeLessThan(result.current.backToBack.length); // hier echt besser
      // Ergebnis der Berechnung = was die Rotation mit dieser Reihenfolge einteilt
      const plan = planRotation({ ...base, entries: sundays, queues: { fruehschoppen: result.best.order }, existing: withSaturdays });
      expect(findBackToBack(applyPlan(withSaturdays, plan), '2026-10-18', '2027-03-14')).toEqual(result.best.backToBack);
    });

    it('zählt Wochenenden hintereinander (höchstens 8 Tage), nicht aber ein freies Wochenende dazwischen', () => {
      const list = [a('2026-10-17', 'Ben', 'schiessabend'), a('2026-10-25', 'Ben', 'fruehschoppen'), a('2026-11-08', 'Ben', 'fruehschoppen')];
      expect(findBackToBack(list, '2026-10-01', '2026-12-31')).toEqual([{ person: 'Ben', first: '2026-10-17', second: '2026-10-25' }]);
    });

    it('macht nach der zuletzt eingeteilten Person weiter und merkt sich die Reihenfolge je Reihe', () => {
      const [x, y, z] = team;
      expect(continueAfterLast([x!, y!, z!], { person: y!.name }).map((p) => p.name)).toEqual(['Mia', 'Ada', 'Ben']);
      expect(continueAfterLast([x!, y!, z!], null)).toEqual([x, y, z]);
      expect(continueAfterLast([x!, y!, z!], { person: 'Unbekannt' })).toEqual([x, y, z]);
      const saved: Person[] = [
        { id: '1', name: 'Ada', color: '', rotationOrders: { fruehschoppen: 1 } },
        { id: '2', name: 'Ben', color: '', rotationOrders: { fruehschoppen: 0, schiessabend: 1 }, rotationOrder: 5 },
        { id: '3', name: 'Cem', color: '', rotationOrders: { schiessabend: 0 } },
      ];
      expect([...saved].sort(byQueueOrder('fruehschoppen')).map((p) => p.name)).toEqual(['Ben', 'Ada', 'Cem']);
      expect([...saved].sort(byQueueOrder('schiessabend')).map((p) => p.name)).toEqual(['Cem', 'Ben', 'Ada']);
    });
  });

  it('nennt die letzte Einteilung vor dem Start und beachtet die Dienstauswahl nur bei den Wirten', () => {
    const list = [a('2026-10-04', 'Anna'), a('2026-10-11', 'Bert'), a('2026-10-17', 'Carl'), a('2026-10-10', 'Fremd')];
    expect(lastBeforeStart('wirte', list, persons, 'fruehschoppen', '2026-10-13', none)?.person).toBe('Bert');
    expect(lastBeforeStart('wirte', list, persons, 'schiessabend', '2026-10-13', none)).toBeNull(); // „Fremd“ zählt nicht
    expect(lastBeforeStart('wirte', [], persons, 'fruehschoppen', '2026-10-13', none)).toBeNull();
    const alex = { slots: ['fruehschoppen'] as Slot[] };
    expect(canTake('wirte', alex, 'schiessabend')).toBe(false);
    expect(canTake('wirte', alex, 'fruehschoppen')).toBe(true);
    expect(canTake('aufsicht', alex, 'schiessabend')).toBe(true);
    expect(canTake('wirte', {}, 'schiessabend')).toBe(true);
    expect(slotRestriction('wirte', alex)).toBe('nur Frühschoppen');
    expect(slotRestriction('wirte', {})).toBeNull();
    const sorted = [
      { id: '1', name: 'Zora', color: '', rotationOrder: 1 },
      { id: '2', name: 'Anna', color: '' },
      { id: '3', name: 'Max', color: '', rotationOrder: 0 },
    ].sort(byRotationOrder);
    expect(sorted.map((p) => p.name)).toEqual(['Max', 'Zora', 'Anna']);
  });

  it('vermeidet Konflikte mit der Schießaufsicht und Doppeldienste am selben Tag', () => {
    const plan = planRotation({
      type: 'wirte',
      entries: [
        { date: '2026-10-03', slot: 'fruehschoppen' },
        { date: '2026-10-03', slot: 'schiessabend' },
      ],
      queues: queuesOf('wirte', persons),
      existing: [],
      otherType: [a('2026-10-03', 'Bert')],
      rules: custom('2026-10-03'),
    });
    expect(plan.creates.map((c) => `${c.slot}:${c.person}`)).toEqual(['fruehschoppen:Anna', 'schiessabend:Carl']);
  });

  it('übergeht niemanden, der schon weit in der Zukunft eingeplant ist', () => {
    // Fehlerfall aus dem Live-Betrieb: ein alter Sonntagsplan bis 2028 ließ Bert und Carl nie an die Reihe kommen
    const four: Person[] = [...persons, { id: '4', name: 'Dora', color: '#ffb74d' }];
    const entries = rotationEntries(
      'wirte',
      '2026-10-17',
      '2026-12-05',
      { includeSaturdays: true, includeSundays: false, includeHolidays: false },
      none,
    );
    const plan = planRotation({
      type: 'wirte',
      entries,
      queues: queuesOf('wirte', four),
      existing: [a('2028-03-05', 'Bert', 'fruehschoppen'), a('2028-03-12', 'Carl', 'fruehschoppen'), a('2026-10-10', 'Anna', 'schiessabend')],
      otherType: [],
      rules: none,
    });
    const count = (name: string) => plan.creates.filter((c) => c.person === name).length;
    expect(entries).toHaveLength(8);
    expect(['Anna', 'Bert', 'Carl', 'Dora'].map(count)).toEqual([2, 2, 2, 2]);
  });

  it('lässt Platzhalter wie „Kein Schießen“ stehen und teilt sie nicht ein', () => {
    const marker = a('2027-01-30', 'Kein Schießen');
    const plan = planRotation({
      type: 'aufsicht',
      entries: [
        { date: '2027-01-23', slot: 'schiessabend' },
        { date: '2027-01-30', slot: 'schiessabend' },
        { date: '2027-02-06', slot: 'schiessabend' },
      ],
      queues: queuesOf('aufsicht', [...persons, { id: '4', name: 'Kein Schießen', color: '#90a4ae' }]),
      existing: [marker],
      otherType: [],
      rules: none,
    });
    expect(plan.creates.map((c) => `${c.date}:${c.person}`)).toEqual(['2027-01-23:Anna', '2027-02-06:Bert']);
    expect(plan.deleteIds).not.toContain(marker.id);
    expect(plan.skipped).toEqual([{ date: '2027-01-30', slot: 'schiessabend' }]);
    expect(plan.uniqueDays).toBe(2);
  });
});

describe('Mehrere Dienste innerhalb einer Woche', () => {
  const persons: Person[] = [
    { id: '1', name: 'Hans', color: '#4db6ac' },
    { id: '2', name: 'Benno', color: '#e57373' },
    { id: '3', name: 'Franz', color: '#f06292' },
    { id: '4', name: 'Alex', color: '#81c784' },
  ];

  it('findet Dienste am selben Wochenende und denselben Dienst zwei Wochen in Folge (ab heute)', () => {
    const list = [
      a('2026-10-17', 'Hans', null),
      a('2026-10-18', 'Hans', null),
      a('2026-10-24', 'Benno', null),
      a('2026-10-25', 'Benno', null),
      a('2026-10-31', 'Benno', null),
      a('2026-11-07', 'Franz', null),
      a('2026-11-14', 'Franz', null), // zwei Samstage hintereinander
      a('2026-11-28', 'Alex', null),
      a('2026-12-06', 'Alex', null), // Schießabend + Frühschoppen am Wochenende danach – erlaubt
      a('2026-12-19', 'Hans', null),
      a('2027-01-02', 'Hans', null), // ein Wochenende frei dazwischen – in Ordnung
      a('2026-10-03', 'Alex', null),
      a('2026-10-04', 'Alex', null), // Vergangenheit
      a('2027-01-30', 'Kein Schießen'),
      a('2027-02-06', 'Kein Schießen'),
    ];
    const streaks = findStreaks(list, '2026-10-11');
    expect(streaks.map((s) => `${s.person}:${s.assignments.map((x) => x.date.slice(5)).join('+')}`)).toEqual([
      'Hans:10-17+10-18',
      'Benno:10-24+10-25+10-31',
      'Franz:11-07+11-14',
    ]);
  });

  it('gibt die weiteren Dienste ab und schlägt bevorzugt jemanden mit einer Woche Abstand vor', () => {
    const list = [
      a('2026-10-24', 'Benno', null),
      a('2026-10-25', 'Benno', null),
      a('2026-10-31', 'Benno', null),
      a('2026-10-18', 'Hans', null), // Hans: 6 Tage vor dem 24.10.
      a('2026-11-21', 'Franz', null),
    ];
    const changes = planStreakFix({ type: 'wirte', assignments: list, otherType: [], persons, rules: none, from: '2026-10-11' });
    // 24.10. bleibt, 25.10. und 31.10. (beide höchstens eine Woche nach dem 24.10.) gehen an andere
    expect(changes.map((c) => c.assignment.date)).toEqual(['2026-10-25', '2026-10-31']);
    expect(changes[0]!.slot).toBe('fruehschoppen');
    expect(changes[1]!.slot).toBe('schiessabend');
    for (const c of changes) expect(c.candidates.map((p) => p.name)).not.toContain('Benno');
    // 25.10.: Alex und Franz haben eine Woche Abstand, Hans (18.10.) nicht – er steht hinten
    expect(changes[0]!.candidates.at(-1)?.name).toBe('Hans');
    // verschiedene Vorschläge
    expect(changes[0]!.candidates[0]!.name).not.toBe(changes[1]!.candidates[0]!.name);
  });

  it('schlägt zum Entzerren nur Personen vor, die den Dienst übernehmen können', () => {
    const team = persons.map((p) => (p.name === 'Alex' ? { ...p, slots: ['fruehschoppen'] as Slot[] } : p));
    const list = [a('2026-10-24', 'Benno', 'schiessabend'), a('2026-10-31', 'Benno', 'schiessabend')];
    const [change] = planStreakFix({ type: 'wirte', assignments: list, otherType: [], persons: team, rules: none, from: '2026-10-11' });
    expect(change!.slot).toBe('schiessabend');
    expect(change!.candidates.map((p) => p.name)).not.toContain('Alex');
    expect(change!.candidates.length).toBeGreaterThan(0);
  });

  it('macht keinen Vorschlag, wenn dadurch eine neue Häufung entstünde', () => {
    const list = [
      a('2026-10-17', 'Hans', null),
      a('2026-10-18', 'Hans', null),
      a('2026-10-21', 'Benno', null),
      a('2026-10-22', 'Franz', null),
      a('2026-10-25', 'Alex', null), // alle hätten den Frühschoppen eine Woche davor/danach
    ];
    const [change] = planStreakFix({ type: 'wirte', assignments: list, otherType: [], persons, rules: none, from: '2026-10-11' });
    expect(change!.suggestion).toBeNull();
    expect(change!.candidates.map((p) => p.name).sort()).toEqual(['Alex', 'Benno', 'Franz']);
    expect([...change!.tight].sort()).toEqual(['Alex', 'Benno', 'Franz']);
  });

  it('lässt per Tausch übernommene Dienste stehen und ändert dann den anderen Tag', () => {
    const swapped: Assignment = { ...a('2026-10-18', 'Hans', 'fruehschoppen'), originalPerson: 'Alex', swappedWith: 'Hans' };
    const changes = planStreakFix({
      type: 'wirte',
      assignments: [a('2026-10-17', 'Hans', 'schiessabend'), swapped],
      otherType: [],
      persons,
      rules: none,
      from: '2026-10-11',
    });
    expect(changes.map((c) => c.assignment.date)).toEqual(['2026-10-17']);
  });

  it('Auto-Rotation hält eine Woche Abstand, wenn genug Leute da sind', () => {
    const entries = rotationEntries(
      'wirte',
      '2026-10-17',
      '2026-12-20',
      { includeSaturdays: true, includeSundays: true, includeHolidays: true },
      none,
    );
    const plan = planRotation({ type: 'wirte', entries, queues: queuesOf('wirte', persons), existing: [], otherType: [], rules: none });
    expect(findStreaks(plan.creates.map((c, i) => ({ id: `r${i}`, ...c })), '2026-10-01')).toEqual([]);
  });

  it('Auto-Rotation vermeidet mit wenigen Leuten wenigstens Tage hintereinander', () => {
    const entries = rotationEntries(
      'wirte',
      '2026-10-17',
      '2026-11-01',
      { includeSaturdays: true, includeSundays: true, includeHolidays: true },
      none,
    );
    const plan = planRotation({ type: 'wirte', entries, queues: queuesOf('wirte', persons.slice(0, 3)), existing: [], otherType: [], rules: none });
    const byPerson = new Map<string, string[]>();
    plan.creates.forEach((c) => byPerson.set(c.person, [...(byPerson.get(c.person) ?? []), c.date]));
    for (const dates of byPerson.values()) {
      for (let i = 1; i < dates.length; i++) expect(daysApart(dates[i - 1]!, dates[i]!)).toBeGreaterThan(1);
    }
  });
});

describe('Platzhalter und Tauschanfragen', () => {
  it('erkennt Platzhalter-Einträge', () => {
    expect(isPlaceholder('Kein Schießen')).toBe(true);
    expect(isPlaceholder('keine Aufsicht')).toBe(true);
    expect(isPlaceholder('Kein')).toBe(true);
    expect(isPlaceholder('Keinath Maria')).toBe(false);
    expect(isPlaceholder('Korbinian Mayer')).toBe(false);
  });

  it('zählt nur Tauschanfragen für heutige oder künftige Dienste als offen', () => {
    const today = '2026-10-11';
    expect(isOpenSwap({ date: '2026-10-17', status: 'pending' }, today)).toBe(true);
    expect(isOpenSwap({ date: '2026-10-11-schiessabend', status: 'pending' }, today)).toBe(true);
    expect(isOpenSwap({ date: '2026-04-19', status: 'pending' }, today)).toBe(false);
    expect(isOpenSwap({ date: '2026-10-17', status: 'completed' }, today)).toBe(false);
  });
});

describe('Duplikate', () => {
  it('behält explizite Einträge und entfernt den Rest', () => {
    const keep = a('2026-10-18', 'Zoe', 'fruehschoppen');
    const old = a('2026-10-18', 'Anna', null);
    const groups = findDuplicates('wirte', [old, keep, a('2026-10-17', 'Bert', 'schiessabend')], none);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.keep.id).toBe(keep.id);
    expect(groups[0]!.remove.map((r) => r.id)).toEqual([old.id]);
  });
});

describe('Saison', () => {
  const notes = [
    { date: '2025-10-18', note: 'Anfangsschießen' },
    { date: '2026-03-14', note: 'Endschiessen' },
    { date: '2026-10-17', note: 'Anfangsschießen 26/27' },
  ];

  it('erkennt Saisons aus den Infos', () => {
    expect(seasonsFromNotes(notes)).toEqual([
      { start: '2025-10-18', end: '2026-03-14' },
      { start: '2026-10-17', end: null },
    ]);
  });

  it('wählt laufende oder nächste Saison', () => {
    const seasons = seasonsFromNotes(notes);
    expect(currentOrNextSeason(seasons, '2026-01-10')?.start).toBe('2025-10-18');
    expect(currentOrNextSeason(seasons, '2026-07-01')?.start).toBe('2026-10-17');
    expect(currentOrNextSeason([], '2026-07-01')).toBeNull();
  });
});

describe('Feiertage', () => {
  it('berechnet Ostern und bewegliche Feiertage', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    const holidays = bavarianHolidays(2026);
    expect(holidays.find((h) => h.name === 'Fronleichnam')?.date).toBe('2026-06-04');
    expect(holidays.find((h) => h.name === 'Karfreitag')?.date).toBe('2026-04-03');
    expect(holidays).toHaveLength(13);
  });
});

describe('PDF-Daten', () => {
  it('teilt Wirte in Schießabend und Frühschoppen', () => {
    const data = dateRangeData({
      type: 'wirte',
      startMonth: '2026-10',
      endMonth: '2026-10',
      assignments: [
        a('2026-10-03', 'Anna', 'fruehschoppen'),
        a('2026-10-03', 'Bert', 'schiessabend'),
        a('2026-10-18', 'Carl', null),
        a('2026-11-01', 'Dora', 'fruehschoppen'),
      ],
      notes: [],
      wirteDays: [day('2026-10-03', 'Tag der Deutschen Einheit')],
    });
    expect(data.left.map((r) => r.name)).toEqual(['Bert']);
    expect(data.right.map((r) => `${r.name}${r.irregular ? '!' : ''}`)).toEqual(['Anna!', 'Carl']);
    expect(data.right[0]!.remark).toBe('Tag der Deutschen Einheit');
  });

  it('filtert die Schießaufsicht auf die Saison', () => {
    const data = dateRangeData({
      type: 'aufsicht',
      startMonth: '2026-01',
      endMonth: '2026-12',
      assignments: [a('2026-03-07', 'Anna'), a('2026-07-11', 'Bert'), a('2026-10-17', 'Carl')],
      notes: [
        { id: 'n1', date: '2025-10-18', note: 'Anfangsschießen' },
        { id: 'n2', date: '2026-03-14', note: 'Endschießen' },
        { id: 'n3', date: '2026-10-17', note: 'Anfangsschießen' },
      ],
      wirteDays: [],
    });
    expect(data.left.map((r) => r.name)).toEqual(['Anna', 'Carl']);
    expect(data.left[1]!.remark).toBe('Anfangsschießen');
  });

  it('erstellt die persönliche Liste', () => {
    const data = personData({
      type: 'wirte',
      person: 'Anna',
      assignments: [a('2026-10-03', 'Anna', 'fruehschoppen'), a('2026-10-10', 'Anna', 'schiessabend'), a('2026-09-05', 'Anna', 'schiessabend')],
      notes: [],
      wirteDays: [day('2026-10-03', 'Tag der Deutschen Einheit')],
      today: '2026-10-01',
    });
    expect(data.rows.map((r) => `${r.date} ${r.slotLabel}`)).toEqual(['2026-10-03 Frühschoppen', '2026-10-10 Schießabend']);
  });
});
