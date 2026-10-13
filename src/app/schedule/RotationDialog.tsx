import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Calculator, GripVertical, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { colorVar } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { useSchedule } from '../data/schedule-data';
import { applyRotation } from '../data/repo';
import { newerVersionOnline } from '../version';
import { Link } from '../router';
import { formatDate, formatDateWithWeekday, todayISO, weekday, WEEKDAYS_SHORT } from '../../lib/dates';
import {
  applyPlan,
  bestOrder,
  continueAfterLast,
  findBackToBack,
  lastBeforeStart,
  planInSequence,
  planRotation,
  rotationEntries,
  withoutTargets,
  type RotationEntry,
} from '../../lib/schedule/rotation';
import { effectiveSlot } from '../../lib/schedule/slots';
import { SLOT_LABEL, TYPE_LABEL, canTake, isPlaceholder, queueMembers, type Person, type ScheduleType, type Slot } from '../../lib/schedule/types';

interface Row {
  person: Person;
  included: boolean;
}

interface Queue {
  slot: Slot;
  enabled: boolean;
  rows: Row[];
  /** Wer beginnt? null = Nr. 1 der Liste */
  startWith: string | null;
}

const QUEUE_TITLE: Record<ScheduleType, Partial<Record<Slot, string>>> = {
  wirte: { schiessabend: 'Schießabende (Samstage und 26.12.)', fruehschoppen: 'Frühschoppen (Sonntage, Feiertage, Sondertage)' },
  aufsicht: { schiessabend: 'Schießabende (Samstage)' },
};

const short = (name: string) => name.split(' ')[0];
const dayLabel = (date: string) => `${WEEKDAYS_SHORT[weekday(date)]} ${date.slice(8, 10)}.${date.slice(5, 7)}.`;

