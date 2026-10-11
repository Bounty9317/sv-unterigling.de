/**
 * Öffentliche Daten aus Firestore: Termine, Wintermodus, Besucherzähler und Schießtermine.
 * Mehrere Bausteine einer Seite teilen sich dieselben Anfragen (Promise-Cache).
 */
import { collection, doc, getDoc, getDocs, increment, setDoc, updateDoc } from 'firebase/firestore/lite';
import { publicDb } from './firebase-public';
import { normalizeEvent, type VereinsEvent } from './events';

let eventsPromise: Promise<VereinsEvent[]> | undefined;

export function loadEvents(): Promise<VereinsEvent[]> {
  eventsPromise ??= getDocs(collection(publicDb(), 'events'))
    .then((snap) =>
      snap.docs.map((d) => normalizeEvent(d.id, d.data())).filter((e): e is VereinsEvent => e !== null),
    )
    .catch((error) => {
      eventsPromise = undefined;
      throw error;
    });
  return eventsPromise;
}

const settingsCache = new Map<string, Promise<Record<string, unknown> | null>>();

export function loadSetting(id: string): Promise<Record<string, unknown> | null> {
  let promise = settingsCache.get(id);
  if (!promise) {
    promise = getDoc(doc(publicDb(), 'settings', id))
      .then((snap) => (snap.exists() ? snap.data() : null))
      .catch(() => null);
    settingsCache.set(id, promise);
  }
  return promise;
}

export async function isWinterModeEnabled(): Promise<boolean> {
  const data = await loadSetting('winterMode');
  return data?.enabled === true;
}

/**
 * Nächste Schießabende für den Countdown. Der Vorstandsbereich veröffentlicht die
 * Termine der Schießaufsicht (nur Daten, keine Namen) im Dokument settings/schiesstermine.
 */
export async function loadShootingDates(): Promise<string[]> {
  const data = await loadSetting('schiesstermine');
  const dates = data?.dates;
  return Array.isArray(dates) ? dates.filter((d): d is string => typeof d === 'string') : [];
}

const VISIT_KEY = 'svu-besuch-gezaehlt';

/** Zählt einen Besuch pro Browser-Sitzung und liefert den aktuellen Stand. */
export async function countVisit(): Promise<number | null> {
  const ref = doc(publicDb(), 'settings', 'visitor-counter');
  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(VISIT_KEY) === '1';
  } catch {
    /* privates Fenster o. ä. – dann zählen wir einfach */
  }

  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? Number(snap.data().count ?? 0) : 0;
    // Beim lokalen Entwickeln nicht mitzählen
    if (alreadyCounted || import.meta.env.DEV) return current;

    if (snap.exists()) {
      await updateDoc(ref, { count: increment(1) });
    } else {
      await setDoc(ref, { count: 1 });
    }
    try {
      sessionStorage.setItem(VISIT_KEY, '1');
    } catch {
      /* ignorieren */
    }
    return current + 1;
  } catch {
    return null;
  }
}
