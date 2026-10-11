/**
 * Galerie: Zugriff auf die Cloud Functions (Cloudinary) und Upload.
 * Im Emulator-Modus wird eine Attrappe verwendet, damit sich die Oberfläche ohne
 * Cloudinary-Zugangsdaten testen lässt.
 */
import { CLOUDINARY, FUNCTIONS_BASE, USE_EMULATORS } from './config';

export interface GalleryImage {
  public_id: string;
  secure_url: string;
  created_at: string;
  width?: number;
  height?: number;
  approved?: boolean;
  tags?: string[];
}

export interface GalleryFolder {
  name: string;
  path: string;
  /** Anzahl freigegebener Bilder (neue Function-Version liefert das direkt mit) */
  imageCount?: number;
  /** Anzahl aller Bilder inkl. nicht freigegebener */
  totalCount?: number;
  cover?: string;
}

export interface GalleryApi {
  listFolders(): Promise<GalleryFolder[]>;
  publicImages(folder: string): Promise<GalleryImage[]>;
  adminImages(folder: string, token: string): Promise<GalleryImage[]>;
  approve(ids: string[], token: string): Promise<number>;
  unapprove(ids: string[], token: string): Promise<number>;
  remove(ids: string[], token: string): Promise<number>;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* kein JSON */
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '';
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data as T;
}

const remoteApi: GalleryApi = {
  async listFolders() {
    const data = await getJson<{ success?: boolean; folders?: GalleryFolder[] }>(`${FUNCTIONS_BASE}/listEventFolders`);
    return Array.isArray(data.folders) ? data.folders : [];
  },
  async publicImages(folder) {
    const data = await getJson<{ images?: GalleryImage[] }>(
      `${FUNCTIONS_BASE}/publicApprovedImages?event=${encodeURIComponent(folder)}`,
    );
    return Array.isArray(data.images) ? data.images : [];
  },
  async adminImages(folder, token) {
    const data = await getJson<{ images?: GalleryImage[] }>(
      `${FUNCTIONS_BASE}/adminListImages?event=${encodeURIComponent(folder)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return Array.isArray(data.images) ? data.images : [];
  },
  async approve(ids, token) {
    const data = await postAdmin<{ approved?: number }>('adminApproveImages', ids, token);
    return data.approved ?? ids.length;
  },
  async unapprove(ids, token) {
    const data = await postAdmin<{ unapproved?: number }>('adminUnapproveImages', ids, token);
    return data.unapproved ?? ids.length;
  },
  async remove(ids, token) {
    const data = await postAdmin<{ deleted?: number }>('adminDeleteImages', ids, token);
    return data.deleted ?? ids.length;
  },
};

function postAdmin<T>(endpoint: string, publicIds: string[], token: string) {
  return getJson<T>(`${FUNCTIONS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicIds }),
  });
}

let apiPromise: Promise<GalleryApi> | undefined;

export function galleryApi(): Promise<GalleryApi> {
  apiPromise ??= USE_EMULATORS
    ? import('./gallery-mock').then((m) => m.mockGalleryApi)
    : Promise.resolve(remoteApi);
  return apiPromise;
}

export interface FolderSummary {
  name: string;
  count: number;
  cover?: string;
}

/**
 * Liefert alle Ordner mit mindestens einem freigegebenen Bild. Neue Function-Versionen
 * liefern Anzahl und Titelbild direkt; ältere werden pro Ordner abgefragt.
 */
export async function loadFolderSummaries(): Promise<FolderSummary[]> {
  const api = await galleryApi();
  const folders = await api.listFolders();
  const summaries = await mapLimit(folders, 4, async (folder): Promise<FolderSummary> => {
    if (typeof folder.imageCount === 'number') {
      return { name: folder.name, count: folder.imageCount, cover: folder.cover };
    }
    try {
      const images = await api.publicImages(folder.name);
      return { name: folder.name, count: images.length, cover: images[0]?.secure_url };
    } catch {
      return { name: folder.name, count: 0 };
    }
  });
  return summaries
    .filter((s) => s.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Cloudinary-Bild-URL mit Transformation (Größe, Format, Qualität). */
export function cloudinaryUrl(url: string, transform: string): string {
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
}

export const thumbUrl = (url: string) => cloudinaryUrl(url, 'c_fill,g_auto,w_480,h_480,q_auto,f_auto');
export const coverUrl = (url: string) => cloudinaryUrl(url, 'c_fill,g_auto,w_720,h_450,q_auto,f_auto');
export const largeUrl = (url: string) => cloudinaryUrl(url, 'c_limit,w_1800,h_1800,q_auto,f_auto');
export const masonryUrl = (url: string) => cloudinaryUrl(url, 'c_limit,w_640,q_auto,f_auto');

/* ---------- Upload ---------- */

export const UPLOAD_LIMITS = {
  maxFiles: 20,
  maxBytes: 10 * 1024 * 1024,
  extensions: ['jpg', 'jpeg', 'png', 'gif'],
  mimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
} as const;

export function validateUploadFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeOk =
    (UPLOAD_LIMITS.mimeTypes as readonly string[]).includes(file.type) ||
    (UPLOAD_LIMITS.extensions as readonly string[]).includes(ext);
  if (!typeOk) return 'Nur JPG, PNG oder GIF erlaubt';
  if (file.size > UPLOAD_LIMITS.maxBytes) return 'Größer als 10 MB';
  return null;
}

/** Erlaubt Buchstaben (inkl. Umlaute), Ziffern, Leerzeichen und - _ . – wie bisher übliche Ordnernamen. */
export function isValidFolderName(name: string): boolean {
  return /^[\p{L}\p{N} _.\-]{1,80}$/u.test(name.trim()) && name.trim() !== '.' && name.trim() !== '..';
}

export function uploadImage(
  file: File,
  folder: string,
  onProgress: (fraction: number) => void,
): Promise<{ public_id: string; secure_url: string }> {
  if (USE_EMULATORS) {
    return import('./gallery-mock').then((m) => m.mockUpload(file, folder, onProgress));
  }
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', CLOUDINARY.uploadPreset);
    body.append('folder', `${CLOUDINARY.folderPrefix}${folder}`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener('load', () => {
      let data: { public_id?: string; secure_url?: string; error?: { message?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignorieren */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.public_id && data.secure_url) {
        onProgress(1);
        resolve({ public_id: data.public_id, secure_url: data.secure_url });
      } else {
        reject(new Error(data.error?.message || `Upload fehlgeschlagen (HTTP ${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Netzwerkfehler beim Hochladen')));
    xhr.send(body);
  });
}