export function RotationDialog({ type, open, onClose }: { type: ScheduleType; open: boolean; onClose(): void }) {
  const schedule = useSchedule();
  const confirm = useConfirm();
  const toast = useToast();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [queues, setQueues] = useState<Queue[]>([]);
  const [include26, setInclude26] = useState(true);
  const [busy, setBusy] = useState(false);
  const [computing, setComputing] = useState(false);
  const [bestInfo, setBestInfo] = useState<string | null>(null);
  // Veraltetes Programm in einem länger offenen Fenster? Dann keine Rotation (sie würde nach alten Regeln verteilen)
  const [outdated, setOutdated] = useState(false);

  const existing = schedule.assignments[type];
  const otherType = schedule.assignments[type === 'wirte' ? 'aufsicht' : 'wirte'];
  const rules = schedule.dayRules;

  useEffect(() => {
    if (!open) return;
    setStart(todayISO());
    setEnd(`${new Date().getFullYear() + 1}-12-31`);
    const slots: Slot[] = type === 'wirte' ? ['schiessabend', 'fruehschoppen'] : ['schiessabend'];
    setQueues(
      slots.map((slot) => ({
        slot,
        enabled: true,
        rows: queueMembers(type, schedule.persons[type], slot).map((person) => ({ person, included: true })),
        startWith: null,
      })),
    );
    setInclude26(true);
    setBestInfo(null);
    setOutdated(false);
    void newerVersionOnline().then(setOutdated);
    // nur beim Öffnen initialisieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const validRange = !!start && !!end && start <= end;
  const entriesFor = (slot: Slot): RotationEntry[] => {
    if (!validRange) return [];
    const options =
      type === 'aufsicht'
        ? { includeSaturdays: true, includeSundays: false, includeHolidays: include26 }
        : slot === 'schiessabend'
          ? { includeSaturdays: true, includeSundays: false, includeHolidays: false }
          : { includeSaturdays: false, includeSundays: true, includeHolidays: true };
    return rotationEntries(type, start, end, options, rules).filter((e) => e.slot === slot);
  };

  /** Reihenfolge, mit der die Reihe verteilt wird: aktive Personen der Liste, gedreht auf die Startperson */
  const orderOf = (queue: Queue) => {
    const active = queue.rows.filter((r) => r.included).map((r) => r.person);
    const last = validRange ? lastBeforeStart(type, existing, active, queue.slot, start, rules) : null;
    const index = active.findIndex((p) => p.id === queue.startWith);
    return {
      active,
      last,
      ordered: index < 0 ? active : [...active.slice(index), ...active.slice(0, index)],
      /** wer nach der zuletzt eingeteilten Person dran wäre */
      next: last ? continueAfterLast(active, last)[0] : undefined,
    };
  };

  // Plan: erst die Schießabende, dann die Frühschoppen passend dazu
  const steps = queues.filter((q) => q.enabled).map((q) => ({ entries: entriesFor(q.slot), queues: { [q.slot]: orderOf(q).ordered } }));
  const plan = useMemo(
    () => planInSequence(steps, { type, existing, otherType, rules }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(steps.map((s) => [s.entries.length, s.entries[0]?.date, Object.values(s.queues)[0]?.map((p) => p.id)])), existing, otherType, rules, type],
  );
  const after = useMemo(() => applyPlan(existing, plan), [existing, plan]);
  const backToBack = useMemo(() => (validRange ? findBackToBack(after, start, end) : []), [after, validRange, start, end]);
  const totalEntries = steps.reduce((sum, s) => sum + s.entries.length, 0);

  // Einteilungen nach dem End-Datum bleiben unverändert – Hinweis, falls dort noch ein älterer Plan steht
  const later = end ? existing.filter((a) => a.date > end && !isPlaceholder(a.person)) : [];
  const lastLater = later.reduce<string | null>((max, a) => (!max || a.date > max ? a.date : max), null);
  const laterMismatched = later.filter((a) => {
    const p = schedule.persons[type].find((x) => x.name === a.person);
    return p && !canTake(type, p, effectiveSlot(type, a, rules));
  }).length;

  const updateQueue = (slot: Slot, change: (q: Queue) => Queue) => setQueues((list) => list.map((q) => (q.slot === slot ? change(q) : q)));

  function move(slot: Slot, from: number, to: number) {
    updateQueue(slot, (q) => {
      if (to < 0 || to >= q.rows.length || from === to) return q;
      const rows = [...q.rows];
      const [item] = rows.splice(from, 1);
      rows.splice(to, 0, item!);
      return { ...q, rows };
    });
    setBestInfo(null);
  }

  /** Frühschoppen-Reihenfolge so wählen, dass sie am besten zu den Schießabenden passt */
  function computeBest() {
    const sunday = queues.find((q) => q.slot === 'fruehschoppen');
    if (!sunday || !validRange) return;
    const { ordered } = orderOf(sunday);
    if (ordered.length < 2) return;
    setComputing(true);
    setBestInfo(null);
    // kurz warten, damit „Rechne…“ erscheint – bei 8 Personen sind es gut 40.000 Reihenfolgen
    window.setTimeout(() => {
      try {
        // Bestand ohne die Termine, die dieser Lauf neu besetzt – plus die geplanten Schießabende
        const evening = queues.find((q) => q.slot === 'schiessabend');
        const sundayEntries = entriesFor('fruehschoppen');
        const eveningEntries = evening?.enabled ? entriesFor('schiessabend') : [];
        const remaining = withoutTargets(type, existing, [...sundayEntries, ...eveningEntries], rules);
        const base = evening?.enabled
          ? applyPlan(remaining, planRotation({ type, entries: eveningEntries, queues: { schiessabend: orderOf(evening).ordered }, existing: remaining, otherType, rules }))
          : remaining;
        const result = bestOrder({ type, slot: 'fruehschoppen', entries: sundayEntries, current: ordered, existing: base, otherType, rules });
        const best = result.best.order;
        updateQueue('fruehschoppen', (q) => ({
          ...q,
          rows: [...best.map((p) => q.rows.find((r) => r.person.id === p.id)!), ...q.rows.filter((r) => !r.included)],
          startWith: best[0]!.id,
        }));
        setBestInfo(
          `${result.tried.toLocaleString('de-DE')} Reihenfolgen geprüft: ${best.map((p, i) => `${i + 1}. ${short(p.name)}`).join(', ')} – ` +
            `${result.best.backToBack.length === 1 ? '1 Wirt' : `${result.best.backToBack.length} Wirte`} an zwei Wochenenden hintereinander` +
            ` (bisherige Reihenfolge: ${result.current.backToBack.length}).`,
        );
      } finally {
        setComputing(false);
      }
    }, 30);
  }

  async function start_() {
    if (outdated || (await newerVersionOnline())) {
      setOutdated(true);
      toast.error('Die Seite wurde inzwischen aktualisiert – bitte neu laden und die Rotation dann starten.');
      return;
    }
    if (!validRange) {
      toast.error('Bitte gültige Start- und End-Daten eingeben!');
      return;
    }
    if (!queues.some((q) => q.enabled && orderOf(q).ordered.length)) {
      toast.error('Bitte mindestens eine Reihe mit mindestens einer Person auswählen!');
      return;
    }
    if (!plan.creates.length) {
      toast.error('Keine passenden Tage im ausgewählten Zeitraum gefunden!');
      return;
    }
    const ok = await confirm({
      title: 'Einteilung übernehmen?',
      message: (
        <div className="stack">
          <p>
            Rotation von {formatDate(start)} bis {formatDate(end)}:
          </p>
          <ul>
            {queues
              .filter((q) => q.enabled)
              .map((q) => (
                <li key={q.slot}>
                  {QUEUE_TITLE[type][q.slot]}: {plan.creates.filter((c) => c.slot === q.slot).length} Dienste, Reihenfolge{' '}
                  {orderOf(q).ordered.map((p, i) => `${i + 1}. ${short(p.name)}`).join(', ')}
                </li>
              ))}
          </ul>
          {backToBack.length > 0 && <p>{backToBack.length}× ist jemand an zwei Wochenenden hintereinander dran (siehe Vorschau).</p>}
          <p>
            <strong>{plan.deleteIds.length} bestehende Einteilung(en) an diesen Terminen werden überschrieben!</strong>
          </p>
        </div>
      ),
      confirmLabel: 'Übernehmen',
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Reihenfolge jeder verteilten Reihe merken (Liste wie angezeigt), damit die nächste Rotation genauso weiterläuft
      await applyRotation(
        type,
        plan,
        queues.filter((q) => q.enabled).map((q) => ({ slot: q.slot, order: q.rows.map((r) => r.person) })),
      );
      toast.success(`✓ ${plan.creates.length === 1 ? '1 Dienst' : `${plan.creates.length} Dienste`} eingeteilt – reihum in der festgelegten Reihenfolge.`);
      onClose();
    } catch (error) {
      toast.error(`Fehler bei der Rotation: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Automatische Rotation – ${TYPE_LABEL[type]}`}
      description="Jede Reihe läuft von Nr. 1 bis zum Ende und beginnt dann wieder bei Nr. 1."
      size="l"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            ✗ Abbrechen
          </button>
          <button type="button" className="btn btn--primary" onClick={start_} disabled={busy || outdated || computing || !plan.creates.length}>
            <RefreshCw aria-hidden="true" />{' '}
            {busy ? 'Wird eingeteilt…' : `Einteilung übernehmen (${plan.creates.length === 1 ? '1 Dienst' : `${plan.creates.length} Dienste`})`}
          </button>
        </>
      }
    >
      <div className="form">
        {outdated && (
          <div className="alert alert--warning" role="alert">
            <span>
              Die Seite wurde inzwischen aktualisiert. Bitte zuerst neu laden – sonst würde die Rotation nach den alten
              Regeln verteilen.
            </span>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => window.location.reload()}>
              Jetzt neu laden
            </button>
          </div>
        )}
        <div className="form__row">
          <div className="field">
            <label className="label" htmlFor="rot-start">
              Start-Datum:
            </label>
            <input id="rot-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="rot-end">
              End-Datum:
            </label>
            <input id="rot-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {later.length > 0 && lastLater && (
          <p className="hint hint--warning" role="note">
            Nach dem End-Datum sind bis {formatDate(lastLater)} noch {later.length === 1 ? '1 Dienst' : `${later.length} Dienste`}{' '}
            eingeteilt – sie bleiben, wie sie sind
            {laterMismatched > 0 &&
              `, davon ${laterMismatched === 1 ? 'einer' : laterMismatched} bei Wirten, die diesen Dienst laut Auswahl nicht machen`}
            .{' '}
            <button type="button" className="link-btn" onClick={() => setEnd(lastLater)}>
              Bis {formatDate(lastLater)} mit verteilen
            </button>
          </p>
        )}
        {type === 'wirte' && (
          <p className="hint">
            In jeder Reihe stehen nur die Wirte, die diesen Dienst machen – festgelegt unter{' '}
            <Link to="/vorstand/helfer">Helfer</Link>. Erst werden die Schießabende verteilt, dann die Frühschoppen passend
            dazu. Getauscht wird nur, wenn es nicht anders geht (z. B. Schießaufsicht am selben Abend).
          </p>
        )}

        <div className={`rotation-queues${queues.length > 1 ? ' rotation-queues--two' : ''}`}>
          {queues.map((queue) => (
            <QueueEditor
              key={queue.slot}
              type={type}
              queue={queue}
              title={QUEUE_TITLE[type][queue.slot]!}
              info={orderOf(queue)}
              include26={include26}
              onInclude26={setInclude26}
              onChange={(change) => {
                updateQueue(queue.slot, change);
                if (queue.slot === 'fruehschoppen') setBestInfo(null);
              }}
              onMove={(from, to) => move(queue.slot, from, to)}
              best={
                queue.slot === 'fruehschoppen'
                  ? { onCompute: computeBest, computing, info: bestInfo }
                  : undefined
              }
            />
          ))}
        </div>

        <Preview
          type={type}
          plan={plan}
          totalEntries={totalEntries}
          backToBack={backToBack}
          start={start}
          end={end}
          persons={schedule.persons[type]}
          slots={queues.filter((q) => q.enabled).map((q) => q.slot)}
        />
      </div>
    </Modal>
  );
}

