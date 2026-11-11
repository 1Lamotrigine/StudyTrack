'use client';
import { useState } from 'react';
import type { Catalog, DbObject, ObjectDetails } from './types';
import { DbIcon } from './icons';
export function Explorer({
  catalog,
  selected,
  details,
  onSelect,
  onQuery,
  onRefresh,
  loading,
}: {
  catalog: Catalog | null;
  selected: DbObject | null;
  details: ObjectDetails | null;
  onSelect: (o: DbObject) => void;
  onQuery: (o: DbObject) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set([
        'publicfunction',
        'publicprocedure',
        'publicsequence',
        'publicindex',
        'publictrigger',
        'publicmaterialized_view',
      ]),
  );
  const [columns, setColumns] = useState<Set<number>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((old) => {
      const n = new Set(old);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const groups: [DbObject['kind'], string][] = [
    ['table', 'Таблицы'],
    ['view', 'Представления'],
    ['materialized_view', 'Мат. представления'],
    ['function', 'Функции'],
    ['procedure', 'Процедуры'],
    ['sequence', 'Последовательности'],
    ['index', 'Индексы'],
    ['trigger', 'Триггеры'],
  ];
  return (
    <aside className="db-explorer">
      <div className="db-panel-heading">
        <span>Обозреватель объектов</span>
        <button
          title="Обновить объекты"
          aria-label="Обновить дерево объектов"
          onClick={onRefresh}
          disabled={loading}
        >
          <DbIcon name="refresh" />
        </button>
      </div>
      <div className="db-object-search">
        <DbIcon name="search" size={14} />
        <input
          aria-label="Поиск объекта"
          placeholder="Поиск объектов…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button onClick={() => setFilter('')} aria-label="Сбросить поиск объектов">
            <DbIcon name="close" size={13} />
          </button>
        )}
      </div>
      <div className="db-tree" role="tree" aria-label="Объекты базы StudyTrack">
        <div className="db-tree-root">
          <DbIcon name="down" size={12} />
          <DbIcon name="database" />
          <strong>StudyTrack</strong>
          <span className="db-online-dot" />
        </div>
        <div className="db-tree-engine">PGlite · {catalog?.database.name || 'подключение…'}</div>
        {catalog?.schemas.map((schema) => (
          <div key={schema}>
            <button
              className="db-tree-folder db-schema"
              role="treeitem"
              aria-expanded={!collapsed.has(schema)}
              onClick={() => toggle(schema)}
            >
              <DbIcon name={collapsed.has(schema) ? 'chevron' : 'down'} size={12} />
              <DbIcon name="schema" />
              {schema}
            </button>
            {!collapsed.has(schema) &&
              groups.map(([kind, label]) => {
                const objects = catalog.objects.filter(
                  (o) =>
                    o.schema === schema &&
                    o.kind === kind &&
                    (!filter ||
                      (o.name + ' ' + o.args).toLowerCase().includes(filter.toLowerCase())),
                );
                if (!objects.length) return null;
                const key = schema + kind;
                return (
                  <div key={key} className="db-tree-group">
                    <button
                      className="db-tree-folder"
                      role="treeitem"
                      aria-expanded={!collapsed.has(key)}
                      onClick={() => toggle(key)}
                    >
                      <DbIcon name={collapsed.has(key) ? 'chevron' : 'down'} size={12} />
                      <DbIcon name={kind} />
                      {label}
                      <span>{objects.length}</span>
                    </button>
                    {!collapsed.has(key) &&
                      objects.map((o) => (
                        <div key={o.oid + o.kind}>
                          <button
                            className={`db-tree-object ${selected?.oid === o.oid && selected.kind === o.kind ? 'selected' : ''}`}
                            role="treeitem"
                            aria-selected={selected?.oid === o.oid && selected.kind === o.kind}
                            title={`${o.schema}.${o.name}${o.args != null ? '(' + o.args + ')' : ''}\nДвойной щелчок — открыть данные или SQL`}
                            onClick={() => onSelect(o)}
                            onDoubleClick={() => onQuery(o)}
                          >
                            <span
                              onClick={(e) => {
                                if (o.kind !== 'table' && o.kind !== 'view') return;
                                e.stopPropagation();
                                onSelect(o);
                                setColumns((prev) => {
                                  const next = new Set(prev);
                                  next.has(o.oid) ? next.delete(o.oid) : next.add(o.oid);
                                  return next;
                                });
                              }}
                            >
                              <DbIcon
                                name={
                                  ['table', 'view'].includes(o.kind)
                                    ? columns.has(o.oid)
                                      ? 'down'
                                      : 'chevron'
                                    : 'column'
                                }
                                size={10}
                              />
                            </span>
                            <DbIcon name={o.kind} size={14} />
                            <span>{o.name}</span>
                          </button>
                          {columns.has(o.oid) &&
                            details?.object.oid === o.oid &&
                            details.columns.map((c) => (
                              <div className="db-tree-column" key={c.name}>
                                <DbIcon name={c.primary ? 'key' : 'column'} size={12} />
                                <span>{c.name}</span>
                                <small>{c.type}</small>
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                );
              })}
          </div>
        ))}
        {!catalog && (
          <p className="db-tree-loading">
            {loading ? 'Читаем системный каталог…' : 'Нет подключения'}
          </p>
        )}
      </div>
      <div className="db-explorer-footer">
        <DbIcon name="database" size={13} />
        {catalog?.objects.filter((o) => o.kind === 'table').length || 0} таблиц · public
      </div>
    </aside>
  );
}
