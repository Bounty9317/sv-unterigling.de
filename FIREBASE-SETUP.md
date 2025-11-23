# Firebase Setup Anleitung

## 1. Firestore Security Rules hochladen

1. Gehen Sie zur Firebase Console: https://console.firebase.google.com/
2. Wählen Sie Ihr Projekt: `schuetzenverein-12cfa`
3. Navigieren Sie zu **Firestore Database** → **Rules**
4. Kopieren Sie den Inhalt aus `firestore.rules` und fügen Sie ihn ein
5. Klicken Sie auf **Veröffentlichen**

## 2. Firestore Collections erstellen

Die Collections werden automatisch erstellt, wenn die erste Zuweisung gemacht wird. Sie können sie aber auch manuell anlegen:

1. Gehen Sie zu **Firestore Database** → **Data**
2. Klicken Sie auf **Collection starten**
3. Erstellen Sie folgende Collections:
   - `wirte-assignments`
   - `wirte-swaps`
   - `aufsicht-assignments`
   - `aufsicht-swaps`
   - `events` (bereits vorhanden)
   - `protocols` (bereits vorhanden)

## 3. Helfer-Benutzer erstellen

### Für Helfer (Wirte & Schießaufsicht):

1. Gehen Sie zu **Authentication** → **Users**
2. Klicken Sie auf **Nutzer hinzufügen**
3. Erstellen Sie Accounts im Format:
   - **E-Mail:** `vorname.nachname@helfer.schuetzenverein.local`
   - **Passwort:** Wählen Sie ein sicheres Passwort
   
**Beispiele:**
- `max.mustermann@helfer.schuetzenverein.local`
- `anna.schmidt@helfer.schuetzenverein.local`
- `zink.alex@helfer.schuetzenverein.local`
- `zink.michi@helfer.schuetzenverein.local`

**Wichtig:** Die E-Mail MUSS `@helfer.schuetzenverein.local` enthalten!

### Für Vorstände:

Vorstände nutzen normale E-Mail-Adressen (OHNE @helfer.schuetzenverein.local):
- Beispiel: `vorstand@schuetzenverein.de`

## 4. Berechtigungen

Nach dem Setup gelten folgende Regeln:

### Helfer können:
- ✅ Wirte-Kalender sehen und bearbeiten
- ✅ Schießaufsicht-Kalender sehen und bearbeiten
- ✅ Tausch-Anfragen erstellen und bestätigen
- ✅ Listen herunterladen
- ❌ NICHT in den Vorstandsbereich (Events, Protokolle)

### Vorstände können:
- ✅ Alles was Helfer können
- ✅ Events verwalten
- ✅ Protokolle hochladen
- ✅ Zugriff auf alle Bereiche

## 5. Login-URLs

- **Helfer:** https://ihre-domain.de/helfer-login.html
- **Vorstand:** https://ihre-domain.de/admin-login.html

## 6. Test

1. Erstellen Sie einen Test-Helfer-Account
2. Loggen Sie sich über `/helfer-login.html` ein
3. Versuchen Sie, `/admin-dashboard.html` direkt aufzurufen
4. Sie sollten eine Fehlermeldung sehen und zurück zur Startseite geleitet werden

## Troubleshooting

**Problem:** "Permission denied" Fehler
- **Lösung:** Überprüfen Sie, ob die Firestore Rules korrekt hochgeladen wurden

**Problem:** Helfer können sich nicht einloggen
- **Lösung:** Überprüfen Sie, ob die E-Mail `@helfer.schuetzenverein.local` enthält

**Problem:** Vorstände können nicht auf Helfer-Bereich zugreifen
- **Lösung:** Das ist normal! Vorstände sollten normale E-Mail-Adressen haben (ohne @helfer)
