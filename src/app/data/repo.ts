/**
 * Alle Schreibzugriffe auf Firestore/Storage an einer Stelle.
 * Die Feldnamen entsprechen exakt den bisherigen Daten – alte und neue Einträge passen zusammen.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import { col, type Protocol } from './collections';
import { storedSlot, swapTarget } from '../../lib/schedule/slots';
import type { RotationPlan } from '../../lib/schedule/rotation';
import type { Assignment, DayNote, Person, ScheduleType, Slot, SwapRequest } from '../../lib/schedule/types';

const now = () => new Date().toISOString();

/** Führt viele Schreibvorgänge in Paketen à 400 aus (Firestore-Limit: 500 pro Batch). */
async function commitAll(ops: ((batch: WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

const newRef = (path: string): DocumentReference => doc(collection(db, path));

/* ---------- Veranstaltungen ---------- */

export interface EventInput {
  title: string;
  date: string;
  time: string;
  description: string;
  registrationRequired: boolean;
  cancelled: boolean;
}

export function createEvent(input: EventInput) {
  return addDoc(collection(db, col.events), { ...input, createdAt: now() });
}

export function updateEvent(id: string, input: EventInput) {
  return updateDoc(doc(db, col.events, id), { ...input });
}

export function deleteEvent(id: string) {
  return deleteDoc(doc(db, col.events, id));
}

/* ---------- Protokolle ---------- */

export const PROTOCOL_MAX_BYTES = 10 * 1024 * 1024;

export function uploadProtocol(
  file: File,
  meta: { title: string; date: string },
  onProgress: (fraction: number) => void,
): Promise<void> {
  const safeName = file.name.replace(/[\\/]/g, '_');
  const filePath = `protocols/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, filePath);
  const task = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf' });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      async () => {
        try {
          const fileUrl = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, col.protocols), {
            title: meta.title,
            date: meta.date,
            fileUrl,
            filePath,
            uploadedAt: now(),
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

export async function deleteProtocol(protocol: Protocol) {
  await deleteDoc(doc(db, col.protocols, protocol.id));
  if (protocol.filePath) {
    try {
      await deleteObject(ref(storage, protocol.filePath));
    } catch (error) {
      if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
    }
  }
}

/* ---------- Helfer (Personen) ---------- */

export function addPerson(type: ScheduleType, name: string, color: string) {
  return addDoc(collection(db, col.persons(type)), { name, color });
}

/**
 * Ändert Name/Farbe. Bestehende Einteilungen und offene Tauschanfragen werden mit angepasst,
 * damit die Person ihre Termine behält.
 */
export async function updatePerson(
  type: ScheduleType,
  person: Person,
  next: { name: string; color: string },
  related: { assignments: Assignment[]; swaps: SwapRequest[] },
) {
  const ops: ((b: WriteBatch) => void)[] = [
    (b) => b.update(doc(db, col.persons(type), person.id), { name: next.name, color: next.color }),
  ];
  const renamed = next.name !== person.name;
  for (const a of related.assignments) {
    const update: Record<string, string> = {};
    if (a.person === person.name) {
      update.person = next.name;
      update.color = next.color;
    }
    if (renamed && a.originalPerson === person.name) update.originalPerson = next.name;
    if (renamed && a.swappedWith === person.name) update.swappedWith = next.name;
    if (Object.keys(update).length) ops.push((b) => b.update(doc(db, col.assignments(type), a.id), update));
  }
  if (renamed) {
    for (const s of related.swaps) {
      const update: Record<string, string> = {};
      if (s.requestPerson === person.name) update.requestPerson = next.name;
      if (s.replacementPerson === person.name) update.replacementPerson = next.name;
      if (Object.keys(update).length) ops.push((b) => b.update(doc(db, col.swaps(type), s.id), update));
    }
  }
  await commitAll(ops);
}

export function deletePerson(type: ScheduleType, id: string) {
  return deleteDoc(doc(db, col.persons(type), id));
}

/* ---------- Einteilungen ---------- */

function assignmentData(type: ScheduleType, date: string, slot: Slot, person: Pick<Person, 'name' | 'color'>) {
  const data: Record<string, string> = { person: person.name, color: person.color, date };
  const stored = storedSlot(type, slot);
  if (stored) data.slot = stored;
  return data;
}

/** Offene Tauschanfragen, die zu einer Einteilung gehören. */
function relatedSwapIds(type: ScheduleType, assignment: Assignment, slot: Slot, swaps: SwapRequest[]) {
  return swaps
    .filter((s) => {
      if (s.assignmentId) return s.assignmentId === assignment.id;
      const target = swapTarget(s);
      return target.date === assignment.date && (type === 'aufsicht' || !target.slot || target.slot === slot);
    })
    .map((s) => s.id);
}

/** Person einteilen; `replaceIds` sind bisherige Einträge in diesem Dienst, die ersetzt werden. */
export async function assignPerson(
  type: ScheduleType,
  target: { date: string; slot: Slot },
  person: Pick<Person, 'name' | 'color'>,
  replace: Assignment[] = [],
  swaps: SwapRequest[] = [],
) {
  const ops: ((b: WriteBatch) => void)[] = [];
  for (const old of replace) {
    ops.push((b) => b.delete(doc(db, col.assignments(type), old.id)));
    relatedSwapIds(type, old, target.slot, swaps).forEach((id) => ops.push((b) => b.delete(doc(db, col.swaps(type), id))));
  }
  const ref = newRef(col.assignments(type));
  ops.push((b) => b.set(ref, assignmentData(type, target.date, target.slot, person)));
  await commitAll(ops);
}

/** Mehrere Einteilungen an andere Personen geben (z. B. beim Entzerren) – offene Tauschanfragen dazu entfallen. */
export async function reassignMany(
  type: ScheduleType,
  items: { assignment: Assignment; slot: Slot; person: Pick<Person, 'name' | 'color'> }[],
  swaps: SwapRequest[] = [],
) {
  const ops: ((b: WriteBatch) => void)[] = [];
  const swapIds = new Set<string>();
  for (const { assignment, slot, person } of items) {
    ops.push((b) => b.delete(doc(db, col.assignments(type), assignment.id)));
    relatedSwapIds(type, assignment, slot, swaps).forEach((id) => swapIds.add(id));
    const ref = newRef(col.assignments(type));
    ops.push((b) => b.set(ref, assignmentData(type, assignment.date, slot, person)));
  }
  swapIds.forEach((id) => ops.push((b) => b.delete(doc(db, col.swaps(type), id))));
  await commitAll(ops);
}

/** Einteilung auf einen anderen Tag/Dienst verschieben. */
export async function moveAssignment(
  type: ScheduleType,
  assignment: Assignment,
  fromSlot: Slot,
  target: { date: string; slot: Slot },
  replace: Assignment[] = [],
  swaps: SwapRequest[] = [],
) {
  const ops: ((b: WriteBatch) => void)[] = [(b) => b.delete(doc(db, col.assignments(type), assignment.id))];
  relatedSwapIds(type, assignment, fromSlot, swaps).forEach((id) => ops.push((b) => b.delete(doc(db, col.swaps(type), id))));
  for (const old of replace) {
    if (old.id === assignment.id) continue;
    ops.push((b) => b.delete(doc(db, col.assignments(type), old.id)));
  }
  const ref = newRef(col.assignments(type));
  ops.push((b) => b.set(ref, assignmentData(type, target.date, target.slot, { name: assignment.person, color: assignment.color })));
  await commitAll(ops);
}

/** Einteilungen löschen – zugehörige Tauschanfragen werden mit entfernt. */
export async function removeAssignments(
  type: ScheduleType,
  items: { assignment: Assignment; slot: Slot }[],
  swaps: SwapRequest[] = [],
) {
  const ops: ((b: WriteBatch) => void)[] = [];
  const swapIds = new Set<string>();
  for (const { assignment, slot } of items) {
    ops.push((b) => b.delete(doc(db, col.assignments(type), assignment.id)));
    relatedSwapIds(type, assignment, slot, swaps).forEach((id) => swapIds.add(id));
  }
  swapIds.forEach((id) => ops.push((b) => b.delete(doc(db, col.swaps(type), id))));
  await commitAll(ops);
}

export async function applyRotation(type: ScheduleType, plan: RotationPlan) {
  const ops: ((b: WriteBatch) => void)[] = plan.deleteIds.map(
    (id) => (b: WriteBatch) => b.delete(doc(db, col.assignments(type), id)),
  );
  for (const entry of plan.creates) {
    const ref = newRef(col.assignments(type));
    ops.push((b) => b.set(ref, assignmentData(type, entry.date, entry.slot, { name: entry.person, color: entry.color })));
  }
  await commitAll(ops);
}

/* ---------- Tages-Infos ---------- */

export async function saveNote(type: ScheduleType, date: string, text: string, existing?: DayNote) {
  const note = text.trim();
  if (!note) {
    if (existing) await deleteDoc(doc(db, col.notes(type), existing.id));
    return;
  }
  if (existing) await updateDoc(doc(db, col.notes(type), existing.id), { note, date });
  else await addDoc(collection(db, col.notes(type)), { note, date });
}

/* ---------- Wirte-Tage (Feiertage/Sondertage) ---------- */

export function addWirteDays(days: { date: string; description: string; type: string }[]) {
  return commitAll(
    days.map((day) => {
      const ref = newRef(col.wirteDays);
      return (b: WriteBatch) => b.set(ref, { ...day, createdAt: now() });
    }),
  );
}

export function deleteWirteDay(id: string) {
  return deleteDoc(doc(db, col.wirteDays, id));
}

/* ---------- Tauschanfragen ---------- */

export function createSwap(type: ScheduleType, assignment: Assignment, slot: Slot, replacement: Person) {
  return addDoc(collection(db, col.swaps(type)), {
    requestPerson: assignment.person,
    date: assignment.date,
    ...(type === 'wirte' ? { slot } : {}),
    assignmentId: assignment.id,
    requestPersonColor: assignment.color,
    replacementPerson: replacement.name,
    status: 'pending',
    createdAt: now(),
  });
}

/** Ersatzperson übernimmt: Einteilung wird umgeschrieben, Anfrage als erledigt markiert. */
export async function acceptSwap(type: ScheduleType, swap: SwapRequest, assignment: Assignment, replacement: Person) {
  const batch = writeBatch(db);
  batch.update(doc(db, col.swaps(type), swap.id), { status: 'completed', replacementPerson: replacement.name });
  batch.update(doc(db, col.assignments(type), assignment.id), {
    originalPerson: swap.requestPerson,
    person: replacement.name,
    color: replacement.color,
    swappedWith: replacement.name,
  });
  await batch.commit();
}

export function deleteSwap(type: ScheduleType, id: string) {
  return deleteDoc(doc(db, col.swaps(type), id));
}

/* ---------- Einstellungen ---------- */

export function setWinterMode(enabled: boolean) {
  return setDoc(doc(db, col.settings, 'winterMode'), { enabled }, { merge: true });
}

/** Termine der Schießabende für den öffentlichen Countdown (ohne Namen). */
export function publishShootingDates(dates: string[]) {
  return setDoc(doc(db, col.settings, 'schiesstermine'), { dates, updatedAt: now() });
}
