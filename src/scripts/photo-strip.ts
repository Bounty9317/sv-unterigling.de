/**
 * Fotostreifen „Einblicke“: lädt freigegebene Bilder eines Galerie-Ordners (z. B. „Vereinsleben“).
 * Gibt es dort keine, wird der Ordner mit den meisten Bildern genommen. Neue Fotos erscheinen automatisch.
 */
import { galleryApi, loadFolderSummaries, thumbUrl, type GalleryImage } from '../lib/gallery';

const MAX = 9;

function galleryLink(folder: string) {
  return `/galerie?ordner=${encodeURIComponent(folder)}`;
}

function render(root: HTMLElement, folder: string, images: GalleryImage[]) {
  const list = root.querySelector<HTMLUListElement>('[data-photos]');
  const more = root.querySelector<HTMLAnchorElement>('[data-photos-more]');
  if (!list) return;

  list.replaceChildren(
    ...images.slice(0, MAX).map((image, i) => {
      const li = document.createElement('li');
      li.className = 'photos__item';
      const a = document.createElement('a');
      a.href = galleryLink(folder);
      a.className = 'photos__link';
      const img = document.createElement('img');
      img.src = thumbUrl(image.secure_url);
      img.alt = `${folder} – Bild ${i + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 480;
      img.height = 480;
      a.append(img);
      li.append(a);
      return li;
    }),
  );

  if (more) {
    more.href = galleryLink(folder);
    const rest = images.length - Math.min(images.length, MAX);
    const label = more.querySelector('[data-photos-more-label]');
    if (label) label.textContent = rest > 0 ? `Alle ${images.length} Bilder ansehen` : 'Zur Galerie';
  }
}

async function load(root: HTMLElement) {
  const preferred = root.dataset.folder ?? '';
  try {
    const api = await galleryApi();
    let folder = preferred;
    let images = preferred ? await api.publicImages(preferred).catch(() => []) : [];
    if (!images.length) {
      const [biggest] = (await loadFolderSummaries()).sort((a, b) => b.count - a.count);
      if (biggest) {
        folder = biggest.name;
        images = await api.publicImages(biggest.name);
      }
    }
    if (!images.length) throw new Error('keine Bilder');
    render(root, folder, images);
  } catch {
    // Ohne Bilder (oder bei einer Störung) den Abschnitt ausblenden – die Seite funktioniert auch ohne.
    root.hidden = true;
  }
}

export function initPhotoStrips() {
  document.querySelectorAll<HTMLElement>('[data-photo-strip]').forEach((root) => {
    // erst laden, wenn der Abschnitt in die Nähe des sichtbaren Bereichs kommt
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void load(root);
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(root);
  });
}
