/**
 * Firebase für Vorstands- und Helferbereich (Auth, Firestore mit Echtzeit, Storage).
 */
import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { EMULATOR_HOST, EMULATOR_PORTS, FIRESTORE_DATABASE, USE_EMULATORS, firebaseConfig } from '../lib/config';

const app = getApps().find((a) => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);

// Ohne Popup/Redirect-Resolver: Anmeldung nur mit E-Mail/Passwort, keine Google-iframes nötig.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Lokal: Long-Polling statt Streaming – der Emulator verliert bei größeren Datenmengen sonst Echtzeit-Antworten.
export const db = initializeFirestore(app, USE_EMULATORS ? { experimentalForceLongPolling: true } : {}, FIRESTORE_DATABASE);
export const storage = getStorage(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
}
