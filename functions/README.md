# Firebase Functions für Cloudinary Bildverwaltung

Sichere Schnittstelle zwischen Frontend und Cloudinary für die Bildfreigabe durch den Vorstand.

## 🏗️ Architektur

### Konzept
- **Alle Uploads** gehen direkt nach Cloudinary
- **Event-Tags**: Jedes Bild bekommt beim Upload `event_<eventSlug>` (z.B. `event_fasching-2026`)
- **Freigabe-Tag**: Freigegebene Bilder bekommen zusätzlich Tag `approved`
- **Öffentlich sichtbar**: Nur Bilder mit `approved` UND `event_<eventSlug>`

### Sicherheit
- ✅ Cloudinary Credentials nur in Firebase Secrets (nicht im Frontend)
- ✅ Admin-Endpunkte prüfen Firebase Auth Token + Custom Claim `admin: true`
- ✅ Public-Endpunkt ohne Auth, liefert nur freigegebene Bilder
- ✅ CORS aktiviert für Frontend-Zugriff

## 📦 Installation

### 1. Dependencies installieren
```bash
cd functions
npm install
```

### 2. Cloudinary Secrets setzen

```bash
# Cloud Name
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
# Eingabe: dein_cloud_name

# API Key
firebase functions:secrets:set CLOUDINARY_API_KEY
# Eingabe: dein_api_key

# API Secret
firebase functions:secrets:set CLOUDINARY_API_SECRET
# Eingabe: dein_api_secret
```

