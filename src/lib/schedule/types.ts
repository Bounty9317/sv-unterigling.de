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
  /** Wirte: Dienste, für die die Person eingeteilt werden kann (fehlt = alle) */
  slots?: Slot[];
  /** Platz in der festen Rotations-Reihenfolge (ältere, gemeinsame Reihenfolge – fehlt = nach Namen) */
  rotationOrder?: number | null;
  /** Platz je Reihe (Schießabende / Frühschoppen) – geht vor rotationOrder */
  rotationOrders?: Partial<Record<Slot, number>>;
}

/** Kann die Person diesen Dienst übernehmen? (Schießaufsicht: immer) */
export function canTake(type: ScheduleType, person: Pick<Person, 'slots'>, slot: Slot): boolean {
  return type === 'aufsicht' || !person.slots || person.slots.includes(slot);
}

/** Kurzer Hinweis, wenn eine Person nur einen der beiden Wirte-Dienste übernimmt. */
export function slotRestriction(type: ScheduleType, person: Pick<Person, 'slots'>): string | null {
  if (type !== 'wirte' || !person.slots) return null;
  const can = SLOTS.filter((s) => person.slots!.includes(s));
  return can.length === 1 ? `nur ${SLOT_LABEL[can[0]!]}` : can.length === 0 ? 'keine Dienste' : null;
}

/** Reihenfolge für die Rotation: gespeicherte Reihenfolge, sonst nach Namen. */
export function byRotationOrder(a: Person, b: Person): number {
  const x = a.rotationOrder ?? Number.MAX_SAFE_INTEGER;
  const y = b.rotationOrder ?? Number.MAX_SAFE_INTEGER;
  return x - y || a.name.localeCompare(b.name, 'de');
}

/** Reihenfolge einer Reihe: gespeicherter Platz in dieser Reihe, sonst die gemeinsame Reihenfolge, sonst nach Namen. */
export function byQueueOrder(slot: Slot) {
  return (a: Person, b: Person): number => {
    const x = a.rotationOrders?.[slot] ?? Number.MAX_SAFE_INTEGER;
    const y = b.rotationOrders?.[slot] ?? Number.MAX_SAFE_INTEGER;
    return x - y || byRotationOrder(a, b);
  };
}

/** Wer gehört in die Reihe dieses Dienstes – in gespeicherter Reihenfolge? (ohne Platzhalter wie „Kein Schießen“) */
export function queueMembers(type: ScheduleType, persons: Person[], slot: Slot): Person[] {
  return persons.filter((p) => !isPlaceholder(p.name) && canTake(type, p, slot)).sort(byQueueOrder(slot));
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
