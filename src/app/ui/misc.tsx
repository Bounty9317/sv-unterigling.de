import type { CSSProperties, ReactNode } from 'react';
import { CircleAlert, Inbox } from 'lucide-react';

/** CSS-Variable für Personenfarben (wird per CSSOM gesetzt, CSP-konform) */
export const colorVar = (color: string, name = '--chip') => ({ [name]: color }) as CSSProperties;

export function Spinner({ label = 'Lädt…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox aria-hidden="true" />}
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert--danger" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-title__description">{description}</p>}
      </div>
      {actions && <div className="page-title__actions">{actions}</div>}
    </header>
  );
}

/** Farbiger Namens-Chip einer Helferin / eines Helfers */
export function PersonChip({
  name,
  color,
  struck,
  small,
}: {
  name: string;
  color: string;
  struck?: boolean;
  small?: boolean;
}) {
  return (
    <span className={`chip${small ? ' chip--sm' : ''}${struck ? ' chip--struck' : ''}`} style={colorVar(color)}>
      {name}
    </span>
  );
}
