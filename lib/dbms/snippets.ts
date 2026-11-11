import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Snippet } from '@/features/dbms/types';
export async function loadSnippets(): Promise<Snippet[]> {
  const file = await readFile(path.join(process.cwd(), 'sql', 'queries_Q01_Q16.sql'), 'utf8');
  const blocks = file.split(/^\\echo '=+ (Q\d{2})\. (.+?) =+'\s*$/m);
  const snippets: Snippet[] = [];
  for (let i = 1; i < blocks.length; i += 3) {
    const [id, title, body] = blocks.slice(i, i + 3);
    if (!body) continue;
    const variables: Record<string, string> = {};
    const sql = body
      .split('\n')
      .map((line) => {
        const assignment = line.match(/^\\set\s+(\w+)\s+(\d+)\s*$/);
        if (assignment) {
          variables[assignment[1]] = assignment[2];
          return `-- Параметр ${assignment[1]} = ${assignment[2]}`;
        }
        if (/^\\/.test(line)) return '';
        return line.replace(/(?<!:):(\w+)\b/g, (match, name) => variables[name] ?? match);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    snippets.push({
      id,
      title: `${id} · ${title.trim()}`,
      category: 'Курсовые запросы',
      description: 'Исходный SQL проекта StudyTrack, без команд psql.',
      sql,
    });
  }
  return [
    ...snippets,
    {
      id: 'starter',
      category: 'Основы',
      title: 'Обзор учебной базы',
      description: 'Курсы, преподаватели и количество заданий.',
      sql: `SELECT c.code, c.title, u.full_name AS teacher,\n       count(a.id) AS assignments\nFROM courses c\nJOIN users u ON u.id = c.teacher_id\nLEFT JOIN assignments a ON a.course_id = c.id\nGROUP BY c.id, u.full_name\nORDER BY c.code;`,
    },
    {
      id: 'transaction',
      category: 'Транзакции',
      title: 'BEGIN → изменение → ROLLBACK',
      description: 'Настоящая транзакция без сохранения изменений.',
      sql: `BEGIN;\n\nUPDATE courses\nSET description = 'Проверка транзакции'\nWHERE id = 1\nRETURNING id, title, description;\n\nROLLBACK;\n\nSELECT id, title, description FROM courses WHERE id = 1;`,
    },
    {
      id: 'function',
      category: 'PL/pgSQL',
      title: 'Функция и её вызов',
      description: 'Создание функции в транзакции с откатом.',
      sql: `BEGIN;\n\nCREATE OR REPLACE FUNCTION public.demo_course_count()\nRETURNS integer LANGUAGE plpgsql AS $$\nBEGIN\n    RETURN (SELECT count(*)::integer FROM public.courses);\nEND;\n$$;\n\nSELECT public.demo_course_count() AS course_count;\n\nROLLBACK;`,
    },
    {
      id: 'schema',
      category: 'Каталог',
      title: 'Связи внешних ключей',
      description: 'Системный каталог PostgreSQL.',
      sql: `SELECT conname AS constraint_name,\n       conrelid::regclass AS source_table,\n       confrelid::regclass AS target_table,\n       pg_get_constraintdef(oid) AS definition\nFROM pg_constraint\nWHERE contype = 'f'\nORDER BY source_table::text, constraint_name;`,
    },
    {
      id: 'json',
      category: 'JSONB',
      title: 'Параметры заданий в JSONB',
      description: 'Извлечение атрибутов JSON и фильтрация.',
      sql: `SELECT title,\n       extra ->> 'submission_format' AS format,\n       (extra ->> 'allow_revision')::boolean AS revisions,\n       expected_minutes\nFROM assignments\nWHERE extra @> '{"allow_revision": true}'::jsonb\nORDER BY expected_minutes DESC;`,
    },
    {
      id: 'constraints',
      category: 'Целостность',
      title: 'Проверка ограничения CHECK',
      description: 'Ожидаемая ошибка: отрицательная оценка.',
      sql: `-- Ожидается ошибка ограничения. Изменения не сохранятся.\nBEGIN;\nUPDATE grades SET score = -1 WHERE id = 1;\nROLLBACK;`,
    },
  ];
}
