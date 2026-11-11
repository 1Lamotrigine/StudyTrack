'use client';
import type { Catalog, DbObject } from './types';
export function SchemaDiagram({
  catalog,
  onSelect,
}: {
  catalog: Catalog | null;
  onSelect: (o: DbObject) => void;
}) {
  if (!catalog) return <div className="db-object-loading">Загружаем схему…</div>;
  const tables = catalog.objects.filter((o) => o.kind === 'table');
  const columnCounts = tables.map((t) =>
    Math.min(catalog.columns.filter((c) => c.oid === t.oid).length, 13),
  );
  const rowHeights = Array.from(
    { length: Math.ceil(tables.length / 3) },
    (_, r) => Math.max(...columnCounts.slice(r * 3, r * 3 + 3)) * 22 + 115,
  );
  const positions = new Map(
    tables.map((t, i) => [
      t.oid,
      {
        x: 30 + (i % 3) * 350,
        y: 30 + rowHeights.slice(0, Math.floor(i / 3)).reduce((s, n) => s + n, 0),
        height: columnCounts[i] * 22 + 58,
      },
    ]),
  );
  const height = rowHeights.reduce((s, n) => s + n, 60);
  return (
    <div className="db-diagram">
      <div className="db-diagram-note">
        <span>ER-диаграмма</span>Связи построены по настоящим FOREIGN KEY. Нажмите на таблицу для
        просмотра структуры.
      </div>
      <div className="db-diagram-scroll">
        <svg
          width="1060"
          height={height}
          viewBox={`0 0 1060 ${height}`}
          role="img"
          aria-label="Диаграмма таблиц и внешних ключей"
        >
          <defs>
            <marker
              id="db-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0 0 L7 3.5 L0 7" fill="var(--db-link)" />
            </marker>
          </defs>
          {catalog.relations.map((r, i) => {
            const from = positions.get(r.from),
              to = positions.get(r.to);
            if (!from || !to) return null;
            const sx = from.x + 290,
              sy = from.y + 24,
              tx = to.x,
              ty = to.y + 24;
            const delta = Math.max(45, Math.abs(tx - sx) * 0.45);
            return (
              <path
                key={i}
                d={
                  r.from === r.to
                    ? `M${sx} ${sy} C${sx + 55} ${sy - 60},${sx + 55} ${sy + 70},${sx} ${sy + 55}`
                    : `M${sx} ${sy} C${sx + delta} ${sy},${tx - delta} ${ty},${tx} ${ty}`
                }
                fill="none"
                stroke="var(--db-link)"
                strokeWidth="1.3"
                opacity=".65"
                markerEnd="url(#db-arrow)"
              >
                <title>
                  {r.name}: {r.definition}
                </title>
              </path>
            );
          })}
          {tables.map((t) => {
            const p = positions.get(t.oid)!;
            const columns = catalog.columns.filter((c) => c.oid === t.oid);
            return (
              <g
                key={t.oid}
                className="db-diagram-table"
                tabIndex={0}
                role="button"
                aria-label={`Структура таблицы ${t.name}`}
                onClick={() => onSelect(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(t);
                }}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width="290"
                  height={p.height}
                  rx="7"
                  fill="var(--db-panel)"
                  stroke="var(--db-border)"
                />
                <rect x={p.x} y={p.y} width="290" height="34" rx="7" fill="var(--db-selected)" />
                <text x={p.x + 13} y={p.y + 22} className="db-svg-title">
                  {t.schema}.{t.name}
                </text>
                {columns.slice(0, 13).map((c, i) => (
                  <g key={c.name}>
                    <text
                      x={p.x + 13}
                      y={p.y + 53 + i * 22}
                      className={c.primary ? 'db-svg-key' : 'db-svg-text'}
                    >
                      {c.primary ? '◆ ' : ''}
                      {c.name.length > 24 ? c.name.slice(0, 23) + '…' : c.name}
                    </text>
                    <text
                      x={p.x + 278}
                      y={p.y + 53 + i * 22}
                      textAnchor="end"
                      className="db-svg-type"
                    >
                      {c.type.length > 17 ? c.type.slice(0, 16) + '…' : c.type}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