function QueueEditor({
  type,
  queue,
  title,
  info,
  include26,
  onInclude26,
  onChange,
  onMove,
  best,
}: {
  type: ScheduleType;
  queue: Queue;
  title: string;
  info: { active: Person[]; last: { person: string; date: string } | null; ordered: Person[]; next: Person | undefined };
  include26: boolean;
  onInclude26(value: boolean): void;
  onChange(change: (q: Queue) => Queue): void;
  onMove(from: number, to: number): void;
  best?: { onCompute(): void; computing: boolean; info: string | null };
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };
  const first = info.ordered[0];

  return (
    <fieldset className={`rotation-queue${queue.enabled ? '' : ' is-off'}`}>
      <legend className="rotation-queue__title">
        <label className="check">
          <input type="checkbox" checked={queue.enabled} onChange={(e) => onChange((q) => ({ ...q, enabled: e.target.checked }))} />
          <span>{title}</span>
        </label>
      </legend>
      {type === 'aufsicht' && (
        <label className="check">
          <input type="checkbox" checked={include26} onChange={(e) => onInclude26(e.target.checked)} />
          <span>26.12. (Weihnachtsschießen) einbeziehen</span>
        </label>
      )}
      {queue.rows.length === 0 ? (
        <p className="muted">Niemand macht diesen Dienst – bitte unter „Helfer“ festlegen.</p>
      ) : (
        <ol className="rotation-list">
          {queue.rows.map((row, index) => {
            const position = info.active.indexOf(row.person);
            return (
              <li
                key={row.person.id}
                className={`rotation-item${dragIndex === index ? ' is-dragging' : ''}${row.included ? '' : ' is-off'}${row.person.id === first?.id ? ' is-first' : ''}`}
                style={colorVar(row.person.color)}
                draggable
                onDragStart={onDragStart(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (!Number.isNaN(from)) onMove(from, index);
                  setDragIndex(null);
                }}
              >
                <label className="rotation-item__check">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) =>
                      onChange((q) => ({ ...q, rows: q.rows.map((r, i) => (i === index ? { ...r, included: e.target.checked } : r)) }))
                    }
                  />
                  <span>
                    {position >= 0 ? `${position + 1}.` : '–'} {row.person.name}
                  </span>
                </label>
                <span className="rotation-item__tools">
                  <button type="button" className="icon-btn" onClick={() => onMove(index, index - 1)} aria-label="Nach oben" disabled={index === 0}>
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onMove(index, index + 1)}
                    aria-label="Nach unten"
                    disabled={index === queue.rows.length - 1}
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <GripVertical aria-hidden="true" className="rotation-item__grip" />
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {info.active.length > 1 && (
        <div className="field">
          <label className="label" htmlFor={`rot-first-${queue.slot}`}>
            Beginnen mit:
          </label>
          <select
            id={`rot-first-${queue.slot}`}
            className="input"
            value={queue.startWith ?? info.active[0]?.id ?? ''}
            onChange={(e) => onChange((q) => ({ ...q, startWith: e.target.value }))}
          >
            {info.active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {info.last && (
            <span className="hint">
              Zuletzt vor dem Start: {info.last.person} am {formatDateWithWeekday(info.last.date)}
              {info.next && info.next.id !== first?.id && (
                <>
                  {' – '}
                  <button type="button" className="link-btn" onClick={() => onChange((q) => ({ ...q, startWith: info.next!.id }))}>
                    mit {info.next.name} weitermachen
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      )}
      {best && queue.enabled && info.active.length > 1 && (
        <div className="rotation-queue__best">
          <button type="button" className="btn btn--sm" onClick={best.onCompute} disabled={best.computing}>
            <Calculator aria-hidden="true" /> {best.computing ? 'Rechne…' : 'Beste Reihenfolge berechnen'}
          </button>
          <span className="hint">
            {best.info ?? 'Wählt die Reihenfolge, bei der am wenigsten Wirte an zwei Wochenenden hintereinander dran sind.'}
          </span>
        </div>
      )}
    </fieldset>
  );
}

function Preview({
  type,
  plan,
  totalEntries,
  backToBack,
  start,
  end,
  persons,
  slots,
}: {
  type: ScheduleType;
  plan: ReturnType<typeof planInSequence>;
  totalEntries: number;
  backToBack: ReturnType<typeof findBackToBack>;
  start: string;
  end: string;
  persons: Person[];
  slots: Slot[];
}) {
  if (!totalEntries) return null;
  const counts = persons
    .map((p) => ({ name: p.name, n: plan.creates.filter((c) => c.person === p.name).length }))
    .filter((c) => c.n > 0);
  const marked = new Set(backToBack.flatMap((b) => [`${b.first}|${b.person}`, `${b.second}|${b.person}`]));
  return (
    <section className="rotation-preview" aria-label="Vorschau">
      <h3>Vorschau</h3>
      <p className="hint">
        {plan.creates.length} Dienste vom {formatDate(start)} bis {formatDate(end)} ·{' '}
        {counts.map((c) => `${short(c.name)} ${c.n}`).join(', ')}
      </p>
      {backToBack.length > 0 ? (
        <p className="hint hint--warning">
          An zwei Wochenenden hintereinander:{' '}
          {backToBack.map((b) => `${short(b.person)} ${dayLabel(b.first)} → ${dayLabel(b.second)}`).join(' · ')}
        </p>
      ) : (
        <p className="hint">✓ Niemand ist an zwei Wochenenden hintereinander dran.</p>
      )}
      {plan.swaps.length > 0 && (
        <p className="hint">
          Platz getauscht, weil es nicht anders ging:{' '}
          {plan.swaps.map((s) => `${dayLabel(s.date)} ${short(s.person)} statt ${short(s.expected)}`).join(' · ')}
        </p>
      )}
      {plan.unfillable.length > 0 && (
        <p className="hint hint--warning">
          Ohne Reihe, bleiben unverändert: {plan.unfillable.map((e) => `${formatDate(e.date)} (${SLOT_LABEL[e.slot]})`).join(', ')}
        </p>
      )}
      <div className={`rotation-preview__cols${slots.length > 1 ? ' rotation-preview__cols--two' : ''}`}>
        {slots.map((slot) => (
          <ol key={slot} className="rotation-preview__list" aria-label={QUEUE_TITLE[type][slot]}>
            {plan.creates
              .filter((c) => c.slot === slot)
              .map((c) => (
                <li key={`${c.date}|${c.slot}`} className={marked.has(`${c.date}|${c.person}`) ? 'is-warn' : undefined}>
                  <span className="rotation-preview__date">{dayLabel(c.date)}</span> {c.person}
                </li>
              ))}
          </ol>
        ))}
      </div>
    </section>
  );
}
