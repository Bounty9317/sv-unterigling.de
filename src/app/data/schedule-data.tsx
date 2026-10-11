import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { col, toAssignment, toNote, toPerson, toSwap, toWirteDay, useLiveCollection } from './collections';
import { seasonsFromNotes } from '../../lib/schedule/season';
import { dayRules, type DayRules } from '../../lib/schedule/slots';
import type { Assignment, DayNote, Person, ScheduleType, SwapRequest, WirteDay } from '../../lib/schedule/types';

type PerType<T> = Record<ScheduleType, T>;

export interface ScheduleData {
  persons: PerType<Person[]>;
  assignments: PerType<Assignment[]>;
  notes: PerType<DayNote[]>;
  swaps: PerType<SwapRequest[]>;
  wirteDays: WirteDay[];
  /** Wirte-Tage und Schießsaisons – bestimmen, an welchen Tagen Dienste gebraucht werden */
  dayRules: DayRules;
  loading: boolean;
  error: unknown;
}

const ScheduleContext = createContext<ScheduleData | null>(null);

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'de');

/** Hält alle Daten der Helfereinteilung in Echtzeit aktuell (für Vorstand und Helfer). */
export function ScheduleDataProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const name = (n: string) => (enabled ? n : null);
  const wirtePersons = useLiveCollection(name(col.persons('wirte')), toPerson);
  const aufsichtPersons = useLiveCollection(name(col.persons('aufsicht')), toPerson);
  const wirteAssignments = useLiveCollection(name(col.assignments('wirte')), toAssignment);
  const aufsichtAssignments = useLiveCollection(name(col.assignments('aufsicht')), toAssignment);
  const wirteNotes = useLiveCollection(name(col.notes('wirte')), toNote);
  const aufsichtNotes = useLiveCollection(name(col.notes('aufsicht')), toNote);
  const wirteSwaps = useLiveCollection(name(col.swaps('wirte')), toSwap);
  const aufsichtSwaps = useLiveCollection(name(col.swaps('aufsicht')), toSwap);
  const wirteDays = useLiveCollection(name(col.wirteDays), toWirteDay);

  const all = [
    wirtePersons,
    aufsichtPersons,
    wirteAssignments,
    aufsichtAssignments,
    wirteNotes,
    aufsichtNotes,
    wirteSwaps,
    aufsichtSwaps,
    wirteDays,
  ];
  const loading = all.some((s) => s.loading);
  const error = all.find((s) => s.error)?.error ?? null;

  const value = useMemo<ScheduleData>(
    () => ({
      persons: { wirte: [...wirtePersons.data].sort(byName), aufsicht: [...aufsichtPersons.data].sort(byName) },
      assignments: { wirte: wirteAssignments.data, aufsicht: aufsichtAssignments.data },
      notes: { wirte: wirteNotes.data, aufsicht: aufsichtNotes.data },
      swaps: { wirte: wirteSwaps.data, aufsicht: aufsichtSwaps.data },
      wirteDays: [...wirteDays.data].sort((a, b) => a.date.localeCompare(b.date)),
      dayRules: dayRules(
        wirteDays.data.map((d) => d.date),
        seasonsFromNotes(aufsichtNotes.data),
      ),
      loading,
      error,
    }),
    [
      wirtePersons.data,
      aufsichtPersons.data,
      wirteAssignments.data,
      aufsichtAssignments.data,
      wirteNotes.data,
      aufsichtNotes.data,
      wirteSwaps.data,
      aufsichtSwaps.data,
      wirteDays.data,
      loading,
      error,
    ],
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule(): ScheduleData {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule außerhalb von ScheduleDataProvider');
  return ctx;
}
