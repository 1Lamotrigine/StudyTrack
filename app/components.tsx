import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Row } from '@/lib/db';
import { labels, formatDateTime } from '@/lib/format';
import { Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icon';
export { Form, Field, Select } from '@/components/forms';
export const statuses = (values: string[]) =>
  values.map((id) => ({
    id,
    title: labels[id] || ({ true: 'Да', false: 'Нет' } as Row)[id] || id,
  }));
export function value(v: unknown): string {
  if (v == null) return '—';
  if (v instanceof Date) return formatDateTime(v);
  if (typeof v === 'boolean') return v ? 'Да' : 'Нет';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
export function Table({
  rows,
  columns,
  link,
}: {
  rows: Row[];
  columns: Record<string, string>;
  link?: (r: Row) => string;
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Object.entries(columns).map(([k, c]) => (
              <th scope="col" key={k}>
                {c}
              </th>
            ))}
            {link && <th scope="col" aria-label="Действие" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {Object.keys(columns).map((k) => (
                <td key={k}>
                  {['status', 'role', 'action'].includes(k) && labels[r[k]] ? (
                    <Badge status={r[k]} />
                  ) : k === 'is_active' ? (
                    <Badge status={r[k] ? 'active' : 'archived'}>
                      {r[k] ? 'Активен' : 'Отключён'}
                    </Badge>
                  ) : k === 'is_late' ? (
                    <Badge status={r[k] ? 'late' : 'active'}>
                      {r[k] ? 'С опозданием' : 'В срок'}
                    </Badge>
                  ) : (
                    value(r[k])
                  )}
                </td>
              ))}
              {link && (
                <td>
                  <Link
                    className="table-link"
                    aria-label={`Открыть: ${r.title || r.full_name || r.assignment_title || r.student_name || 'запись'}`}
                    href={link(r)}
                  >
                    Открыть
                    <Icon name="arrow" size={15} />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="Здесь пока пусто"
      description="Записи появятся, когда вы добавите данные или измените условия поиска."
    />
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}
