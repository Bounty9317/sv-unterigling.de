/**
 * Rückmeldungen: Bestätigungsdialoge (ersetzen confirm()) und Hinweis-Meldungen (ersetzen alert()).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Modal } from './Modal';

/* ---------- Bestätigen ---------- */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/* ---------- Meldungen ---------- */

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);
const ToastContext = createContext<ToastApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve(value: boolean): void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const toastRegion = useRef<HTMLDivElement>(null);

  // Meldungen liegen als Popover in der obersten Ebene – sichtbar auch über offenen Dialogen.
  useEffect(() => {
    const el = toastRegion.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch {
      /* ältere Browser: Meldungen bleiben im normalen Seitenfluss */
    }
  }, [toasts]);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const finish = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const toastApi = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toastApi}>
        {children}
        <Modal
          open={!!pending}
          onClose={() => finish(false)}
          title={pending?.title ?? ''}
          size="s"
          footer={
            <>
              <button type="button" className="btn" onClick={() => finish(false)}>
                {pending?.cancelLabel ?? 'Abbrechen'}
              </button>
              <button
                type="button"
                className={`btn ${pending?.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => finish(true)}
                autoFocus
              >
                {pending?.confirmLabel ?? 'Bestätigen'}
              </button>
            </>
          }
        >
          {pending?.message && <div className="confirm__message">{pending.message}</div>}
        </Modal>
        <div className="toasts" role="status" aria-live="polite" popover="manual" ref={toastRegion}>
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.tone}`}>
              {toast.tone === 'success' ? (
                <CircleCheck aria-hidden="true" />
              ) : toast.tone === 'error' ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <Info aria-hidden="true" />
              )}
              <span>{toast.message}</span>
              <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Meldung schließen">
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm außerhalb von FeedbackProvider');
  return ctx;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast außerhalb von FeedbackProvider');
  return ctx;
}

/** Fehlermeldung für die Oberfläche (Firestore/Storage/Netzwerk). */
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied' || code === 'storage/unauthorized') {
    return 'Keine Berechtigung für diese Aktion. Bitte melde dich erneut an oder wende dich an den Vorstand.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed') {
    return 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unbekannter Fehler';
}
