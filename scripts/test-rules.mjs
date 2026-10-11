// Prüft die Firestore-Regeln gegen den laufenden Emulator (vorher: npm run emulators + npm run emulators:seed).
//   node scripts/test-rules.mjs
import { PROJECT, TEST_PASSWORD } from './emulator-config.mjs';

const DB = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/vorstandschaftschuetzen/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function token(email) {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`Anmeldung fehlgeschlagen: ${email}`);
  return data.idToken;
}

const fields = (obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }]),
  );

async function request(tok, method, path, body) {
  const res = await fetch(`${DB}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify({ fields: fields(body) }) : undefined,
  });
  return res.status;
}

const helper = await token('testhelfer@helfer.schuetzenverein.local');
const admin = await token('vorstand@test.local');
const noClaim = await token('ohnerecht@test.local');
const vereinskonto = await token('schuetzenvereinunterigling@gmail.com'); // Login "VorstandLamm", ohne Claim

const cases = [
  // [Beschreibung, erwartet erlaubt?, Aufruf]
  ['Helfer liest Einteilungen', true, () => request(helper, 'GET', 'wirte-assignments')],
  ['Helfer liest Protokolle', false, () => request(helper, 'GET', 'protocols')],
  ['Helfer legt Einteilung an', false, () => request(helper, 'POST', 'wirte-assignments', { date: '2026-11-14', person: 'X', color: '#fff' })],
  [
    'Helfer übernimmt Tausch (person/color/originalPerson/swappedWith)',
    true,
    () =>
      request(helper, 'PATCH', 'wirte-assignments/wa10?updateMask.fieldPaths=person&updateMask.fieldPaths=color&updateMask.fieldPaths=originalPerson&updateMask.fieldPaths=swappedWith', {
        person: 'Dieter Wagner',
        color: '#ffb74d',
        originalPerson: 'Eva Bauer',
        swappedWith: 'Dieter Wagner',
      }),
  ],
  ['Helfer verschiebt Datum einer Einteilung', false, () => request(helper, 'PATCH', 'wirte-assignments/wa10?updateMask.fieldPaths=date', { date: '2026-12-31' })],
  ['Helfer löscht Einteilung', false, () => request(helper, 'DELETE', 'wirte-assignments/wa10')],
  ['Helfer stellt Tauschanfrage', true, () => request(helper, 'POST', 'aufsicht-swaps', { requestPerson: 'Gerda Koch', date: '2026-10-24', status: 'pending' })],
  ['Helfer ändert Veranstaltung', false, () => request(helper, 'PATCH', 'events/ev2?updateMask.fieldPaths=title', { title: 'x' })],
  ['Konto ohne Vorstandsrecht ändert Veranstaltung', false, () => request(noClaim, 'PATCH', 'events/ev2?updateMask.fieldPaths=title', { title: 'x' })],
  ['Konto ohne Vorstandsrecht liest Einteilungen', false, () => request(noClaim, 'GET', 'wirte-assignments')],
  ['Konto ohne Vorstandsrecht schaltet Wintermodus', false, () => request(noClaim, 'PATCH', 'settings/winterMode', { enabled: true })],
  ['Vorstand legt Veranstaltung an', true, () => request(admin, 'POST', 'events', { title: 'Test', date: '2026-12-01', time: '', description: '', registrationRequired: false, cancelled: false })],
  ['Vorstand legt Veranstaltung mit ungültigem Datum an', false, () => request(admin, 'POST', 'events', { title: 'Test', date: '1.12.2026' })],
  ['Vorstand liest Protokolle', true, () => request(admin, 'GET', 'protocols')],
  ['Vorstand schaltet Wintermodus', true, () => request(admin, 'PATCH', 'settings/winterMode', { enabled: false })],
  ['Vorstand setzt Besucherzähler', false, () => request(admin, 'PATCH', 'settings/visitor-counter', { count: '1' })],
  ['Vereinskonto (VorstandLamm) ohne Claim liest Protokolle', true, () => request(vereinskonto, 'GET', 'protocols')],
  ['Vereinskonto (VorstandLamm) ohne Claim schaltet Wintermodus', true, () => request(vereinskonto, 'PATCH', 'settings/winterMode', { enabled: false })],
  ['Anonym liest Veranstaltungen', true, () => request(null, 'GET', 'events')],
  ['Anonym liest Helfer', false, () => request(null, 'GET', 'wirte-persons')],
];

let failed = 0;
for (const [name, expectAllowed, run] of cases) {
  const status = await run();
  const allowed = status >= 200 && status < 300;
  const ok = allowed === expectAllowed;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name} → HTTP ${status}${ok ? '' : `  (erwartet: ${expectAllowed ? 'erlaubt' : 'verboten'})`}`);
}
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : '\nAlle Regel-Prüfungen bestanden.');
process.exit(failed ? 1 : 0);
