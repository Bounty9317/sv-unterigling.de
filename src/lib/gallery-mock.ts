/**
 * Galerie-Attrappe – nur im Emulator-Modus aktiv (lokales Testen ohne Cloudinary).
 * Der Zustand liegt im sessionStorage, damit Freigaben im Vorstandsbereich auch in
 * der öffentlichen Galerie desselben Browsers sichtbar werden.
 */
import type { GalleryApi, GalleryImage } from './gallery';

const KEY = 'svu-gallery-mock';

type State = Record<string, GalleryImage[]>;

function placeholder(label: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 55% 22%)"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="420" r="190" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="22"/><circle cx="600" cy="420" r="100" fill="rgba(255,255,255,.35)"/><text x="600" y="760" font-family="sans-serif" font-size="64" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seed(): State {
  const make = (folder: string, count: number, approvedCount: number, hue: number) =>
    Array.from({ length: count }, (_, i) => ({
      public_id: `events/${folder}/bild-${i + 1}`,
      secure_url: placeholder(`${folder} · ${i + 1}`, hue + i * 9),
      created_at: new Date(Date.UTC(2026, 1, 7 + i)).toISOString(),
      width: 1200,
      height: 900,
      approved: i < approvedCount,
      tags: i < approvedCount ? ['approved'] : [],
    }));
  return {
    'Fasching 2026': make('Fasching 2026', 6, 4, 130),
    'Königsschießen 2026': make('Königsschießen 2026', 3, 3, 40),
    'Sommerfest 2026': make('Sommerfest 2026', 2, 0, 200),
  };
}

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* ignorieren */
  }
  const initial = seed();
  save(initial);
  return initial;
}

function save(state: State) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignorieren */
  }
}

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

function updateTags(ids: string[], approved: boolean) {
  const state = load();
  for (const images of Object.values(state)) {
    for (const image of images) {
      if (ids.includes(image.public_id)) {
        image.approved = approved;
        image.tags = approved ? ['approved'] : [];
      }
    }
  }
  save(state);
}

export const mockGalleryApi: GalleryApi = {
  async listFolders() {
    await delay();
    return Object.keys(load()).map((name) => ({ name, path: `events/${name}` }));
  },
  async publicImages(folder) {
    await delay();
    return (load()[folder] ?? []).filter((img) => img.approved);
  },
  async adminImages(folder) {
    await delay();
    return load()[folder] ?? [];
  },
  async approve(ids) {
    await delay();
    updateTags(ids, true);
    return ids.length;
  },
  async unapprove(ids) {
    await delay();
    updateTags(ids, false);
    return ids.length;
  },
  async remove(ids) {
    await delay();
    const state = load();
    for (const folder of Object.keys(state)) {
      state[folder] = state[folder]!.filter((img) => !ids.includes(img.public_id));
    }
    save(state);
    return ids.length;
  },
};

export async function mockUpload(file: File, folder: string, onProgress: (f: number) => void) {
  for (let step = 1; step <= 5; step++) {
    await delay(120);
    onProgress(step / 5);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const state = load();
  const list = (state[folder] ??= []);
  const image: GalleryImage = {
    public_id: `events/${folder}/${Date.now()}-${file.name}`,
    secure_url: dataUrl.length < 400_000 ? dataUrl : placeholder(file.name, 90),
    created_at: new Date().toISOString(),
    approved: false,
    tags: [],
  };
  list.unshift(image);
  save(state);
  return { public_id: image.public_id, secure_url: image.secure_url };
}
