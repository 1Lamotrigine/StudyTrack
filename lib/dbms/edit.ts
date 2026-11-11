import type { PGlite } from '@electric-sql/pglite';
import { readObject } from './catalog';
import { qualified, quoteIdentifier } from './sql';
export type EditRequest = {
  operation: 'insert' | 'update' | 'delete';
  oid: number;
  keys?: Record<string, string | null>;
  values?: Record<string, string | null>;
  original?: Record<string, string | null>;
};
export async function editData(db: PGlite, request: EditRequest) {
  const details = await readObject(db, request.oid, 'table');
  const table = qualified(details.object.schema, details.object.name);
  const pk = details.columns.filter((c) => c.primary).map((c) => c.name);
  const values = Object.entries(request.values || {});
  if (
    values.some(
      ([name, v]) =>
        !details.columns.some(
          (c) => c.name === name && !c.generated && !c.identity && !c.primary,
        ) || !(v === null || typeof v === 'string'),
    )
  )
    throw new Error('Поле недоступно для изменения. Для ключей используйте SQL-редактор.');
  if (request.operation === 'insert') {
    const insertValues = Object.entries(request.values || {}); // Explicit PKs/identities are deliberately handled through SQL.
    const sql = insertValues.length
      ? `INSERT INTO ${table} (${insertValues.map(([n]) => quoteIdentifier(n)).join(',')}) VALUES (${insertValues.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`
      : `INSERT INTO ${table} DEFAULT VALUES RETURNING *`;
    return db.query(
      sql,
      insertValues.map(([, v]) => v),
    );
  }
  if (!pk.length || pk.some((k) => !(k in (request.keys || {}))))
    throw new Error('Для редактирования строки необходим полный первичный ключ.');
  const params: unknown[] = [];
  const where = pk.map((k) => {
    params.push(request.keys![k]);
    return `${quoteIdentifier(k)} IS NOT DISTINCT FROM $${params.length}`;
  });
  if (request.operation === 'delete')
    return db.query(`DELETE FROM ${table} WHERE ${where.join(' AND ')} RETURNING *`, params);
  if (request.operation !== 'update' || !values.length)
    throw new Error('Нет изменений для сохранения.');
  for (const [name, v] of Object.entries(request.original || {})) {
    if (!details.columns.some((c) => c.name === name)) throw new Error('Неизвестный столбец.');
    params.push(v);
    where.push(`${quoteIdentifier(name)} IS NOT DISTINCT FROM $${params.length}`);
  }
  const set = values.map(([k, v]) => {
    params.push(v);
    return `${quoteIdentifier(k)}=$${params.length}`;
  });
  const result = await db.query(
    `UPDATE ${table} SET ${set.join(',')} WHERE ${where.join(' AND ')} RETURNING *`,
    params,
  );
  if (!result.rows.length)
    throw new Error('Строка была изменена или удалена. Обновите данные и повторите действие.');
  return result;
}
