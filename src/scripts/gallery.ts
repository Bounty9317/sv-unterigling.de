import {
  coverUrl,
  galleryApi,
  largeUrl,
  masonryUrl,
  loadFolderSummaries,
  type FolderSummary,
  type GalleryImage,
} from '../lib/gallery';
import { iconFolder } from '../lib/icons-inline';

const PARAM = 'ordner';

function message(text: string, error = false) {
  const p = document.createElement('p');
  p.className = `gallery__message${error ? ' gallery__message--error' : ''}`;
  p.textContent = text;
  return p;
}

export function initGallery() {
  const root = document.querySelector<HTMLElement>('[data-gallery]');
  if (!root) return;

  const status = root.querySelector<HTMLElement>('[data-gallery-status]')!;
  const folderList = root.querySelector<HTMLUListElement>('[data-gallery-folders]')!;
  const photoList = root.querySelector<HTMLUListElement>('[data-gallery-photos]')!;
  const bar = root.querySelector<HTMLElement>('[data-gallery-bar]')!;
  const title = root.querySelector<HTMLElement>('[data-gallery-title]')!;
  const count = root.querySelector<HTMLElement>('[data-gallery-count]')!;
  const lightbox = createLightbox();

  let folders: FolderSummary[] | null = null;
  const statusHtml = status.innerHTML;
  const setLoading = (loading: boolean) => {
    status.innerHTML = loading ? statusHtml : '';
  };

  async function showOverview() {
    bar.hidden = true;
    photoList.hidden = true;
    folderList.hidden = false;
    if (folders) return;
    setLoading(true);
    try {
      folders = await loadFolderSummaries();
      setLoading(false);
      if (!folders.length) {
        folderList.replaceChildren(message('Noch keine Bilder verfügbar.'));
        return;
      }
      folderList.replaceChildren(...folders.map(renderFolder));
    } catch (error) {
      console.error(error);
      setLoading(false);
      folders = null;
      folderList.replaceChildren(message('Fehler beim Laden der Veranstaltungen.', true));
    }
  }

  function renderFolder(folder: FolderSummary) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'folder';

    const cover = document.createElement('span');
    cover.className = 'folder__cover';
    cover.innerHTML = iconFolder;
    if (folder.cover) {
      const img = document.createElement('img');
      img.src = coverUrl(folder.cover);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      cover.append(img);
    }

    const body = document.createElement('span');
    body.className = 'folder__body';
    const name = document.createElement('span');
    name.className = 'folder__name';
    name.textContent = folder.name;
    const amount = document.createElement('span');
    amount.className = 'folder__count';
    amount.textContent = `${folder.count} Bild${folder.count !== 1 ? 'er' : ''}`;
    body.append(name, amount);

    button.append(cover, body);
    button.addEventListener('click', () => navigate(folder.name));
    li.append(button);
    return li;
  }

  async function showFolder(name: string) {
    folderList.hidden = true;
    photoList.hidden = false;
    bar.hidden = false;
    title.textContent = name;
    count.textContent = '';
    photoList.replaceChildren();
    setLoading(true);
    try {
      const api = await galleryApi();
      const images = await api.publicImages(name);
      setLoading(false);
      if (!images.length) {
        photoList.replaceChildren(message('Keine Bilder für diese Veranstaltung gefunden.'));
        return;
      }
      count.textContent = `${images.length} Bild${images.length !== 1 ? 'er' : ''}`;
      photoList.replaceChildren(...images.map((img, index) => renderPhoto(img, index, images)));
      title.focus({ preventScroll: true });
    } catch (error) {
      console.error(error);
      setLoading(false);
      photoList.replaceChildren(message('Fehler beim Laden der Bilder.', true));
    }
  }

  function renderPhoto(image: GalleryImage, index: number, all: GalleryImage[]) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo';
    button.setAttribute('aria-label', `Bild ${index + 1} von ${all.length} vergrößern`);
    const img = document.createElement('img');
    img.src = masonryUrl(image.secure_url);
    if (image.width && image.height) {
      img.width = 640;
      img.height = Math.round((640 * image.height) / image.width);
    }
    img.alt = `Bild ${index + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    const date = document.createElement('span');
    date.className = 'photo__date';
    date.textContent = new Date(image.created_at).toLocaleDateString('de-DE');
    button.append(img, date);
    button.addEventListener('click', () => lightbox.open(all, index));
    li.append(button);
    return li;
  }

  function currentFolder() {
    return new URLSearchParams(location.search).get(PARAM);
  }

  function navigate(name: string | null) {
    const url = new URL(location.href);
    if (name) url.searchParams.set(PARAM, name);
    else url.searchParams.delete(PARAM);
    history.pushState({}, '', url);
    void render();
    window.scrollTo({ top: root!.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  }

  async function render() {
    const name = currentFolder();
    if (name) await showFolder(name);
    else await showOverview();
  }

  root.querySelector('[data-gallery-back]')?.addEventListener('click', () => navigate(null));
  window.addEventListener('popstate', () => void render());
  void render();
}

function createLightbox() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]')!;
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
  const info = dialog.querySelector<HTMLElement>('[data-lightbox-info]')!;
  let images: GalleryImage[] = [];
  let index = 0;

  const show = () => {
    const current = images[index];
    if (!current) return;
    img.src = largeUrl(current.secure_url);
    img.alt = `Bild ${index + 1} von ${images.length}`;
    info.textContent = `Bild ${index + 1} von ${images.length}`;
    // Nachbarbilder vorladen
    [index - 1, index + 1].forEach((i) => {
      const neighbour = images[(i + images.length) % images.length];
      if (neighbour) new Image().src = largeUrl(neighbour.secure_url);
    });
  };
  const step = (delta: number) => {
    index = (index + delta + images.length) % images.length;
    show();
  };

  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => step(-1));
  dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => step(1));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // Wischgesten auf Touch-Geräten
  let touchX: number | null = null;
  dialog.addEventListener('touchstart', (e) => (touchX = e.touches[0]?.clientX ?? null), { passive: true });
  dialog.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0]?.clientX;
    if (touchX !== null && endX !== undefined && Math.abs(endX - touchX) > 50) step(endX < touchX ? 1 : -1);
    touchX = null;
  });

  return {
    open(list: GalleryImage[], start: number) {
      images = list;
      index = start;
      show();
      dialog.showModal();
    },
  };
}
