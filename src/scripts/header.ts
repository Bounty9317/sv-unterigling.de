import { initCountdown } from './countdown';

const THEME_KEY = 'svu-theme';

function currentTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initThemeToggle() {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* Speicher nicht verfügbar – Auswahl gilt nur für diese Seite */
      }
    });
  });
}

function initMobileMenu() {
  const dialog = document.querySelector<HTMLDialogElement>('#mobile-menu');
  const openButton = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!dialog || !openButton) return;

  openButton.addEventListener('click', () => {
    dialog.showModal();
    openButton.setAttribute('aria-expanded', 'true');
  });
  dialog.addEventListener('close', () => openButton.setAttribute('aria-expanded', 'false'));
  dialog.querySelector('[data-menu-close]')?.addEventListener('click', () => dialog.close());
  // Klick auf den abgedunkelten Hintergrund schließt das Menü
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // Bei großem Fenster wird das Menü überflüssig
  window.matchMedia('(min-width: 1141px)').addEventListener('change', (e) => {
    if (e.matches && dialog.open) dialog.close();
  });
}

export function initHeader() {
  initThemeToggle();
  initMobileMenu();
  initCountdown();
}
