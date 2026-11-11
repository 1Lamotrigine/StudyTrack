'use client';
import { useEffect, useState } from 'react';
import type { DbColumn } from './types';
import { DbIcon } from './icons';
export function EditDialog({
  title,
  columns,
  initial,
  onClose,
  onSave,
  busy,
}: {
  title: string;
  columns: DbColumn[];
  initial: Record<string, string | null>;
  onClose: () => void;
  onSave: (values: Record<string, string | null>) => Promise<void>;
  busy: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, initial[c.name] ?? ''])),
  );
  const [modes, setModes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      columns.map((c) => [
        c.name,
        c.name in initial
          ? initial[c.name] === null
            ? 'null'
            : 'value'
          : c.default || c.nullable
            ? 'default'
            : 'value',
      ]),
    ),
  );
  const [error, setError] = useState('');
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [busy, onClose]);
  return (
    <div className="db-modal-backdrop">
      <section
        className="db-modal db-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="db-edit-heading"
      >
        <header>
          <h2 id="db-edit-heading">{title}</h2>
          <button aria-label="Закрыть" onClick={onClose} disabled={busy}>
            <DbIcon name="close" />
          </button>
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await onSave(
                Object.fromEntries(
                  columns
                    .filter((c) => modes[c.name] !== 'default')
                    .map((c) => [c.name, modes[c.name] === 'null' ? null : values[c.name]]),
                ),
              );
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <div className="db-edit-fields">
            {error && (
              <div className="db-dialog-error" role="alert">
                {error}
              </div>
            )}
            {columns.map((c, i) => (
              <div className="db-edit-field" key={c.name}>
                <label htmlFor={'db-col-' + c.name}>
                  {c.name}
                  <code>{c.type}</code>
                  {!c.nullable && <small>NOT NULL</small>}
                </label>
                <div>
                  <textarea
                    id={'db-col-' + c.name}
                    autoFocus={i === 0}
                    disabled={modes[c.name] !== 'value' || busy}
                    value={values[c.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
                  />
                  <select
                    aria-label={`Режим значения ${c.name}`}
                    disabled={busy}
                    value={modes[c.name]}
                    onChange={(e) => setModes((v) => ({ ...v, [c.name]: e.target.value }))}
                  >
                    <option value="value">Значение</option>
                    {c.nullable && <option value="null">NULL</option>}
                    {!(c.name in initial) && <option value="default">DEFAULT</option>}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <footer>
            <span>Изменение выполнится в настоящей базе данных.</span>
            <button type="button" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button className="db-primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
