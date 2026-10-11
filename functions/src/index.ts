/**
 * Cloud Functions für die Galerie (Cloudinary).
 *
 * Öffentlich:  listEventFolders, publicApprovedImages
 * Vorstand:    adminListImages, adminApproveImages, adminUnapproveImages, adminDeleteImages
 *
 * Die Namen und Antwortformate sind kompatibel zur bisherigen Version.
 * Die frühere Function "setAdminClaimByUid" wurde entfernt – sie erlaubte jedem,
 * sich selbst Admin-Rechte zu geben. Admin-Rechte vergibt jetzt nur noch
 * scripts/set-admin-claim.mjs (lokal, mit Service-Account-Schlüssel).
 */
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { v2 as cloudinary } from 'cloudinary';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

const CLOUDINARY_CLOUD_NAME = defineSecret('CLOUDINARY_CLOUD_NAME');
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');
const secrets = [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET];

/** Nur die eigene Webseite (und lokale Entwicklung) darf die Functions aus dem Browser aufrufen. */
const cors = [
  /^https:\/\/(www\.)?schuetzen-unterigling\.de$/,
  'https://schuetzenverein-12cfa.web.app',
  'https://schuetzenverein-12cfa.firebaseapp.com',
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

const MAX_SEARCH_PAGES = 6; // à 500 Bilder

/** Das Vereinskonto (Login "VorstandLamm") hat immer Vorstandsrechte – weitere Konten über den "admin"-Claim. */
const VEREINSKONTO = 'schuetzenvereinunterigling@gmail.com';

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  created_at: string;
  width?: number;
  height?: number;
  tags?: string[];
  asset_folder?: string;
}

function configureCloudinary() {
  const cloudName = CLOUDINARY_CLOUD_NAME.value()?.trim();
  const apiKey = CLOUDINARY_API_KEY.value()?.trim();
  const apiSecret = CLOUDINARY_API_SECRET.value()?.trim();
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary-Zugangsdaten fehlen');
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

async function requireAdmin(req: Request): Promise<string> {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Nicht angemeldet');
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'Anmeldung abgelaufen – bitte neu anmelden');
  }
  if (decoded.admin !== true && decoded.email !== VEREINSKONTO) throw new HttpError(403, 'Keine Vorstandsrechte');
  return decoded.uid;
}

/** Ordnername prüfen – verhindert, dass über den Parameter fremde Suchausdrücke eingeschleust werden. */
function folderParam(req: Request): string {
  const value = typeof req.query.event === 'string' ? req.query.event.trim() : '';
  if (!value || value.length > 80 || !/^[\p{L}\p{N} _.\-]+$/u.test(value) || value === '.' || value === '..') {
    throw new HttpError(400, 'Ungültiger Ordnername');
  }
  return value;
}

function publicIdsParam(req: Request): string[] {
  const ids = (req.body as { publicIds?: unknown } | undefined)?.publicIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    throw new HttpError(400, 'Liste "publicIds" fehlt oder ist ungültig');
  }
  const clean = ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 300 && !/[\u0000-\u001f"\\]/.test(id),
  );
  if (clean.length !== ids.length) throw new HttpError(400, 'Ungültige Bild-ID');
  return [...new Set(clean)];
}

const quote = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

function folderExpression(folder: string) {
  return `(folder:${quote(`events/${folder}`)} OR folder:${quote(folder)} OR tags:${quote(`event_${folder}`)})`;
}

async function searchAll(expression: string, withTags: boolean): Promise<CloudinaryResource[]> {
  const all: CloudinaryResource[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    let search = cloudinary.search.expression(expression).sort_by('created_at', 'desc').max_results(500);
    if (withTags) search = search.with_field('tags');
    if (cursor) search = search.next_cursor(cursor);
    const result = await search.execute();
    all.push(...((result.resources ?? []) as CloudinaryResource[]));
    cursor = result.next_cursor;
    if (!cursor) break;
  }
  return all;
}

/** Ordnername eines Bildes – aus asset_folder oder public_id ("events/Name/bild" bzw. "Name/bild"). */
function folderOf(resource: CloudinaryResource): string | null {
  if (resource.asset_folder?.startsWith('events/')) {
    const name = resource.asset_folder.slice('events/'.length);
    if (name) return name;
  }
  const parts = resource.public_id.split('/');
  if (parts[0] === 'events' && parts.length >= 3) return parts[1] ?? null;
  if (parts.length >= 2) return parts[0] ?? null;
  return null;
}

