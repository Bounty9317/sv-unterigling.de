/**
 * Zentrale Konfiguration für Firebase, Cloud Functions und Cloudinary.
 * Mit `--mode emulator` (siehe .env.emulator) läuft alles gegen die lokalen Emulatoren.
 */
export const USE_EMULATORS = import.meta.env.PUBLIC_USE_EMULATORS === 'true';

const EMULATOR_PROJECT = 'demo-sv-unterigling';

export const firebaseConfig = USE_EMULATORS
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${EMULATOR_PROJECT}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT,
      storageBucket: `${EMULATOR_PROJECT}.appspot.com`,
      appId: '1:000000000000:web:demo',
    }
  : {
      apiKey: 'AIzaSyA6hD3scwCcytwkAoNhbNq6-lrYUcl8Fjk',
      authDomain: 'schuetzenverein-12cfa.firebaseapp.com',
      projectId: 'schuetzenverein-12cfa',
      storageBucket: 'schuetzenverein-12cfa.firebasestorage.app',
      messagingSenderId: '791385091582',
      appId: '1:791385091582:web:b4c5aae9ddb155f10ee4af',
    };

/** Die Daten liegen in einer benannten Firestore-Datenbank, nicht in "(default)". */
export const FIRESTORE_DATABASE = 'vorstandschaftschuetzen';

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 } as const;

/** Cloud Functions für die Galerie (Cloudinary). */
export const FUNCTIONS_BASE = 'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net';

export const CLOUDINARY = {
  cloudName: 'dk88ltcce',
  uploadPreset: 'schuetzenverein_events',
  folderPrefix: 'events/',
} as const;

/** Helfer melden sich mit Benutzernamen an, intern ist das eine E-Mail dieser Domain. */
export const HELPER_EMAIL_DOMAIN = '@helfer.schuetzenverein.local';

/** Vereinskonto des Vorstands – hat immer Vorstandsrechte (weitere Konten über den "admin"-Claim, siehe README). */
export const VEREINSKONTO = 'schuetzenvereinunterigling@gmail.com';

/** Kurzname für den Vorstands-Login (wie bisher). */
export const VORSTAND_LOGIN_ALIASES: Record<string, string> = {
  vorstandlamm: VEREINSKONTO,
};
