import { findNextShooting, formatCountdown, type NextShooting } from '../lib/countdown';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, formatDate, MONTHS } from '../lib/dates';
import { loadEvents, loadShootingDates } from '../lib/public-data';

const SUMMER_BREAK_TEXT = 'Sommerpause bis Okt';

/**
 * Countdown „Nächstes Schießen“ – füllt alle Elemente mit [data-countdown]:
 *   [data-countdown-timer]  kompakt: „6T 3h 12m 45s“
 *   [data-countdown-date]   „Sa, 17.10. · 19:30 Uhr“
 *   [data-countdown-when]   „Samstag, 17. Oktober · 19:30 Uhr“
 *   [data-cd="d|h|m|s"]     einzelne Ziffernblöcke
 *   data-state="loading|ready|now|break" am jeweiligen Element
 */
export async function initCountdown() {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-countdown]'));
  if (!roots.length) return;

  let next: NextShooting | null = null;
  try {
    const [dates, events] = await Promise.all([loadShootingDates(), loadEvents().catch(() => [])]);
    next = findNextShooting(dates, events);
  } catch {
    next = null;
  }

  const setText = (selector: string, text: string) =>
    roots.forEach((root) => root.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.textContent = text)));

  if (!next) {
    roots.forEach((root) => (root.dataset.state = 'break'));
    setText('[data-countdown-timer]', SUMMER_BREAK_TEXT);
    setText('[data-countdown-when]', 'Die Schießsaison startet im Oktober.');
    return;
  }

  const target = next;
  const d = target.start;
  setText('[data-countdown-date]', `${WEEKDAYS_SHORT[d.getDay()]}, ${formatDate(target.date).slice(0, 6)} · ${target.time} Uhr`);
  setText('[data-countdown-when]', `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} · ${target.time} Uhr`);
  roots.forEach((root) => (root.title = `Nächstes Schießen: ${formatDate(target.date)}, ${target.time} Uhr`));

  const pad = (n: number) => String(n).padStart(2, '0');
  const tick = () => {
    const diff = target.start.getTime() - Date.now();
    if (diff <= 0) {
      roots.forEach((root) => (root.dataset.state = 'now'));
      setText('[data-countdown-timer]', 'Jetzt!');
      setText('[data-cd]', '00');
      return;
    }
    roots.forEach((root) => (root.dataset.state = 'ready'));
    setText('[data-countdown-timer]', formatCountdown(diff));
    const total = Math.floor(diff / 1000);
    const parts = {
      d: String(Math.floor(total / 86400)),
      h: pad(Math.floor((total % 86400) / 3600)),
      m: pad(Math.floor((total % 3600) / 60)),
      s: pad(total % 60),
    };
    for (const [key, value] of Object.entries(parts)) setText(`[data-cd="${key}"]`, value);
  };
  tick();
  window.setInterval(tick, 1000);
}
