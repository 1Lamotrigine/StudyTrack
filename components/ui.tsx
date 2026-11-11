import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './icon';
import { labels } from '@/lib/format';
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="lead">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  return (
    <span className={`badge badge-${status || 'neutral'}`}>
      {children || labels[status || ''] || status}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label,
  icon = 'file',
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="btn secondary" href={href}>
          {label || 'Открыть курсы'}
          <Icon name="arrow" size={16} />
        </Link>
      )}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-group">
      <div>
        <span>{label}</span>
        <strong>{Math.round(n)}%</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(n)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span style={{ width: `${n}%` }} />
      </div>
    </div>
  );
}
export function Metric({
  label,
  value,
  hint,
  icon = 'chart',
  tone = 'purple',
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon?: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <div className={`metric-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
export function Notice({ kind = 'info', children }: { kind?: string; children: ReactNode }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'error' || kind === 'warn' ? 'alert' : 'check'} size={18} />
      <span>{children}</span>
    </div>
  );
}
