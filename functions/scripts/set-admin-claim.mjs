// Vorstandsrecht ("admin"-Claim) für ein Konto setzen oder prüfen.
//
// Voraussetzung: Service-Account-Schlüssel des Projekts als functions/serviceAccountKey.json
// (Firebase Console → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“).
// Die Datei ist in .gitignore eingetragen und darf NIE eingecheckt oder weitergegeben werden.
//
//   node scripts/set-admin-claim.mjs pruefen  vorstand@example.de
//   node scripts/set-admin-claim.mjs setzen   vorstand@example.de
//   node scripts/set-admin-claim.mjs entfernen vorstand@example.de
import { readFile } from 'node:fs/promises';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [action, email] = process.argv.slice(2);
if (!['pruefen', 'setzen', 'entfernen'].includes(action ?? '') || !email) {
  console.error('Aufruf: node scripts/set-admin-claim.mjs <pruefen|setzen|entfernen> <E-Mail>');
  process.exit(1);
}

const key = JSON.parse(await readFile(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(key) });
const auth = getAuth();

const user = await auth.getUserByEmail(email);
const claims = user.customClaims ?? {};

if (action === 'pruefen') {
  console.log(`${email}: Vorstandsrecht ${claims.admin === true ? 'JA' : 'NEIN'} (UID ${user.uid})`);
} else {
  const next = { ...claims, admin: action === 'setzen' };
  if (!next.admin) delete next.admin;
  await auth.setCustomUserClaims(user.uid, next);
  console.log(`${email}: Vorstandsrecht ${action === 'setzen' ? 'gesetzt' : 'entfernt'}. Bitte einmal ab- und wieder anmelden.`);
}
