import { PGlite, protocol } from '@electric-sql/pglite';
import type { SqlResponse, SqlResult, SqlError } from '@/features/dbms/types';
import { validateScript } from './sql';
const MAX_ROWS = 2000;
export async function executeSql(
  db: PGlite,
  sql: string,
  mode: SqlResponse['mode'] = 'execute',
): Promise<SqlResponse> {
  const statements = validateScript(sql, mode === 'preview');
  if ((mode === 'explain' || mode === 'analyze') && statements.length !== 1)
    throw new Error('Для EXPLAIN выделите один запрос или оставьте в редакторе только его.');
  const actual =
    mode === 'explain'
      ? `EXPLAIN (FORMAT JSON, VERBOSE, COSTS) ${sql}`
      : mode === 'analyze'
        ? `EXPLAIN (ANALYZE, FORMAT JSON, BUFFERS) ${sql}`
        : sql;
  const started = performance.now();
  const result: SqlResponse = { results: [], messages: [], duration: 0, rolledBack: false, mode };
  return db.runExclusive(async () => {
    const raw = (text: string) =>
      db.execProtocolStream(protocol.serialize.query(text), {
        throwOnError: false,
        syncToFs: true,
      });
    try {
      await raw(
        "RESET SESSION AUTHORIZATION; RESET ROLE; RESET ALL; SET statement_timeout='15s'; SET lock_timeout='3s';",
      );
      if (mode === 'preview') await raw('BEGIN;');
      const messages = await raw(actual);
      let current: SqlResult = { fields: [], rows: [], rowCount: 0, command: '', truncated: false };
      for (const message of messages) {
        if (message.name === 'rowDescription') {
          const m = message as InstanceType<typeof protocol.messages.RowDescriptionMessage>;
          current.fields = m.fields.map((f) => ({
            name: f.name,
            dataTypeID: f.dataTypeID,
            tableID: f.tableID,
            columnID: f.columnID,
          }));
        } else if (message.name === 'dataRow') {
          const m = message as InstanceType<typeof protocol.messages.DataRowMessage>;
          current.rowCount++;
          if (current.rows.length < MAX_ROWS)
            current.rows.push(
              m.fields.map((v) =>
                v == null ? null : typeof v === 'string' ? v : new TextDecoder().decode(v),
              ),
            );
          else current.truncated = true;
        } else if (message.name === 'commandComplete') {
          const m = message as InstanceType<typeof protocol.messages.CommandCompleteMessage>;
          current.command = m.text;
          result.results.push(current);
          result.messages.push(m.text);
          current = { fields: [], rows: [], rowCount: 0, command: '', truncated: false };
        } else if (message.name === 'notice') {
          const m = message as InstanceType<typeof protocol.messages.NoticeMessage>;
          result.messages.push(`${m.severity}: ${m.message}`);
        } else if (message.name === 'error') {
          const m = message as InstanceType<typeof protocol.messages.DatabaseError>;
          const position = m.position ? Number(m.position) : undefined;
          const before = position
            ? Array.from(actual)
                .slice(0, position - 1)
                .join('')
                .split('\n')
            : [];
          result.error = {
            message: m.message,
            code: m.code,
            detail: m.detail,
            hint: m.hint,
            position,
            line: before.length || undefined,
            column: before.length ? Array.from(before.at(-1)!).length + 1 : undefined,
            constraint: m.constraint,
          };
          result.messages.push(`ERROR: ${m.message}${m.code ? ` [${m.code}]` : ''}`);
        }
      }
    } catch (error) {
      const e = error as SqlError;
      result.error = { message: e.message || 'Не удалось выполнить запрос', code: e.code };
    } finally {
      if (db.isInTransaction()) {
        await raw('ROLLBACK;');
        result.rolledBack = true;
        result.messages.push(
          mode === 'preview'
            ? 'ROLLBACK: пробный запуск, изменения не сохранены.'
            : 'ROLLBACK: незавершённая транзакция закрыта. Для сохранения добавьте COMMIT в тот же скрипт.',
        );
      }
      await raw('RESET SESSION AUTHORIZATION; RESET ROLE; RESET ALL;');
      result.duration = Math.round((performance.now() - started) * 100) / 100;
    }
    return result;
  });
}
