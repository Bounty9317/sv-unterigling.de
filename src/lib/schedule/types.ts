/**
 * Datenmodell der Helfereinteilung – kompatibel zu den bestehenden Firestore-Sammlungen:
 *   {typ}-persons, {typ}-assignments, {typ}-notes, {typ}-swaps, wirte-days
 */
export type ScheduleType = 'wirte' | 'aufsicht';
export type Slot = 'fruehschoppen' | 'schiessabend';

export const SCHEDULE_TYPES: ScheduleType[] = ['wirte', 'aufsicht'];
export const SLOTS: Slot[] = ['fruehschoppen', 'schiessabend'];

export const TYPE_LABEL: Record<ScheduleType, string> = {
  wirte: 'Wirte',
  aufsicht: 'Schießaufsicht',
};

export const TYPE_LABEL_SINGULAR: Record<ScheduleType, string> = {
  wirte: 'Wirt',
  aufsicht: 'Schießaufsicht',
};

export const SLOT_LABEL: Record<Slot, string> = {
  fruehschoppen: 'Frühschoppen',
  schiessabend: 'Schießabend',
};

export function slotTime(type: ScheduleType, slot: Slot): string {
  if (slot === 'fruehschoppen') return '10:00–12:00';
  return type === 'aufsicht' ? '19:30–21:00' : '19:30–24:00';
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Assignment {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  person: string;
  color: string;
  /** "fruehschoppen" | "schiessabend" | "default" | fehlt (ältere Einträge) */
  slot?: string | null;
  originalPerson?: string | null;
  swappedWith?: string | null;
}

export interface DayNote {
  id: string;
  date: string;
  note: string;
}

export interface WirteDay {
  id: string;
  date: string;
  description: string;
  type: string;
  createdAt?: string;
}

export interface SwapRequest {
  id: string;
  requestPerson: string;
  /** "YYYY-MM-DD" – ältere Anfragen enthalten zusätzlich den Slot, z. B. "2026-01-10-schiessabend" */
  date: string;
  slot?: Slot | null;
  assignmentId?: string | null;
  requestPersonColor?: string | null;
  replacementPerson?: string | null;
  status: string;
  createdAt?: string;
}

/**
 * Platzhalter statt einer Person, z. B. „Kein Schießen“ an der Generalversammlung.
 * Solche Einträge markieren einen Tag ohne Dienst: kein Countdown, keine Rotation, nicht überschreiben.
 */
export function isPlaceholder(name: string): boolean {
  return /^\s*kein(e[nr]?)?(\s|$)/i.test(name);
}

/** Farben für Helfer-Kacheln (wie bisher). */
export const PERSON_COLORS = [
  '#e57373',
  '#64b5f6',
  '#81c784',
  '#ffb74d',
  '#ba68c8',
  '#4db6ac',
  '#ff8a65',
  '#a1887f',
  '#90a4ae',
  '#f06292',
  '#7986cb',
  '#aed581',
] as const;
