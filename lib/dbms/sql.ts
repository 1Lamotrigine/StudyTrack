/** Split at top-level semicolons, preserving PL/pgSQL bodies and comments. */
export function splitStatements(sql: string): { sql: string; head: string; offset: number }[] {
  const statements: { sql: string; head: string; offset: number }[] = [];
  let start = 0,
    plain = '',
    quote = '',
    dollar = '',
    block = 0,
    line = false,
    escapeString = false;
  function push(end: number) {
    if (plain.trim())
      statements.push({
        sql: sql.slice(start, end).trim(),
        head: plain.trim().replace(/\s+/g, ' ').toUpperCase(),
        offset: start,
      });
    start = end + 1;
    plain = '';
  }
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i],
      next = sql[i + 1];
    if (line) {
      if (c === '\n') {
        line = false;
        plain += ' ';
      }
      continue;
    }
    if (block) {
      if (c === '/' && next === '*') {
        block++;
        i++;
      } else if (c === '*' && next === '/') {
        block--;
        i++;
      }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        i += dollar.length - 1;
        dollar = '';
      }
      continue;
    }
    if (quote) {
      if (c === quote) {
        if (next === quote) i++;
        else quote = '';
      } else if (c === '\\' && quote === "'" && escapeString) i++;
      continue;
    }
    if (c === '-' && next === '-') {
      line = true;
      i++;
      plain += ' ';
      continue;
    }
    if (c === '/' && next === '*') {
      block = 1;
      i++;
      plain += ' ';
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      escapeString =
        c === "'" && /[eE]/.test(sql[i - 1] || '') && !/[a-zA-Z0-9_$]/.test(sql[i - 2] || '');
      plain += ' ';
      continue;
    }
    if (c === '$') {
      const match = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z_0-9]*)?\$/);
      if (match) {
        dollar = match[0];
        i += dollar.length - 1;
        plain += ' ';
        continue;
      }
    }
    if (c === ';') {
      push(i);
      continue;
    }
    plain += c;
  }
  push(sql.length);
  return statements;
}
export function quoteIdentifier(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}
export function qualified(schema: string, name: string) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
}
export function validateScript(sql: string, preview = false) {
  if (!sql.trim()) throw new Error('Введите SQL-запрос.');
  if (sql.length > 300000) throw new Error('Максимальный размер SQL-скрипта — 300 000 символов.');
  if (/^\s*\\/m.test(sql))
    throw new Error(
      'Команды psql (\\set, \\echo, \\gset) не являются SQL. Используйте SQL без этих команд. Примеры в библиотеке уже подготовлены.',
    );
  const statements = splitStatements(sql);
  if (!statements.length) throw new Error('В редакторе только комментарии. Добавьте SQL-запрос.');
  if (statements.some((s) => /^COPY\b/.test(s.head) && /\b(STDIN|STDOUT)\b/.test(s.head)))
    throw new Error(
      'Интерактивный COPY STDIN/STDOUT недоступен. Для выгрузки выполните SELECT и нажмите «CSV».',
    );
  if (
    preview &&
    statements.some((s) =>
      /^(BEGIN|START TRANSACTION|COMMIT|END\b|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE TRANSACTION)\b/.test(
        s.head,
      ),
    )
  )
    throw new Error(
      'В режиме отката транзакцией управляет консоль. Уберите BEGIN/COMMIT/ROLLBACK или выполните скрипт обычной кнопкой.',
    );
  return statements;
}
