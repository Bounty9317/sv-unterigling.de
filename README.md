# Schützenverein Unterigling e.V. – Webseite

Neubau der Vereinsseite mit öffentlichem Teil, **Vorstandsbereich** und **Helferbereich**.
Die Daten bleiben in derselben Firebase-Datenbank (`vorstandschaftschuetzen`) im **gleichen Format** –
alte und neue Einträge passen zusammen.

## Technik

| Bereich | Umsetzung |
| --- | --- |
| Seiten | [Astro 7](https://docs.astro.build) – statische Seiten, jede Unterseite mit eigener Adresse |
| Vorstand & Helfer | React 19 (Echtzeit-Daten über Firestore) |
| Daten & Login | Firebase 13 (Firestore, Authentication, Storage) |
| Galerie | Cloudinary über Cloud Functions (`functions/`) |
| PDF-Listen | jsPDF (wird erst beim Erstellen geladen) |
| Design | eigenes CSS mit Design-Tokens, Hell/Dunkel, Scroll-Animationen und Seitenübergänge ohne JavaScript |
| Sicherheit | Content-Security-Policy, neue Firestore-/Storage-Regeln, Admin-Recht per Claim |

## Ordner

```
src/
  pages/            Seiten (index, chronik, …, vorstand/, helfer/)
  components/       Kopf, Fuß, Terminliste, Karte, …
  data/verein.ts    Adresse, E-Mail, Öffnungszeiten, Vorstand → hier Inhalte ändern
  data/chronik.ts   Texte der Chronik
  assets/images/    Fotos (werden automatisch verkleinert und als WebP ausgeliefert)
  app/              Vorstands- und Helferbereich (React)
  lib/schedule/     Einteilungslogik (Dienste, Rotation, Konflikte, PDF) – mit Tests
  styles/           Design-Tokens und Grundstile
functions/          Cloud Functions für die Galerie
scripts/            Test-Skripte für die lokalen Emulatoren, Icons erzeugen
firestore.rules     Datenbankregeln (für die Datenbank "vorstandschaftschuetzen")
storage.rules       Regeln für die Protokoll-PDFs
public/downloads/   Mitgliedsantrag (PDF)
```

## Entwickeln

Voraussetzung: Node.js 22.12 oder neuer.

```bash
npm install
npm run dev          # http://localhost:4321 – liest die echten öffentlichen Daten (zählt keine Besucher)
npm test             # Unit-Tests der Einteilungslogik
npm run check        # Typprüfung
npm run build        # fertige Seite in dist/
```

### Mit Testdaten statt echter Daten (empfohlen für Vorstand/Helfer)

Die Firebase-Emulatoren brauchen Java 21 und die Firebase-CLI (`npm i -g firebase-tools`).

```bash
npm run emulators        # Terminal 1: Auth, Firestore und Storage lokal
npm run emulators:seed   # Terminal 2: Testdaten und Testkonten anlegen
npm run test:rules       # prüft die Sicherheitsregeln (20 Fälle)
npm run dev:emu          # Seite gegen die Emulatoren starten
```

Die Testkonten stehen in `scripts/seed-emulator.mjs`, das Passwort in `scripts/emulator-config.mjs`
(nur im Emulator gültig). Die Galerie verwendet lokal eine Attrappe statt Cloudinary.

## Veröffentlichen – Reihenfolge beachten

1. **Vorstandsrecht (nur für zusätzliche Konten).** Die neuen Regeln lassen nur den Vorstand schreiben
   (bisher reichte *irgendein* angemeldetes Konto – das war eine Sicherheitslücke). Die bisherigen Zugänge
   funktionieren unverändert: Das Vereinskonto (Login „VorstandLamm“) hat immer Vorstandsrechte, Helfer melden sich
   wie gewohnt mit ihrem Benutzernamen an. Nur wer sich mit einer **anderen** E-Mail als Vorstand anmeldet, braucht
   den Claim `admin`. Dafür den Service-Account-Schlüssel als `functions/serviceAccountKey.json` ablegen
   (Firebase Console → Projekteinstellungen → Dienstkonten), dann:
   ```bash
   cd functions
   npm install
   npm run set-admin -- pruefen <vorstands-email>
   npm run set-admin -- setzen  <vorstands-email>
   ```
   Danach die Schlüsseldatei wieder löschen.
2. **Selbstregistrierung abschalten:** Firebase Console → Authentication → Einstellungen →
   Nutzeraktionen → „Erstellen (Registrierung) aktivieren“ ausschalten. Konten legt nur der Vorstand an.
3. **Functions** (entfernt dabei die unsichere Function `setAdminClaimByUid` – die Rückfrage der CLI mit *Ja* bestätigen):
   ```bash
   firebase deploy --only functions
   ```
4. **Regeln** für Datenbank und Speicher:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
   Achtung: Das überschreibt die bisher in der Console gepflegten Regeln der Datenbank
   `vorstandschaftschuetzen`. Die alte `firestore.rules` galt nur für die *Standard*-Datenbank.
5. **Seite:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
   Alte Adressen (`admin-login.html`, `helfer-dashboard.html`, …) leiten automatisch weiter.

## Gut zu wissen

- **Countdown „Nächstes Schießen“:** Der Vorstandsbereich veröffentlicht die Termine der Schießaufsicht
  (nur Daten, keine Namen) im Dokument `settings/schiesstermine`, sobald jemand mit Vorstandsrecht
  den Vorstandsbereich öffnet. Bis dahin zählt die Startseite bis zur nächsten „…schießen“-Veranstaltung.
- **Wann welcher Dienst gebraucht wird:**
  - Wirte: Frühschoppen an Sonntagen und eingetragenen Wirte-Tagen, Schießabend an Samstagen von Oktober bis
    März (Öffnungszeiten) und am 26.12. Sommer-Samstage haben keinen Dienst – ist ein Sommer-Samstag ein
    Wirte-Tag (Feiertag), gibt es nur den Frühschoppen.
  - Schießaufsicht: nur Samstage zwischen „Anfangsschießen“ und „Endschießen“ (Infos im Aufsicht-Kalender)
    sowie der 26.12. Ist für einen Winter noch keine Saison eingetragen, gilt Oktober bis März.
  - Ein Abend mit „Kein Schießen“ bei der Aufsicht (z. B. Generalversammlung) braucht trotzdem einen Wirt.
- **Mehrere Dienste kurz hintereinander:** Hat jemand zwei Dienste am selben Wochenende (Samstag + Sonntag) oder
  denselben Dienst zwei Wochen in Folge (z. B. zwei Samstage), erscheint im Kalender ein Hinweis. „Entzerren…“
  behält den ersten Dienst und schlägt für die weiteren jemanden vor, der an dem Wochenende frei ist, denselben
  Dienst nicht eine Woche davor/danach hat und in diesen Wochen wenig Dienste hat. Gibt es so jemanden nicht (z. B. an Weihnachten), steht der Eintrag auf
  „nicht ändern“; knappere Kandidaten sind markiert. Die Auto-Rotation hält diesen Abstand von selbst ein.
- **Auto-Rotation:** zwei feste Reihen – Schießabende (Samstage und 26.12.) und Frühschoppen (Sonntage,
  Feiertage, Sondertage). In jeder Reihe stehen nur die Wirte, die diesen Dienst machen (Häkchen unter „Helfer“,
  Feld `slots`), jede mit eigener Reihenfolge (Feld `rotationOrders.<Dienst>` der Person). Jede Reihe läuft von
  Nr. 1 bis x und beginnt dann wieder bei Nr. 1; „Beginnen mit“ wählt die Startperson, „… weitermachen“ setzt sie auf
  den Nächsten nach dem letzten Dienst vor dem Start. Erst werden die Schießabende verteilt, dann die Frühschoppen
  passend dazu; was der Lauf ersetzt, zählt dabei nicht mehr mit. „Beste Reihenfolge berechnen“ prüft alle
  Reihenfolgen der Frühschoppen-Reihe (bis 8 Personen) und wählt die mit den wenigsten Wirten an zwei Wochenenden
  hintereinander, dann den wenigsten Platztauschen. Getauscht wird nur, wenn es nicht anders geht: Schießaufsicht am
  selben Abend, schon eingeteilt am selben Wochenende oder derselbe Dienst eine Woche davor/danach. Die Vorschau zeigt
  beide Reihen, die Dienste je Wirt, alle Platztausche und alle Wochenenden hintereinander, bevor etwas gespeichert
  wird. Stehen nach dem End-Datum noch Einteilungen, bietet der Dialog an, bis dorthin mit zu verteilen.
- **Neue Version veröffentlicht:** Jeder Build schreibt seine Kennung nach `/version.json`. Ein länger offenes
  Fenster des Vorstandsbereichs prüft alle 5 Minuten und beim Zurückwechseln, ob online eine neuere Version liegt,
  und zeigt dann „Jetzt neu laden“. Die Auto-Rotation lässt sich in einem veralteten Fenster nicht starten.
- **Wirte-Tage:** Unter „Wirte-Tage“ lassen sich die bayerischen Feiertage eines Jahres mit einem Klick eintragen.
- **Saison der Schießaufsicht:** Die Infos „Anfangsschießen“ und „Endschießen“ legen auch fest, welche
  Samstage in den PDF-Listen erscheinen.
- **Tausch:** Helfer fragen einen Tausch an, die angefragte Person (oder der Vorstand) bestätigt mit
  „… übernimmt“. Helfer dürfen an Einteilungen sonst nichts ändern. Nie bestätigte Anfragen für vergangene
  Termine zählen nicht mehr als offen und stehen unter „Abgelaufen“ zum Entfernen bereit.
- **„Kein Schießen“:** Einträge, deren Name mit „Kein“/„Keine“ beginnt (z. B. „Kein Schießen“ an der
  Generalversammlung), gelten als Platzhalter: Sie zählen nicht für den Countdown, werden von der Auto-Rotation
  nicht verteilt und nicht überschrieben und erscheinen nicht in der „Ich bin…“-Auswahl.
- **Besucherzähler:** zählt einen Besuch pro Browser-Sitzung; die Regeln erlauben nur „+1“.
- **Icons/Vorschaubild neu erzeugen** (z. B. nach neuem Logo): `node scripts/make-icons.mjs`
