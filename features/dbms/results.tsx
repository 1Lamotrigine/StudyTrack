'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SqlResult, Catalog, ObjectDetails } from './types';
import { DbIcon } from './icons';
export function download(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function resultCsv(result: SqlResult) {
  const field = (value: string | null) => (value == null ? '' : `"${value.replace(/"/g, '""')}"`);
  return (
    '\uFEFF' +
    [
      result.fields.map((f) => field(f.name)).join(','),
      ...result.rows.map((r) => r.map(field).join(',')),
    ].join('\r\n')
  );
}
export type CellEdit = { row: (string | null)[]; column: number };
export function ResultGrid({
  result,
  catalog,
  details,
  onEdit,
  onInsert,
  onDelete,
  editable,
}: {
  result: SqlResult;
  catalog: Catalog | null;
  details: ObjectDetails | null;
  onEdit?: (cell: CellEdit) => void;
  onInsert?: () => void;
  onDelete?: (row: (string | null)[]) => void;
  editable: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ index: number; desc: boolean } | null>(null);
  const [pageSize, setPageSize] = useState(100);
  const [cell, setCell] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setPage(0);
    setFilter('');
    setSort(null);
    setCell(undefined);
  }, [result]);
  const rows = useMemo(() => {
    let rows = result.rows
      .map((r, i) => ({ r, i }))
      .filter(
        ({ r }) =>
          !filter || r.some((v) => (v ?? 'NULL').toLowerCase().includes(filter.toLowerCase())),
      );
    if (sort)
      rows = [...rows].sort((a, b) => {
        const av = a.r[sort.index],
          bv = b.r[sort.index];
        let diff =
          av == null ? -1 : bv == null ? 1 : av.localeCompare(bv, undefined, { numeric: true });
        return sort.desc ? -diff : diff;
      });
    return rows;
  }, [result, filter, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, (current + 1) * pageSize);
  const keyNames = details?.columns.filter((c) => c.primary).map((c) => c.name) || [];
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        result.rows.map((r) => r.map((v) => v ?? 'NULL').join('\t')).join('\n'),
      );
    } catch {
      setCell('Копирование недоступно в этом браузере. Используйте CSV или выделение текста.');
    }
  }
  return (
    <div className="db-results-body">
      <div className="db-grid-toolbar">
        <span className="db-grid-summary">
          <strong>{result.rowCount.toLocaleString('ru-RU')}</strong> строк
          {result.truncated ? ' · показаны первые 2 000' : ''}
        </span>
        <div className="db-grid-filter">
          <DbIcon name="search" size={13} />
          <input
            aria-label="Фильтр результатов"
            placeholder="Фильтр загруженных строк…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {editable && (
          <button onClick={onInsert} title="Добавить строку">
            <DbIcon name="add" />
            Строка
          </button>
        )}
        <button onClick={copy} title="Копировать загруженные строки">
          <DbIcon name="copy" />
          Копировать
        </button>
        <button
          onClick={() =>
            download('studytrack-results.csv', resultCsv(result), 'text/csv;charset=utf-8')
          }
        >
          <DbIcon name="download" />
          CSV
        </button>
      </div>
      <div className="db-data-scroll">
        <table className="db-data-table">
          <thead>
            <tr>
              <th className="db-row-index">#</th>
              {result.fields.map((f, i) => {
                const column = details?.columns.find((c) => c.name === f.name);
                return (
                  <th key={i}>
                    <button
                      onClick={() =>
                        setSort((s) => ({ index: i, desc: s?.index === i ? !s.desc : false }))
                      }
                    >
                      <span>
                        {keyNames.includes(f.name) && <DbIcon name="key" size={11} />}
                        {f.name}
                        {sort?.index === i && <span>{sort.desc ? '↓' : '↑'}</span>}
                      </span>
                      <small>
                        {catalog?.types[String(f.dataTypeID)] ||
                          column?.type ||
                          `oid ${f.dataTypeID}`}
                      </small>
                    </button>
                  </th>
                );
              })}
              {editable && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ r, i }) => (
              <tr key={i}>
                <td className="db-row-index">{i + 1}</td>
                {r.map((v, c) => {
                  const column = details?.columns.find((x) => x.name === result.fields[c].name);
                  const canEdit =
                    editable && column && !column.primary && !column.generated && !column.identity;
                  return (
                    <td
                      key={c}
                      className={`${v == null ? 'is-null' : ''} ${canEdit ? 'db-cell-editable' : ''}`}
                      title={v == null ? 'NULL' : v}
                      onClick={() => setCell(v)}
                      onDoubleClick={() => canEdit && onEdit?.({ row: r, column: c })}
                    >
                      {v == null ? (
                        <i>NULL</i>
                      ) : v === '' ? (
                        <span className="db-empty-value">пустая строка</span>
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
                {editable && (
                  <td>
                    <button
                      aria-label={`Удалить строку ${i + 1}`}
                      title="Удалить строку"
                      onClick={() => onDelete?.(r)}
                    >
                      <DbIcon name="trash" size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="db-grid-empty">
            {filter ? 'Нет строк, соответствующих фильтру.' : 'Запрос не вернул строк.'}
          </div>
        )}
      </div>
      <div className="db-grid-footer">
        <span>
          {editable
            ? 'Двойной щелчок по ячейке — изменить значение. Ключи редактируются через SQL.'
            : 'Результат SQL-запроса · только просмотр'}
        </span>
        <label>
          Строк на странице
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {[50, 100, 250, 500].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          disabled={current === 0}
          onClick={() => setPage((p) => p - 1)}
          aria-label="Предыдущая страница"
        >
          ‹
        </button>
        <span>
          {current + 1} / {pages}
        </span>
        <button
          disabled={current === pages - 1}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Следующая страница"
        >
          ›
        </button>
      </div>
      {cell !== undefined && (
        <div className="db-cell-inspector">
          <span>Значение ячейки</span>
          <pre>{cell == null ? 'NULL' : cell}</pre>
          <button aria-label="Закрыть просмотр ячейки" onClick={() => setCell(undefined)}>
            <DbIcon name="close" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
