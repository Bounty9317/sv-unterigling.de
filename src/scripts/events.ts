import { MONTHS_SHORT, WEEKDAYS_SHORT, formatDateLong, parseISODate, todayISO } from '../lib/dates';
import {
  eventToIcs,
  groupByMonth,
  icsFileName,
  pastEvents,
  upcomingEvents,
  type VereinsEvent,
} from '../lib/events';
import { iconAlert, iconBan, iconCalendarPlus, iconClock } from '../lib/icons-inline';
import { loadEvents } from '../lib/public-data';
import { openRegistration } from './registration';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function withIcon(svg: string, text: string, className?: string) {
  const span = el('span', className);
  span.innerHTML = svg; // statisches Icon-Markup
  span.append(document.createTextNode(text));
  return span;
}

function renderEvent(event: VereinsEvent): HTMLLIElement {
  const item = el('li', 'event-card');
  if (event.cancelled) item.classList.add('is-cancelled');

  const d = parseISODate(event.date);
  const dateTile = el('div', 'event-date');
  dateTile.setAttribute('aria-hidden', 'true');
  dateTile.append(
    el('span', 'event-date__day', String(d.getDate())),
    el('span', 'event-date__month', MONTHS_SHORT[d.getMonth()]),
    el('span', 'event-date__weekday', WEEKDAYS_SHORT[d.getDay()]),
  );

  const body = el('div', 'event-card__body');
  const meta = el('div', 'event-card__meta');
  if (event.cancelled) {
    meta.append(withIcon(iconBan, 'ABGESAGT', 'badge badge--danger'));
  }
  const when = `${formatDateLong(event.date)}${event.time ? ` · ${event.time} Uhr` : ''}`;
  meta.append(withIcon(iconClock, when, 'event-card__when'));

  const title = el('h3', 'event-card__title', event.title);
  body.append(meta, title);

  if (event.description?.trim()) {
    body.append(el('p', 'event-card__desc', event.description.trim()));
  }

  const actions = el('div', 'event-card__actions');
  const isUpcoming = event.date >= todayISO();
  if (event.registrationRequired && !event.cancelled && isUpcoming) {
    actions.append(withIcon(iconAlert, 'Anmeldung erforderlich', 'badge badge--warning'));
    const register = el('button', 'btn btn--primary btn--sm', 'Jetzt anmelden');
    register.type = 'button';
    register.addEventListener('click', () => openRegistration(event));
    actions.append(register);
  }
  if (!event.cancelled && isUpcoming) {
    const ics = el('button', 'btn btn--ghost btn--sm');
    ics.type = 'button';
    ics.innerHTML = iconCalendarPlus;
    ics.append(document.createTextNode('In Kalender'));
    ics.setAttribute('aria-label', `${event.title} in den eigenen Kalender übernehmen`);
    ics.addEventListener('click', () => downloadIcs(event));
    actions.append(ics);
  }
  if (actions.childElementCount) body.append(actions);

  item.append(dateTile, body);
  return item;
}

function renderGroups(events: VereinsEvent[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const group of groupByMonth(events)) {
    fragment.append(el('h3', 'event-month', group.label));
    const list = el('ul', 'event-items');
    list.setAttribute('role', 'list');
    group.items.forEach((event) => list.append(renderEvent(event)));
    fragment.append(list);
  }
  return fragment;
}

function downloadIcs(event: VereinsEvent) {
  const blob = new Blob([eventToIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = icsFileName(event);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function emptyMessage() {
  return el('p', 'event-empty', 'Aktuell keine kommenden Veranstaltungen.');
}

export async function initEventLists() {
  const lists = document.querySelectorAll<HTMLElement>('[data-event-list]');
  if (!lists.length) return;

  let events: VereinsEvent[];
  try {
    events = await loadEvents();
  } catch (error) {
    console.error('Veranstaltungen konnten nicht geladen werden', error);
    lists.forEach((list) => {
      list.querySelector('[data-event-loading]')?.remove();
      list.querySelector('[data-event-content]')?.replaceChildren(
        el('p', 'event-error', 'Fehler beim Laden der Veranstaltungen. Bitte später erneut versuchen.'),
      );
    });
    return;
  }

  const today = todayISO();
  lists.forEach((list) => {
    const content = list.querySelector<HTMLElement>('[data-event-content]');
    list.querySelector('[data-event-loading]')?.remove();
    if (!content) return;

    const limit = Number(list.dataset.limit) || undefined;
    const upcoming = upcomingEvents(events, today).slice(0, limit);
    content.replaceChildren(upcoming.length ? renderGroups(upcoming) : emptyMessage());

    if (list.dataset.past === 'true') {
      const past = pastEvents(events, today);
      if (past.length) {
        const details = el('details', 'past-events');
        details.append(el('summary', undefined, `Vergangene Veranstaltungen (${past.length})`), renderGroups(past));
        content.append(details);
      }
    }
  });
}
