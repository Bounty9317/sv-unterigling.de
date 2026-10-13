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
- **Mehrere Dienste kurz hintereinander:** Hat jemand zwei Dienste an Wochenenden direkt hintereinander (höchstens
  8 Tage Abstand: Samstag + Sonntag, zwei Samstage in Folge, Sonntag + folgender Samstag, Schießabend + Frühschoppen
  am Sonntag eine Woche später), erscheint im Kalender ein Hinweis. „Entzerren…“
  behält den ersten Dienst und schlägt für die weiteren jemanden vor, der am Wochenende davor und danach frei ist und
  in diesen Wochen wenig Dienste hat. Gibt es so jemanden nicht (z. B. an Weihnachten), steht der Eintrag auf
  „nicht ändern“; knappere Kandidaten sind markiert. Die Auto-Rotation hält diesen Abstand von selbst ein.
- **Auto-Rotation:** verteilt reihum in der festgelegten Reihenfolge – je Dienst eine eigene Reihe: Die
  Schießabende laufen der Reihe nach durch alle, die Schießabend machen, die Frühschoppen durch alle, die
  Frühschoppen machen (Nr. 1, Nr. 2, … und dann wieder von vorne). Bei jedem Wirt lässt sich festlegen, ob er
  Schießabende und/oder Frühschoppen übernimmt (im Rotationsdialog oder unter „Helfer“, Feld `slots` der Person);
  wer beides macht, steht in beiden Reihen und ist entsprechend öfter dran. Wer am selben Wochenende Schießaufsicht
  hat oder am Wochenende davor/danach schon Wirt ist, wird übersprungen und behält seinen Platz: Er kommt beim
  nächsten Dienst dieser Reihe dran, danach geht es in der Reihenfolge weiter (höchstens eine Runde Rückstand).
  Im Sommer ohne Schießabende pausiert deren Reihe und läuft im Herbst weiter. Reihenfolge (`rotationOrder`) und
  Auswahl werden beim Start gespeichert. „Beginnen mit“ wählt die erste Person, der Dialog schlägt vor, mit wem es
  nach dem letzten Dienst vor dem Start weitergeht. Am wenigsten Platztausche gibt es, wenn Schießabende und
  Frühschoppen in **einem** Lauf verteilt werden. Stehen nach dem End-Datum noch Einteilungen (z. B. ein älterer
  Plan), zeigt der Dialog das an und bietet an, bis dorthin mit zu verteilen.
- **Mehrere Dienste kurz hintereinander:** Hat jemand zwei Dienste an Wochenenden direkt hintereinander (höchstens
  8 Tage Abstand: Samstag + Sonntag, zwei Samstage in Folge, Sonntag + folgender Samstag, Schießabend + Frühschoppen
  am Sonntag eine Woche später), erscheint im Kalender ein Hinweis. „Entzerren…“
  behält den ersten Dienst und schlägt für die weiteren jemanden vor, der am Wochenende davor und danach frei ist und
  in diesen Wochen wenig Dienste hat. Gibt es so jemanden nicht (z. B. an Weihnachten), steht der Eintrag auf
  „nicht ändern“; knappere Kandidaten sind markiert. Die Auto-Rotation hält diesen Abstand von selbst ein
  (bei der Schießaufsicht: nicht am selben Wochenende).
- **Auto-Rotation:** verteilt die Dienste reihum in der festgelegten Reihenfolge (Nr. 1, Nr. 2, … und dann
  wieder von vorne) – Schießabende und Frühschoppen in einer gemeinsamen Reihe. Bei jedem Wirt lässt sich
  festlegen, ob er Schießabende und/oder Frühschoppen übernimmt (im Rotationsdialog oder unter „Helfer“,
  Feld `slots` der Person). Wer einen Dienst nicht übernehmen kann, am selben Abend Aufsicht hat oder am
  Wochenende davor/danach schon dran ist, wird übersprungen und kommt beim nächsten passenden Dienst als Erster
  dran – höchstens eine Runde Rückstand, damit z. B. „nur Schießabend“-Wirte nach dem Sommer nicht alle Samstage
  nachholen. Reihenfolge (`rotationOrder`) und Auswahl werden beim Start gespeichert. „Beginnen mit“ wählt die
  erste Person, der Dialog schlägt vor, mit wem es nach dem letzten Dienst vor dem Start weitergeht.
  Am gleichmäßigsten ist **ein** Lauf für Schießabende und Frühschoppen zusammen. Bei getrennten Läufen zählen
  Dienste aus der anderen Liste im Zeitraum als „war in dieser Runde dran“ – sonst kämen Wirte, die beides machen,
  doppelt so oft dran. Stehen nach dem End-Datum noch Einteilungen (z. B. ein älterer Plan), zeigt der Dialog das
  an und bietet an, bis dorthin mit zu verteilen.
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
