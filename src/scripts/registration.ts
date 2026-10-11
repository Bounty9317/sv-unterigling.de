import { formatDate } from '../lib/dates';
import type { VereinsEvent } from '../lib/events';

/** Öffnet den Dialog „Anmeldung zur Veranstaltung“ für einen Termin. */
export function openRegistration(event: VereinsEvent) {
  const dialog = document.querySelector<HTMLDialogElement>('#anmeldung');
  if (!dialog) return;

  const eventName = dialog.querySelector<HTMLElement>('[data-registration-event]');
  if (eventName) eventName.textContent = `${event.title} am ${formatDate(event.date)}`;

  const mail = dialog.querySelector<HTMLAnchorElement>('[data-registration-mail]');
  if (mail) {
    const address = mail.dataset.address ?? '';
    const subject = `Anmeldung zur Veranstaltung: ${event.title} (${formatDate(event.date)})`;
    const body = `Hallo,\n\nhiermit melde ich mich für „${event.title}“ am ${formatDate(event.date)} an.\n\nName:\nAnzahl Personen:\n\nViele Grüße`;
    mail.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  dialog.showModal();
}

export function initRegistrationDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('#anmeldung');
  if (!dialog) return;
  dialog.querySelectorAll('[data-dialog-close]').forEach((button) =>
    button.addEventListener('click', () => dialog.close()),
  );
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
