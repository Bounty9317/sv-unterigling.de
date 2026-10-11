/** Zwei-Klick-Lösung für Google Maps: Die Karte lädt erst nach Zustimmung. */
export const MAP_CONSENT_KEY = 'svu-karten-erlaubt';

export function hasMapConsent(): boolean {
  try {
    return localStorage.getItem(MAP_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMapConsent(allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(MAP_CONSENT_KEY, '1');
    else localStorage.removeItem(MAP_CONSENT_KEY);
  } catch {
    /* ignorieren */
  }
}

function loadMap(container: HTMLElement) {
  const src = container.dataset.src;
  if (!src || container.querySelector('iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = 'Google Maps Karte - Schützenverein Unterigling';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.allowFullscreen = true;
  container.querySelector('[data-map-placeholder]')?.remove();
  container.append(iframe);
}

export function initMaps() {
  document.querySelectorAll<HTMLElement>('[data-map]').forEach((container) => {
    if (hasMapConsent()) {
      loadMap(container);
      return;
    }
    container.querySelector('[data-map-load]')?.addEventListener('click', () => {
      const remember = container.querySelector<HTMLInputElement>('[data-map-remember]');
      if (remember?.checked) setMapConsent(true);
      loadMap(container);
    });
  });
}
