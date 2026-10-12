import { describe, expect, it } from 'vitest';
import { buildMonth, countOpenSlots } from './model';
import { dayRules, effectiveSlot, expectedSlots, isOpenSwap, isShootingDay, swapTarget } from './slots';
import { eveningConflict, findConflicts } from './conflicts';
import { planRotation, rotationEntries } from './rotation';
import { findDuplicates } from './duplicates';
import { daysApart, findStreaks, planStreakFix } from './streaks';
import { currentOrNextSeason, seasonsFromNotes } from './season';
import { bavarianHolidays, easterSunday } from './holidays';
import { dateRangeData, personData } from './pdf-data';
import { isPlaceholder, type Assignment, type Person, type WirteDay } from './types';

const none = dayRules();
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

  it('richtet die Schießaufsicht nach Anfangs- und Endschießen, die Wirte nach Oktober bis März', () => {
    const rules = dayRules([], season2627);
    expect(expectedSlots('aufsicht', '2026-10-10', rules)).toEqual([]); // vor dem Anfangsschießen
    expect(expectedSlots('aufsicht', '2026-10-17', rules)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2027-01-30', rules)).toEqual(['schiessabend']);
    expect(expectedSlots('aufsicht', '2027-03-20', rules)).toEqual([]); // nach dem Endschießen
    expect(expectedSlots('wirte', '2026-10-10', rules)).toEqual(['schiessabend']); // Wirt trotzdem
    expect(expectedSlots('wirte', '2027-03-27', rules)).toEqual(['schiessabend']);
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

  it('verteilt fair nach letzter Einteilung', () => {
    const entries = [
      { date: '2026-10-10', slot: 'schiessabend' as const },
      { date: '2026-10-17', slot: 'schiessabend' as const },
      { date: '2026-10-24', slot: 'schiessabend' as const },
      { date: '2026-10-31', slot: 'schiessabend' as const },
    ];
    const plan = planRotation({
      type: 'wirte',
      entries,
      persons,
      existing: [a('2026-09-26', 'Anna', 'schiessabend'), a('2026-10-17', 'Bert', 'schiessabend')],
      otherType: [],
      rules: none,
    });
    // Berts Eintrag am 17.10. wird ersetzt und zählt nicht: Bert und Carl waren damit „nie dran“
    // (Reihenfolge der Liste entscheidet), danach Anna (26.09.), dann wieder Bert.
    expect(plan.creates.map((c) => c.person)).toEqual(['Bert', 'Carl', 'Anna', 'Bert']);
    expect(plan.deleteIds).toHaveLength(1);
    expect(plan.uniqueDays).toBe(4);
  });

  it('vermeidet Konflikte mit der Schießaufsicht und Doppeldienste am selben Tag', () => {
    const plan = planRotation({
      type: 'wirte',
      entries: [
        { date: '2026-10-03', slot: 'fruehschoppen' },
        { date: '2026-10-03', slot: 'schiessabend' },
      ],
      persons,
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
      persons: four,
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
      persons: [...persons, { id: '4', name: 'Kein Schießen', color: '#90a4ae' }],
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

  it('findet Samstag + Sonntag und zwei Samstage in Folge (ab heute)', () => {
    const list = [
      a('2026-10-17', 'Hans', null),
      a('2026-10-18', 'Hans', null),
      a('2026-10-24', 'Benno', null),
      a('2026-10-25', 'Benno', null),
      a('2026-10-31', 'Benno', null),
      a('2026-11-07', 'Franz', null),
      a('2026-11-14', 'Franz', null), // zwei Samstage hintereinander
      a('2026-11-28', 'Alex', null),
      a('2026-12-06', 'Alex', null), // 8 Tage Abstand – in Ordnung
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

  it('macht keinen Vorschlag, wenn dadurch eine neue Häufung entstünde', () => {
    const list = [
      a('2026-10-17', 'Hans', null),
      a('2026-10-18', 'Hans', null),
      a('2026-10-21', 'Benno', null),
      a('2026-10-22', 'Franz', null),
      a('2026-10-24', 'Alex', null),
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
    const plan = planRotation({ type: 'wirte', entries, persons, existing: [], otherType: [], rules: none });
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
    const plan = planRotation({ type: 'wirte', entries, persons: persons.slice(0, 3), existing: [], otherType: [], rules: none });
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
