'use client';
import { useState } from 'react';
import type { ObjectDetails, DbObject } from './types';
import { DbIcon } from './icons';
export function ObjectInspector({
  details,
  loading,
  onQuery,
  onSql,
}: {
  details: ObjectDetails | null;
  loading: boolean;
  onQuery: (o: DbObject) => void;
  onSql: (sql: string, name: string) => void;
}) {
  const [tab, setTab] = useState('columns');
  if (loading) return <div className="db-object-loading">Читаем системный каталог…</div>;
  if (!details)
    return (
      <div className="db-empty-panel">
        <DbIcon name="database" size={40} />
        <h2>Объекты учебной базы</h2>
        <p>Выберите таблицу, представление, функцию или триггер в дереве слева.</p>
      </div>
    );
  const { object, columns, constraints, indexes } = details;
  const relational = ['table', 'view', 'materialized_view'].includes(object.kind);
  return (
    <div className="db-object-inspector">
      <header>
        <div>
          <span className="db-object-kicker">
            {object.schema} / {object.kind}
          </span>
          <h2>
            <DbIcon name={object.kind} size={22} />
            {object.name}
          </h2>
          <p>
            {object.comment || `${object.owner}${object.args != null ? ' · ' + object.args : ''}`}
          </p>
        </div>
        <div>
          {relational && (
            <button className="db-primary" onClick={() => onQuery(object)}>
              <DbIcon name="table" />
              Просмотр данных
            </button>
          )}
          <button onClick={() => onSql(details.definition, object.name + '.sql')}>
            <DbIcon name="code" />
            SQL в редактор
          </button>
        </div>
      </header>
      <div className="db-object-facts">
        <span>
          Схема <b>{object.schema}</b>
        </span>
        <span>
          Владелец <b>{object.owner}</b>
        </span>
        <span>
          Тип <b>{object.kind}</b>
        </span>
        {object.size && (
          <span>
            Размер <b>{object.size}</b>
          </span>
        )}
        <span>
          OID <b>{object.oid}</b>
        </span>
      </div>
      <nav className="db-inner-tabs">
        {(relational
          ? [
              ['columns', 'Столбцы', columns.length],
              ['constraints', 'Ограничения', constraints.length],
              ['indexes', 'Индексы', indexes.length],
              ['sql', 'SQL / DDL', ''],
            ]
          : [['sql', 'SQL / определение', '']]
        ).map(([id, label, count]) => (
          <button
            className={tab === id || (!relational && id === 'sql') ? 'active' : ''}
            key={id}
            onClick={() => setTab(String(id))}
          >
            {label} {count !== '' && <span>{count}</span>}
          </button>
        ))}
      </nav>
      {tab === 'sql' || !relational ? (
        <pre className="db-source">{details.definition}</pre>
      ) : tab === 'columns' ? (
        <div className="db-data-scroll">
          <table className="db-meta-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Имя</th>
                <th>Тип</th>
                <th>NULL</th>
                <th>Ключ</th>
                <th>По умолчанию / выражение</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.name}>
                  <td>{c.position}</td>
                  <td>
                    <DbIcon name={c.primary ? 'key' : 'column'} size={13} />
                    {c.name}
                  </td>
                  <td>
                    <code>{c.type}</code>
                  </td>
                  <td>{c.nullable ? 'Да' : 'Нет'}</td>
                  <td>
                    {c.primary
                      ? 'PRIMARY KEY'
                      : c.identity
                        ? 'IDENTITY'
                        : c.generated
                          ? 'GENERATED'
                          : '—'}
                  </td>
                  <td>
                    <code>{c.default || '—'}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'constraints' ? (
        <div className="db-data-scroll">
          <table className="db-meta-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Тип</th>
                <th>Определение</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>
                    {{
                      n: 'NOT NULL',
                      p: 'PRIMARY KEY',
                      f: 'FOREIGN KEY',
                      c: 'CHECK',
                      u: 'UNIQUE',
                      x: 'EXCLUDE',
                    }[c.type] || c.type}
                  </td>
                  <td>
                    <code>{c.definition}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!constraints.length && <p className="db-grid-empty">Нет ограничений.</p>}
        </div>
      ) : (
        <div className="db-data-scroll">
          <table className="db-meta-table">
            <thead>
              <tr>
                <th>Индекс</th>
                <th>Определение</th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((i) => (
                <tr key={i.name}>
                  <td>{i.name}</td>
                  <td>
                    <code>{i.definition}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!indexes.length && <p className="db-grid-empty">Нет индексов.</p>}
        </div>
      )}
    </div>
  );
}