function toImage(resource: CloudinaryResource, withApproval: boolean) {
  return {
    public_id: resource.public_id,
    secure_url: resource.secure_url,
    created_at: resource.created_at,
    width: resource.width,
    height: resource.height,
    ...(withApproval ? { tags: resource.tags ?? [], approved: resource.tags?.includes('approved') ?? false } : {}),
  };
}

type Handler = (req: Request) => Promise<{ status?: number; body: unknown; cache?: string }>;

/** Gemeinsame Hülle: Methode prüfen, Fehler sauber beantworten. */
function endpoint(method: 'GET' | 'POST', handler: Handler) {
  return onRequest({ cors, secrets, memory: '256MiB', timeoutSeconds: 60 }, async (req, res) => {
    if (req.method !== method) {
      res.status(405).json({ error: 'Methode nicht erlaubt' });
      return;
    }
    try {
      configureCloudinary();
      const result = await handler(req);
      res.set('Cache-Control', result.cache ?? 'no-store');
      res.status(result.status ?? 200).json(result.body);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Fehler in der Galerie-Function', error);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });
}

/** Öffentlich: alle Ordner mit Anzahl freigegebener Bilder und Titelbild (eine einzige Suche). */
export const listEventFolders = endpoint('GET', async () => {
  const resources = await searchAll('resource_type:image', true);
  const folders = new Map<string, { name: string; path: string; imageCount: number; totalCount: number; cover?: string }>();
  for (const resource of resources) {
    const name = folderOf(resource);
    if (!name) continue;
    let folder = folders.get(name);
    if (!folder) {
      folder = { name, path: `events/${name}`, imageCount: 0, totalCount: 0 };
      folders.set(name, folder);
    }
    folder.totalCount++;
    if (resource.tags?.includes('approved')) {
      folder.imageCount++;
      folder.cover ??= resource.secure_url; // neuestes freigegebenes Bild
    }
  }
  const list = [...folders.values()].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
  return {
    body: { success: true, total: list.length, folders: list },
    cache: 'public, max-age=60, s-maxage=300',
  };
});

/** Öffentlich: freigegebene Bilder eines Ordners. */
export const publicApprovedImages = endpoint('GET', async (req) => {
  const folder = folderParam(req);
  const resources = await searchAll(`${folderExpression(folder)} AND tags=approved AND resource_type:image`, false);
  const images = resources.map((r) => toImage(r, false));
  return {
    body: { success: true, event: folder, total: images.length, images },
    cache: 'public, max-age=60, s-maxage=300',
  };
});

/** Vorstand: alle Bilder eines Ordners (freigegeben und ausstehend). */
export const adminListImages = endpoint('GET', async (req) => {
  await requireAdmin(req);
  const folder = folderParam(req);
  const resources = await searchAll(`${folderExpression(folder)} AND resource_type:image`, true);
  const images = resources.map((r) => toImage(r, true));
  return { body: { success: true, event: folder, total: images.length, images } };
});

/** Vorstand: Bilder freigeben. */
export const adminApproveImages = endpoint('POST', async (req) => {
  const uid = await requireAdmin(req);
  const ids = publicIdsParam(req);
  for (let i = 0; i < ids.length; i += 1000) await cloudinary.uploader.add_tag('approved', ids.slice(i, i + 1000));
  logger.info('Bilder freigegeben', { uid, count: ids.length });
  return { body: { success: true, approved: ids.length } };
});

/** Vorstand: Freigabe entfernen. */
export const adminUnapproveImages = endpoint('POST', async (req) => {
  const uid = await requireAdmin(req);
  const ids = publicIdsParam(req);
  for (let i = 0; i < ids.length; i += 1000) await cloudinary.uploader.remove_tag('approved', ids.slice(i, i + 1000));
  logger.info('Freigabe entfernt', { uid, count: ids.length });
  return { body: { success: true, unapproved: ids.length } };
});

/** Vorstand: Bilder endgültig löschen. */
export const adminDeleteImages = endpoint('POST', async (req) => {
  const uid = await requireAdmin(req);
  const ids = publicIdsParam(req);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const result = await cloudinary.api.delete_resources(ids.slice(i, i + 100), { invalidate: true });
    deleted += Object.values(result.deleted ?? {}).filter((state) => state === 'deleted').length;
  }
  logger.info('Bilder gelöscht', { uid, count: deleted });
  return { body: { success: true, deleted } };
});
