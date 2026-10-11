import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 's' | 'm' | 'l';
}

/** Dialog auf Basis des nativen <dialog>: Fokusfalle, Esc und Hintergrund-Klick inklusive. */
export function Modal({ open, onClose, title, description, children, footer, size = 'm' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        pointerDownOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && pointerDownOnBackdrop.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="dialog__header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p className="dialog__description">{description}</p>}
            </div>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Schließen">
              <X aria-hidden="true" />
            </button>
          </div>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <div className="dialog__footer">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
