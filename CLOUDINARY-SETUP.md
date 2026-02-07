# 🖼️ Cloudinary Integration - Setup Anleitung

Sichere Bildverwaltung mit Firebase Functions und Cloudinary für den Schützenverein Unterigling.

## ✅ Was wurde erstellt?

1. **Firebase Functions** (`functions/src/index.ts`)
   - `adminListImages` - Liste aller Bilder eines Events (Admin)
   - `adminApproveImages` - Bilder freigeben (Admin)
   - `adminUnapproveImages` - Freigabe entfernen (Admin)
   - `publicApprovedImages` - Freigegebene Bilder abrufen (Public)

2. **Admin-Claim Tool** (`functions/src/setAdminClaim.ts`)
   - Script zum Setzen des Admin-Claims für Vorstands-User

3. **Dokumentation** (`functions/README.md`)
   - Vollständige API-Dokumentation
   - Beispiel-Requests
   - Frontend-Integration

## 🚀 Deployment-Schritte

### 1. Cloudinary Account einrichten

Falls noch nicht vorhanden:
1. Registriere dich auf [cloudinary.com](https://cloudinary.com)
2. Notiere dir:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 2. Firebase Secrets setzen

```bash
# Cloud Name setzen
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
# Eingabe: dein_cloud_name

# API Key setzen
firebase functions:secrets:set CLOUDINARY_API_KEY
# Eingabe: dein_api_key

# API Secret setzen
firebase functions:secrets:set CLOUDINARY_API_SECRET
# Eingabe: dein_api_secret
```

### 3. Functions deployen

```bash
# Aus dem Root-Verzeichnis
firebase deploy --only functions
```

Das dauert ein paar Minuten. Nach erfolgreichem Deployment siehst du die URLs:
```
✔  functions[adminListImages(europe-west1)] Successful create operation.
✔  functions[adminApproveImages(europe-west1)] Successful create operation.
✔  functions[adminUnapproveImages(europe-west1)] Successful create operation.
✔  functions[publicApprovedImages(europe-west1)] Successful create operation.
```

### 4. Admin-Claim für Vorstand setzen

**Option A: Mit Service Account Key (empfohlen)**

1. Firebase Console → Project Settings → Service Accounts
2. "Generate new private key" klicken
3. JSON-Datei als `functions/serviceAccountKey.json` speichern
4. UID des Vorstands-Users finden (Firebase Console → Authentication)
5. Admin-Claim setzen:
   ```bash
   cd functions
   npm run set-admin-claim <UID>
   ```

**Option B: Über Firebase Console**

Alternativ kannst du eine temporäre Function erstellen (siehe `functions/README.md`).

### 5. Testen

**Public Endpoint (keine Auth):**
```bash
curl "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/publicApprovedImages?event=test-event"
```

**Admin Endpoint (mit Token):**
```bash
# Token im Frontend holen:
# const token = await firebase.auth().currentUser.getIdToken();

curl "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminListImages?event=test-event" \
  -H "Authorization: Bearer <TOKEN>"
```

## 📝 Nächste Schritte

### Frontend-Integration

1. **Admin-UI für Bildfreigabe erstellen**
   - Seite zum Anzeigen aller Bilder eines Events
   - Checkboxen zum Auswählen
   - "Freigeben" / "Freigabe entfernen" Buttons

2. **Public Galerie implementieren**
   - Seite zum Anzeigen freigegebener Bilder
   - Lightbox für Vollansicht
   - Filter nach Events

3. **Upload-Funktion mit Event-Tags**
   - Cloudinary Upload Widget integrieren
   - Event-Tag automatisch setzen
   - Upload nur für angemeldete User

### Beispiel Admin-UI Code

```javascript
// Token holen
const token = await firebase.auth().currentUser.getIdToken();

// Bilder laden
const response = await fetch(
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminListImages?event=fasching-2026',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const data = await response.json();

// Bilder anzeigen
data.images.forEach(img => {
  const div = document.createElement('div');
  div.innerHTML = `
    <img src="${img.secure_url}" width="200">
    <input type="checkbox" data-id="${img.public_id}" ${img.approved ? 'checked' : ''}>
    ${img.approved ? '✅ Freigegeben' : '⏳ Ausstehend'}
  `;
  gallery.appendChild(div);
});

// Freigeben
const selectedIds = Array.from(document.querySelectorAll('input:checked'))
  .map(cb => cb.dataset.id);

await fetch(
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminApproveImages',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicIds: selectedIds })
  }
);
```

## 🔒 Sicherheit

- ✅ Cloudinary Credentials nur in Firebase Secrets
- ✅ Admin-Endpunkte prüfen Auth Token + Custom Claim
- ✅ Public-Endpunkt liefert nur freigegebene Bilder
- ✅ CORS aktiviert für Frontend-Zugriff
- ✅ Service Account Key nicht in Git

## 📚 Weitere Dokumentation

Siehe `functions/README.md` für:
- Detaillierte API-Dokumentation
- Alle Endpunkte mit Beispielen
- Troubleshooting
- Lokale Entwicklung mit Emulator

## ⚠️ Wichtig

1. **Service Account Key** (`serviceAccountKey.json`) NIEMALS in Git committen!
2. **Secrets** nur über Firebase CLI setzen, nicht im Code
3. **Admin-Claim** nur für vertrauenswürdige User setzen
4. **Rate Limits** beachten (Cloudinary Free: 500 requests/hour)

## 🆘 Support

Bei Problemen:
1. Logs anschauen: `firebase functions:log`
2. README lesen: `functions/README.md`
3. Secrets prüfen: `firebase functions:secrets:access CLOUDINARY_CLOUD_NAME`