**Cloudinary Credentials finden:**
1. Login auf [cloudinary.com](https://cloudinary.com)
2. Dashboard → Account Details
3. Kopiere: Cloud Name, API Key, API Secret

### 3. Functions deployen

```bash
# Aus dem Root-Verzeichnis
firebase deploy --only functions

# Oder nur aus functions/
npm run deploy
```

## 🔐 Admin-Claim setzen

Damit ein User Admin-Funktionen nutzen kann, muss der Custom Claim gesetzt werden.

### Methode 1: Service Account Key (lokal)

1. **Service Account Key herunterladen:**
   - Firebase Console → Project Settings → Service Accounts
   - "Generate new private key" klicken
   - JSON-Datei als `functions/serviceAccountKey.json` speichern
   - ⚠️ **WICHTIG**: Diese Datei NICHT in Git committen!

2. **UID des Users finden:**
   - Firebase Console → Authentication → Users
   - UID kopieren (z.B. `abc123xyz...`)

3. **Admin-Claim setzen:**
   ```bash
   cd functions
   npm run set-admin-claim <UID>
   ```

   Beispiel:
   ```bash
   npm run set-admin-claim abc123xyz456def789
   ```

### Methode 2: Firebase Console (manuell)

Alternativ kannst du eine temporäre Cloud Function erstellen:

```typescript
// In functions/src/index.ts hinzufügen:
export const setAdminClaimByEmail = functions.https.onCall(async (data, context) => {
  // Nur für Entwicklung! In Produktion entfernen!
  const email = data.email;
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  return { success: true, uid: user.uid };
});
```

Dann im Frontend aufrufen:
```javascript
const setAdmin = firebase.functions().httpsCallable('setAdminClaimByEmail');
await setAdmin({ email: 'schuetzenvereinunterigling@gmail.com' });
```

## 🚀 API Endpunkte

Alle Functions sind in Region `europe-west1` deployed.

Base URL: `https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net`

### 1. Admin: Liste aller Bilder eines Events

**Endpunkt:** `GET /adminListImages?event=<eventSlug>`

**Auth:** Bearer Token erforderlich (admin claim)

**Response:**
```json
{
  "success": true,
  "event": "fasching-2026",
  "total": 42,
  "images": [
    {
      "public_id": "events/fasching-2026/img123",
      "secure_url": "https://res.cloudinary.com/...",
      "created_at": "2025-02-07T10:30:00Z",
      "tags": ["event_fasching-2026", "approved"],
      "width": 1920,
      "height": 1080,
      "approved": true
    }
  ]
}
```

**Curl Beispiel:**
```bash
curl -X GET \
  "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminListImages?event=fasching-2026" \
  -H "Authorization: Bearer <ID_TOKEN>"
```

### 2. Admin: Bilder freigeben

**Endpunkt:** `POST /adminApproveImages`

**Auth:** Bearer Token erforderlich (admin claim)

**Body:**
```json
{
  "publicIds": [
    "events/fasching-2026/img123",
    "events/fasching-2026/img456"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "approved": 2,
  "results": [...]
}
```

**Curl Beispiel:**
```bash
curl -X POST \
  "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminApproveImages" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"publicIds": ["events/fasching-2026/img123"]}'
```

### 3. Admin: Freigabe entfernen

**Endpunkt:** `POST /adminUnapproveImages`

**Auth:** Bearer Token erforderlich (admin claim)

**Body:**
```json
{
  "publicIds": [
    "events/fasching-2026/img123"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "unapproved": 1,
  "results": [...]
}
```

**Curl Beispiel:**
```bash
curl -X POST \
  "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminUnapproveImages" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"publicIds": ["events/fasching-2026/img123"]}'
```

### 4. Public: Freigegebene Bilder

**Endpunkt:** `GET /publicApprovedImages?event=<eventSlug>`

**Auth:** Keine Auth erforderlich

**Response:**
```json
{
  "success": true,
  "event": "fasching-2026",
  "total": 15,
  "images": [
    {
      "public_id": "events/fasching-2026/img123",
      "secure_url": "https://res.cloudinary.com/...",
      "created_at": "2025-02-07T10:30:00Z",
      "width": 1920,
      "height": 1080
    }
  ]
}
```

**Curl Beispiel:**
```bash
curl -X GET \
  "https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/publicApprovedImages?event=fasching-2026"
```

## 🖼️ Frontend Integration

### Admin-Bereich (Bildfreigabe)

```javascript
// Token holen
const token = await firebase.auth().currentUser.getIdToken();

// Bilder eines Events laden
const response = await fetch(
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminListImages?event=fasching-2026',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();

// Bilder freigeben
await fetch(
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/adminApproveImages',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      publicIds: ['events/fasching-2026/img123', 'events/fasching-2026/img456']
    })
  }
);
```

### Public Galerie

```javascript
// Freigegebene Bilder laden (keine Auth)
const response = await fetch(
  'https://europe-west1-schuetzenverein-12cfa.cloudfunctions.net/publicApprovedImages?event=fasching-2026'
);
const data = await response.json();

// Bilder anzeigen
data.images.forEach(img => {
  const imgElement = document.createElement('img');
  imgElement.src = img.secure_url;
  imgElement.alt = img.public_id;
  gallery.appendChild(imgElement);
});
```

## 📤 Upload mit Event-Tag

### Cloudinary Upload Preset

1. **Cloudinary Dashboard** → Settings → Upload
2. **Add upload preset** klicken
3. **Preset Name:** z.B. `schuetzenverein_events`
4. **Signing Mode:** `Unsigned` (für direkten Upload vom Frontend)
5. **Folder:** `events` (optional)
6. **Tags:** Hier kannst du KEINE dynamischen Tags setzen

⚠️ **Problem:** Upload Presets können keine dynamischen Tags setzen!

### Lösung: Tag beim Upload mitgeben

```javascript
// Frontend Upload mit Cloudinary Widget
const widget = cloudinary.createUploadWidget({
  cloudName: 'dein_cloud_name',
  uploadPreset: 'schuetzenverein_events',
  tags: ['event_fasching-2026'], // Event-Tag hier setzen!
  folder: 'events/fasching-2026'
}, (error, result) => {
  if (!error && result && result.event === "success") {
    console.log('Upload erfolgreich:', result.info);
  }
});

widget.open();
```

### Alternative: Signed Upload über Backend

Für mehr Kontrolle kannst du eine zusätzliche Function erstellen:

```typescript
// In functions/src/index.ts
export const generateUploadSignature = functions
  .region("europe-west1")
  .runWith({ secrets: ["CLOUDINARY_API_SECRET"] })
  .https.onCall((data, context) => {
    // Auth check optional
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder: `events/${data.eventSlug}`,
      tags: `event_${data.eventSlug}`,
    };
    
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!
    );
    
    return { signature, timestamp, ...params };
  });
```

## 🧪 Testing

### Lokale Emulation

```bash
cd functions
npm run serve
```

Functions laufen dann auf: `http://localhost:5001/schuetzenverein-12cfa/europe-west1/<functionName>`

### Test-Requests

```bash
# Admin List (mit Token)
curl "http://localhost:5001/schuetzenverein-12cfa/europe-west1/adminListImages?event=test-event" \
  -H "Authorization: Bearer <TOKEN>"

# Public List (ohne Token)
curl "http://localhost:5001/schuetzenverein-12cfa/europe-west1/publicApprovedImages?event=test-event"
```

## 🔍 Logs anschauen

```bash
# Alle Function Logs
firebase functions:log

# Nur eine Function
firebase functions:log --only adminListImages

# Live Logs
firebase functions:log --follow
```

## ⚠️ Wichtige Hinweise

1. **Service Account Key**: `serviceAccountKey.json` NIEMALS in Git committen!
2. **Secrets**: Cloudinary Credentials nur über Firebase Secrets setzen
3. **Region**: Alle Functions in `europe-west1` für DSGVO-Konformität
4. **Rate Limits**: Cloudinary hat API Rate Limits (500 requests/hour im Free Plan)
5. **Costs**: Firebase Functions haben ein Free Tier, danach pay-as-you-go

## 📝 Nächste Schritte

1. ✅ Functions deployen
2. ✅ Secrets setzen
3. ✅ Admin-Claim für Vorstand setzen
4. 🔲 Admin-UI für Bildfreigabe bauen
5. 🔲 Public Galerie implementieren
6. 🔲 Upload-Funktion mit Event-Tags integrieren

## 🆘 Troubleshooting

### "Missing or invalid authorization header"
→ Token fehlt oder ist falsch formatiert. Muss `Bearer <token>` sein.

### "User is not an admin"
→ Admin-Claim nicht gesetzt. Siehe "Admin-Claim setzen" oben.

### "Cloudinary credentials not configured"
→ Secrets nicht gesetzt. Siehe "Cloudinary Secrets setzen" oben.

### Functions deployen schlägt fehl
→ Prüfe ob alle Dependencies installiert sind: `cd functions && npm install`

### CORS Fehler im Browser
→ CORS ist aktiviert. Prüfe ob Request von erlaubter Origin kommt.
