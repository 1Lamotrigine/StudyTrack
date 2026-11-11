'use client';
import { useState } from 'react';
import type { SqlResponse } from './types';
import { DbIcon } from './icons';
type PlanNode = Record<string, unknown> & { Plans?: PlanNode[] };
function Node({ node, depth = 0 }: { node: PlanNode; depth?: number }) {
  const [closed, setClosed] = useState(false);
  return (
    <div className="db-plan-node" style={{ marginLeft: depth ? 24 : 0 }}>
      <button onClick={() => setClosed((v) => !v)}>
        <DbIcon name={node.Plans ? (closed ? 'chevron' : 'down') : 'explain'} size={14} />
        <strong>{String(node['Node Type'])}</strong>
        {Boolean(node['Relation Name']) && <code>{String(node['Relation Name'])}</code>}
        <span>
          cost {String(node['Startup Cost'] ?? '—')}..{String(node['Total Cost'] ?? '—')}
        </span>
        <span>rows {String(node['Actual Rows'] ?? node['Plan Rows'] ?? '—')}</span>
      </button>
      {!closed && (
        <>
          <dl>
            {Object.entries(node)
              .filter(
                ([k]) =>
                  ![
                    'Plans',
                    'Node Type',
                    'Relation Name',
                    'Startup Cost',
                    'Total Cost',
                    'Plan Rows',
                    'Actual Rows',
                  ].includes(k),
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
          </dl>
          {node.Plans?.map((child, i) => (
            <Node node={child} key={i} depth={depth + 1} />
          ))}
        </>
      )}
    </div>
  );
}
export function ExplainPlan({ response }: { response: SqlResponse | undefined }) {
  const [json, setJson] = useState(false);
  let data: Record<string, unknown> | undefined;
  try {
    data = JSON.parse(response?.results[0]?.rows[0]?.[0] || '[]')[0];
  } catch {}
  if (!data?.Plan)
    return (
      <div className="db-empty-panel">
        <DbIcon name="explain" size={34} />
        <h3>План выполнения запроса</h3>
        <p>Выделите один SQL-запрос и нажмите EXPLAIN или ANALYZE.</p>
      </div>
    );
  return (
    <div className="db-plan">
      <div className="db-plan-heading">
        <span>
          {response?.mode === 'analyze'
            ? 'EXPLAIN ANALYZE · запрос выполнен'
            : 'EXPLAIN · без выполнения'}
        </span>
        <button onClick={() => setJson((v) => !v)}>
          <DbIcon name="code" size={14} />
          {json ? 'Дерево' : 'JSON'}
        </button>
        {data['Execution Time'] != null && (
          <span>Execution: {String(data['Execution Time'])} ms</span>
        )}
      </div>
      {json ? (
        <pre className="db-source">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <Node node={data.Plan as PlanNode} />
      )}
    </div>
  );
}
