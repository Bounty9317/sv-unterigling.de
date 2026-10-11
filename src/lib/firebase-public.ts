/**
 * Schlanker Firebase-Zugang für die öffentlichen Seiten.
 * Nutzt "firestore/lite" (ohne Echtzeit-Listener) – deutlich kleiner als das volle SDK.
 */
import { getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore/lite';
import { EMULATOR_HOST, EMULATOR_PORTS, FIRESTORE_DATABASE, USE_EMULATORS, firebaseConfig } from './config';

const APP_NAME = 'public';
let db: Firestore | undefined;

export function publicDb(): Firestore {
  if (db) return db;
  const app = getApps().find((a) => a.name === APP_NAME) ?? initializeApp(firebaseConfig, APP_NAME);
  db = getFirestore(app, FIRESTORE_DATABASE);
  if (USE_EMULATORS) connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  return db;
}
