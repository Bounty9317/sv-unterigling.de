/**
 * Firestore-Sammlungen: Umwandlung der Dokumente in typisierte Objekte und Echtzeit-Hooks.
 */
import { useEffect, useState } from 'react';
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { isISODate } from '../../lib/dates';
import { normalizeEvent, type VereinsEvent } from '../../lib/events';
import { SLOTS, type Assignment, type DayNote, type Person, type ScheduleType, type Slot, type SwapRequest, type WirteDay } from '../../lib/schedule/types';

export const col = {
  events: 'events',
  protocols: 'protocols',
  wirteDays: 'wirte-days',
  settings: 'settings',
  persons: (type: ScheduleType) => `${type}-persons`,
  assignments: (type: ScheduleType) => `${type}-assignments`,
  notes: (type: ScheduleType) => `${type}-notes`,
  swaps: (type: ScheduleType) => `${type}-swaps`,
} as const;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const optStr = (value: unknown) => (typeof value === 'string' && value ? value : null);

export function toPerson(id: string, d: DocumentData): Person | null {
  const name = str(d.name).trim();
  if (!name) return null;
  const person: Person = { id, name, color: str(d.color) || '#90a4ae' };
  // "slots" fehlt bei bestehenden Personen → alle Dienste
  if (Array.isArray(d.slots)) person.slots = SLOTS.filter((s) => d.slots.includes(s));
  if (typeof d.rotationOrder === 'number' && Number.isFinite(d.rotationOrder)) person.rotationOrder = d.rotationOrder;
  if (d.rotationOrders && typeof d.rotationOrders === 'object') {
    const orders: Partial<Record<Slot, number>> = {};
    for (const s of SLOTS) if (typeof d.rotationOrders[s] === 'number') orders[s] = d.rotationOrders[s];
    person.rotationOrders = orders;
  }
  return person;
}

export function toAssignment(id: string, d: DocumentData): Assignment | null {
  if (!isISODate(d.date) || typeof d.person !== 'string') return null;
  return {
    id,
    date: d.date.slice(0, 10),
    person: d.person,
    color: str(d.color) || '#90a4ae',
    slot: optStr(d.slot),
    originalPerson: optStr(d.originalPerson),
    swappedWith: optStr(d.swappedWith),
  };
}

export function toNote(id: string, d: DocumentData): DayNote | null {
  if (!isISODate(d.date)) return null;
  return { id, date: d.date.slice(0, 10), note: str(d.note) };
}

export function toWirteDay(id: string, d: DocumentData): WirteDay | null {
  if (!isISODate(d.date)) return null;
  const description = str(d.description) || str(d.info) || str(d.name) || str(d.label);
  return { id, date: d.date.slice(0, 10), description, type: str(d.type) || 'holiday', createdAt: optStr(d.createdAt) ?? undefined };
}

export function toSwap(id: string, d: DocumentData): SwapRequest | null {
  if (typeof d.date !== 'string' || !isISODate(d.date) || !str(d.requestPerson)) return null;
  return {
    id,
    requestPerson: str(d.requestPerson),
    date: d.date,
    slot: d.slot === 'fruehschoppen' || d.slot === 'schiessabend' ? d.slot : null,
    assignmentId: optStr(d.assignmentId),
    requestPersonColor: optStr(d.requestPersonColor),
    replacementPerson: optStr(d.replacementPerson),
    status: str(d.status) || 'pending',
    createdAt: optStr(d.createdAt) ?? undefined,
  };
}

export interface Protocol {
  id: string;
  title: string;
  date: string;
  fileUrl: string;
  filePath: string;
  uploadedAt?: string;
}

export function toProtocol(id: string, d: DocumentData): Protocol | null {
  if (!str(d.fileUrl)) return null;
  return {
    id,
    title: str(d.title),
    date: str(d.date),
    fileUrl: str(d.fileUrl),
    filePath: str(d.filePath),
    uploadedAt: optStr(d.uploadedAt) ?? undefined,
  };
}

export function toEvent(id: string, d: DocumentData): VereinsEvent | null {
  return normalizeEvent(id, d);
}

export interface LiveData<T> {
  data: T[];
  loading: boolean;
  error: unknown;
}

/** Abonniert eine Sammlung in Echtzeit. `name = null` pausiert das Abo. */
export function useLiveCollection<T>(name: string | null, map: (id: string, data: DocumentData) => T | null): LiveData<T> {
  const [state, setState] = useState<LiveData<T>>({ data: [], loading: !!name, error: null });

  useEffect(() => {
    if (!name) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      collection(db, name),
      (snapshot) => {
        const data: T[] = [];
        snapshot.forEach((doc) => {
          const item = map(doc.id, doc.data());
          if (item) data.push(item);
        });
        setState({ data, loading: false, error: null });
      },
      (error) => {
        console.error(`Fehler beim Laden von ${name}`, error);
        setState({ data: [], loading: false, error });
      },
    );
    // `map` ist eine stabile Modulfunktion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return state;
}
