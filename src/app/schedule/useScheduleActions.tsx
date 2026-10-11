/**
 * Alle Aktionen im Einteilungskalender – mit Rückfragen, Konfliktprüfung und Meldungen.
 */
import { useSchedule } from '../data/schedule-data';
import {
  acceptSwap,
  assignPerson,
  createSwap,
  deleteSwap,
  moveAssignment,
  removeAssignments,
  saveNote,
} from '../data/repo';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { formatDate, formatDateWithWeekday } from '../../lib/dates';
import { indexAssignments } from '../../lib/schedule/model';
import { eveningConflict } from '../../lib/schedule/conflicts';
import { effectiveSlot, expectedSlots, swapTarget } from '../../lib/schedule/slots';
import {
  SLOT_LABEL,
  TYPE_LABEL_SINGULAR,
  type Assignment,
  type DayNote,
  type Person,
  type ScheduleType,
  type Slot,
  type SwapRequest,
} from '../../lib/schedule/types';

export function slotText(type: ScheduleType, slot: Slot) {
  return type === 'aufsicht' ? 'Schießaufsicht' : SLOT_LABEL[slot];
}

export function useScheduleActions(type: ScheduleType) {
  const schedule = useSchedule();
  const confirm = useConfirm();
  const toast = useToast();
  const other: ScheduleType = type === 'wirte' ? 'aufsicht' : 'wirte';

  const occupants = (date: string, slot: Slot) =>
    indexAssignments(type, schedule.assignments[type], schedule.dayRules).get(date)?.get(slot) ?? [];

  /** Rückfragen bei belegtem Dienst und Abend-Konflikten. Liefert, was ersetzt bzw. entfernt wird. */
  async function preflight(date: string, slot: Slot, personName: string, ignoreId?: string) {
    const current = occupants(date, slot).filter((a) => a.id !== ignoreId);
    const others = current.filter((a) => a.person !== personName);
    if (current.length && !others.length && current.length === 1) {
      toast.info(`${personName} ist dort bereits eingeteilt.`);
      return null;
    }
    if (others.length) {
      const ok = await confirm({
        title: 'Bereits eingeteilt',
        message: `„${others[0]!.person}“ ist bereits als ${TYPE_LABEL_SINGULAR[type]} am ${formatDate(date)} (${slotText(type, slot)}) eingeteilt. Möchtest du „${others[0]!.person}“ durch „${personName}“ ersetzen?`,
        confirmLabel: 'Ersetzen',
      });
      if (!ok) return null;
    }

    let removeOther: Assignment | undefined;
    if (slot === 'schiessabend') {
      const clash = eveningConflict(type, personName, date, schedule.assignments[other], schedule.dayRules);
      if (clash && type === 'wirte') {
        const ok = await confirm({
          title: 'Doppelte Einteilung',
          message: `${personName} ist am ${formatDate(date)} bereits als Schießaufsicht eingeteilt. Trotzdem auch als Wirt (Schießabend) einteilen?`,
          confirmLabel: 'Trotzdem einteilen',
        });
        if (!ok) return null;
      }
      if (clash && type === 'aufsicht') {
        const ok = await confirm({
          title: 'Doppelte Einteilung',
          message: `${personName} ist am ${formatDate(date)} als Wirt am Schießabend eingeteilt. Die Wirt-Einteilung wird entfernt und ${personName} als Schießaufsicht eingeteilt.`,
          confirmLabel: 'Einverstanden',
        });
        if (!ok) return null;
        removeOther = clash;
      }
    }
    return { replace: current, removeOther };
  }

  async function assign(date: string, slot: Slot, person: Person) {
    const check = await preflight(date, slot, person.name);
    if (!check) return false;
    try {
      if (check.removeOther) {
        await removeAssignments(other, [{ assignment: check.removeOther, slot: 'schiessabend' }], schedule.swaps[other]);
      }
      await assignPerson(type, { date, slot }, person, check.replace, schedule.swaps[type]);
      toast.success(`${person.name} am ${formatDateWithWeekday(date)} eingeteilt (${slotText(type, slot)}).`);
      return true;
    } catch (error) {
      toast.error(`Fehler beim Speichern: ${errorMessage(error)}`);
      return false;
    }
  }

  async function move(assignment: Assignment, date: string, slot: Slot) {
    const fromSlot = effectiveSlot(type, assignment, schedule.dayRules);
    if (assignment.date === date && fromSlot === slot) return false;
    const check = await preflight(date, slot, assignment.person, assignment.id);
    if (!check) return false;
    try {
      if (check.removeOther) {
        await removeAssignments(other, [{ assignment: check.removeOther, slot: 'schiessabend' }], schedule.swaps[other]);
      }
      await moveAssignment(type, assignment, fromSlot, { date, slot }, check.replace, schedule.swaps[type]);
      toast.success(`${assignment.person} auf ${formatDateWithWeekday(date)} verschoben.`);
      return true;
    } catch (error) {
      toast.error(`Fehler beim Verschieben: ${errorMessage(error)}`);
      return false;
    }
  }

  async function remove(assignment: Assignment, ask = true) {
    const slot = effectiveSlot(type, assignment, schedule.dayRules);
    if (ask) {
      const ok = await confirm({
        title: 'Einteilung löschen?',
        message: `Einteilung für ${assignment.person} am ${formatDate(assignment.date)} (${slotText(type, slot)}) löschen?`,
        confirmLabel: 'Löschen',
        tone: 'danger',
      });
      if (!ok) return false;
    }
    try {
      await removeAssignments(type, [{ assignment, slot }], schedule.swaps[type]);
      toast.success('Einteilung gelöscht.');
      return true;
    } catch (error) {
      toast.error(`Fehler beim Löschen: ${errorMessage(error)}`);
      return false;
    }
  }

  async function note(date: string, text: string, existing?: DayNote) {
    try {
      await saveNote(type, date, text, existing);
      toast.success(text.trim() ? 'Info gespeichert.' : 'Info entfernt.');
      return true;
    } catch (error) {
      toast.error(`Fehler beim Speichern der Info: ${errorMessage(error)}`);
      return false;
    }
  }

  async function requestSwap(assignment: Assignment, replacement: Person) {
    const slot = effectiveSlot(type, assignment, schedule.dayRules);
    try {
      await createSwap(type, assignment, slot, replacement);
      toast.success(`Tausch-Anfrage an ${replacement.name} gesendet!`);
      return true;
    } catch (error) {
      toast.error(`Fehler beim Senden der Anfrage: ${errorMessage(error)}`);
      return false;
    }
  }

  /** Einteilung zu einer Tauschanfrage finden (auch bei älteren Anfragen ohne ID). */
  function findSwapAssignment(swap: SwapRequest): Assignment | undefined {
    const list = schedule.assignments[type];
    if (swap.assignmentId) {
      const byId = list.find((a) => a.id === swap.assignmentId);
      if (byId) return byId;
    }
    const target = swapTarget(swap);
    return list.find(
      (a) =>
        a.date === target.date &&
        a.person === swap.requestPerson &&
        (!target.slot || type === 'aufsicht' || effectiveSlot(type, a, schedule.dayRules) === target.slot),
    );
  }

  async function accept(swap: SwapRequest) {
    const assignment = findSwapAssignment(swap);
    const replacement = schedule.persons[type].find((p) => p.name === swap.replacementPerson);
    if (!assignment) {
      toast.error('Die zugehörige Einteilung gibt es nicht mehr. Die Anfrage kann gelöscht werden.');
      return false;
    }
    if (!replacement) {
      toast.error(`„${swap.replacementPerson ?? '?'}“ ist nicht (mehr) in der Helferliste.`);
      return false;
    }
    const ok = await confirm({
      title: 'Tausch bestätigen',
      message: `${replacement.name} übernimmt am ${formatDateWithWeekday(assignment.date)} den Dienst von ${swap.requestPerson}.`,
      confirmLabel: `${replacement.name} übernimmt`,
    });
    if (!ok) return false;
    try {
      await acceptSwap(type, swap, assignment, replacement);
      toast.success('Tausch abgeschlossen.');
      return true;
    } catch (error) {
      toast.error(`Fehler beim Tauschen: ${errorMessage(error)}`);
      return false;
    }
  }

  async function dismissSwap(swap: SwapRequest, label = 'Anfrage zurückziehen') {
    const ok = await confirm({
      title: `${label}?`,
      message:
        swap.status === 'completed'
          ? 'Der Eintrag wird aus der Liste entfernt. Die Einteilung bleibt unverändert.'
          : `Die Tauschanfrage von ${swap.requestPerson} für den ${formatDate(swapTarget(swap).date)} wird gelöscht.`,
      confirmLabel: label,
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      await deleteSwap(type, swap.id);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  /** Dienst bestimmen, wenn auf einen ganzen Tag gezogen wird (nur eindeutige Fälle). */
  function singleSlot(date: string): Slot | null {
    const slots = expectedSlots(type, date, schedule.dayRules);
    return slots.length === 1 ? slots[0]! : null;
  }

  return { assign, move, remove, note, requestSwap, accept, dismissSwap, findSwapAssignment, singleSlot };
}
