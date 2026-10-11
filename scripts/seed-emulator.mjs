// Befüllt die lokalen Firebase-Emulatoren mit Testdaten und Testkonten.
// Nur für die lokale Entwicklung – spricht ausschließlich 127.0.0.1 an.
//
//   1. npm run emulators          (in einem Terminal)
//   2. npm run emulators:seed     (in einem zweiten Terminal)
//   3. npm run dev:emu            (Seite gegen die Emulatoren starten)
//
// Testkonten (nur im Emulator vorhanden):
//   Vorstand: Benutzername "VorstandLamm" oder vorstand@test.local
//   Helfer:   Benutzername "testhelfer"
//   Ohne Vorstandsrecht: ohnerecht@test.local
//   Passwort für alle: siehe scripts/emulator-config.mjs
import { DATABASE, PROJECT, TEST_PASSWORD } from './emulator-config.mjs';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';

const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function call(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));
}

async function setDoc(collection, id, data) {
  const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/${DATABASE}/documents/${collection}?documentId=${encodeURIComponent(id)}`;
  await call(url, { method: 'POST', headers: owner, body: JSON.stringify({ fields: toFields(data) }) });
}

async function createUser(email, claims) {
  const data = await call(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
  });
  if (claims) {
    await call(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
      method: 'POST',
      headers: owner,
      body: JSON.stringify({ localId: data.localId, customAttributes: JSON.stringify(claims) }),
    });
  }
  return data.localId;
}

// ---------- Aufräumen ----------
await call(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/${DATABASE}/documents`, { method: 'DELETE' });
await call(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

// ---------- Konten ----------
await createUser('vorstand@test.local', { admin: true });
// Vereinskonto absichtlich ohne Claim – es hat trotzdem Vorstandsrechte (siehe firestore.rules)
await createUser('schuetzenvereinunterigling@gmail.com');
await createUser('testhelfer@helfer.schuetzenverein.local');
await createUser('ohnerecht@test.local');

// ---------- Veranstaltungen ----------
const events = [
  ['ev1', { title: 'Faschingsumzug', date: '2026-02-07', time: '14:14', description: 'Iglinger Faschingsumzug mit Bewirtung' }],
  ['ev2', { title: 'Anfangsschießen 2026/2027', date: '2026-10-17', time: '19:30', description: 'Ablauf:\nEssen > schießen > Proklamation von der Saison 25/26' }],
  ['ev3', { title: 'Steckerlfisch-Essen', date: '2026-11-07', time: '', description: 'Uhrzeit folgt', registrationRequired: true }],
  ['ev4', { title: 'Adventsfeier', date: '2026-12-12', time: '18:30', description: 'Gemütliches Beisammensein vor dem Lamm bei Bratwurst und Glühwein' }],
  ['ev5', { title: 'Weihnachtsschießen', date: '2026-12-26', time: '19:00', description: '' }],
  ['ev6', { title: 'Preisschießen', date: '2026-11-21', time: '19:30', description: 'Fällt leider aus.', cancelled: true }],
  ['ev7', { title: 'Generalversammlung', date: '2027-01-30', time: '19:30', description: '' }],
  ['ev8', { title: 'Endschießen 2026/2027', date: '2027-03-13', time: '19:30', description: '' }],
];
for (const [id, data] of events) {
  await setDoc('events', id, {
    registrationRequired: false,
    cancelled: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...data,
  });
}

// ---------- Einstellungen ----------
await setDoc('settings', 'winterMode', { enabled: false });
await setDoc('settings', 'visitor-counter', { count: 618 });

// ---------- Helfer ----------
const wirte = [
  ['w1', 'Anna Huber', '#e57373'],
  ['w2', 'Bernd Maier', '#64b5f6'],
  ['w3', 'Clara Schmid', '#81c784'],
  ['w4', 'Dieter Wagner', '#ffb74d'],
  ['w5', 'Eva Bauer', '#ba68c8'],
];
const aufsicht = [
  ['a1', 'Franz Huber', '#4db6ac'],
  ['a2', 'Bernd Maier', '#64b5f6'],
  ['a3', 'Gerda Koch', '#ff8a65'],
  ['a4', 'Hans Lechner', '#a1887f'],
];
for (const [id, name, color] of wirte) await setDoc('wirte-persons', id, { name, color });
for (const [id, name, color] of aufsicht) await setDoc('aufsicht-persons', id, { name, color });

// ---------- Wirte-Tage ----------
const days = [
  ['d1', '2026-10-03', 'Tag der Deutschen Einheit'],
  ['d2', '2026-11-01', 'Allerheiligen'],
  ['d3', '2026-12-25', '1. Weihnachtsfeiertag'],
  ['d4', '2026-12-26', '2. Weihnachtsfeiertag'],
  ['d5', '2027-01-01', 'Neujahr'],
  ['d6', '2027-01-06', 'Heilige Drei Könige'],
];
for (const [id, date, description] of days) {
  await setDoc('wirte-days', id, { date, description, type: 'holiday', createdAt: '2026-09-01T10:00:00.000Z' });
}

// ---------- Einteilungen (bewusst mit Altformaten) ----------
const person = (list, id) => {
  const p = list.find((x) => x[0] === id);
  return { person: p[1], color: p[2] };
};
const wa = [
  ['wa1', { date: '2026-10-03', slot: 'fruehschoppen', ...person(wirte, 'w1') }],
  ['wa2', { date: '2026-10-03', slot: 'schiessabend', ...person(wirte, 'w2') }],
  ['wa3', { date: '2026-10-04', slot: 'default', ...person(wirte, 'w3') }],
  ['wa4', { date: '2026-10-10', ...person(wirte, 'w4') }], // ohne Slot (sehr alt)
  ['wa5', { date: '2026-10-11', slot: 'fruehschoppen', ...person(wirte, 'w5') }],
  ['wa6', { date: '2026-10-17', slot: 'schiessabend', ...person(wirte, 'w2') }], // Konflikt mit Aufsicht
  ['wa7', { date: '2026-10-18', slot: 'fruehschoppen', ...person(wirte, 'w1') }],
  ['wa8', { date: '2026-10-18', slot: 'default', ...person(wirte, 'w3') }], // Duplikat
  ['wa9', { date: '2026-10-24', slot: 'schiessabend', ...person(wirte, 'w3'), originalPerson: 'Eva Bauer', swappedWith: 'Clara Schmid' }],
  ['wa10', { date: '2026-10-31', slot: 'schiessabend', ...person(wirte, 'w5') }],
  ['wa11', { date: '2026-11-01', slot: 'fruehschoppen', ...person(wirte, 'w4') }],
];
for (const [id, data] of wa) await setDoc('wirte-assignments', id, data);

const aa = [
  ['aa1', { date: '2026-10-10', ...person(aufsicht, 'a1') }],
  ['aa2', { date: '2026-10-17', ...person(aufsicht, 'a2') }],
  ['aa3', { date: '2026-10-24', slot: 'schiessabend', ...person(aufsicht, 'a3') }],
  ['aa4', { date: '2026-11-07', ...person(aufsicht, 'a4') }],
  ['aa5', { date: '2026-03-07', ...person(aufsicht, 'a1') }],
];
for (const [id, data] of aa) await setDoc('aufsicht-assignments', id, data);

// ---------- Tages-Infos ----------
await setDoc('aufsicht-notes', 'an1', { date: '2026-10-17', note: 'Anfangsschießen' });
await setDoc('aufsicht-notes', 'an2', { date: '2027-03-13', note: 'Endschießen' });
await setDoc('aufsicht-notes', 'an3', { date: '2025-10-18', note: 'Anfangsschießen' });
await setDoc('aufsicht-notes', 'an4', { date: '2026-03-14', note: 'Endschiessen' });
await setDoc('wirte-notes', 'wn1', { date: '2026-10-17', note: 'Anfangsschießen' });

// ---------- Tauschanfragen ----------
// alte Form: Slot im Datum, keine assignmentId
await setDoc('wirte-swaps', 'ws1', {
  requestPerson: 'Eva Bauer',
  date: '2026-10-31-schiessabend',
  requestPersonColor: '#ba68c8',
  replacementPerson: 'Dieter Wagner',
  status: 'pending',
  createdAt: '2026-10-05T18:00:00.000Z',
});
await setDoc('wirte-swaps', 'ws2', {
  requestPerson: 'Eva Bauer',
  date: '2026-10-24',
  requestPersonColor: '#ba68c8',
  replacementPerson: 'Clara Schmid',
  status: 'completed',
  createdAt: '2026-10-01T18:00:00.000Z',
});

console.log('Emulatoren befüllt: 4 Konten, Termine, Helfer, Einteilungen, Wirte-Tage, Tauschanfragen.');
