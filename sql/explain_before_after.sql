-- StudyTrack / explain_before_after.sql
-- Сравнение планов до и после индексов (ТЗ, раздел 9).
-- Предварительно загрузите большую выборку:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/bulk_seed_1000.sql
-- Затем:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/explain_before_after.sql
--
-- ВАЖНО: для наглядности скрипт удаляет индексы, показывает план и создаёт их заново.

\set ON_ERROR_STOP on
\pset pager off

ANALYZE assignments;
ANALYZE submission_versions;
ANALYZE grades;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Основной список: задания курса с фильтром по сроку.
-- Индекс (course_id, due_at): сначала равенство по course_id, затем диапазон
-- и сортировка по due_at — порядок столбцов соответствует условиям запроса.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_assignments_course_due;
DROP INDEX IF EXISTS idx_assignments_course;

\echo '================ 1a. ДО составного индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, due_at
FROM assignments
WHERE course_id = 2
  AND due_at >= timestamptz '2026-01-01 00:00+03'
  AND due_at <  timestamptz '2026-02-01 00:00+03'
ORDER BY due_at
LIMIT 20;

-- ---------------------------------------------------------------------------
-- 2. Аналитический отчёт: агрегаты по заданиям курса за квартал.
-- До индекса — последовательное чтение; после — выборка по (course_id, due_at).
-- ---------------------------------------------------------------------------
\echo '================ 2a. Аналитический отчёт ДО индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.title,
       count(DISTINCT a.id)        AS assignments_count,
       count(sv.id)                AS versions_count,
       count(*) FILTER (WHERE sv.is_late) AS late_versions,
       round(avg(g.score), 2)      AS avg_score
FROM assignments AS a
JOIN courses AS c ON c.id = a.course_id
LEFT JOIN submission_versions AS sv ON sv.assignment_id = a.id
LEFT JOIN grades AS g ON g.version_id = sv.id
WHERE a.course_id = 2
  AND a.due_at >= timestamptz '2026-01-01 00:00+03'
  AND a.due_at <  timestamptz '2026-04-01 00:00+03'
GROUP BY c.title;

CREATE INDEX idx_assignments_course_due ON assignments (course_id, due_at);

\echo '================ 1b. ПОСЛЕ составного индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, due_at
FROM assignments
WHERE course_id = 2
  AND due_at >= timestamptz '2026-01-01 00:00+03'
  AND due_at <  timestamptz '2026-02-01 00:00+03'
ORDER BY due_at
LIMIT 20;

\echo '================ 2b. Аналитический отчёт ПОСЛЕ индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.title,
       count(DISTINCT a.id)        AS assignments_count,
       count(sv.id)                AS versions_count,
       count(*) FILTER (WHERE sv.is_late) AS late_versions,
       round(avg(g.score), 2)      AS avg_score
FROM assignments AS a
JOIN courses AS c ON c.id = a.course_id
LEFT JOIN submission_versions AS sv ON sv.assignment_id = a.id
LEFT JOIN grades AS g ON g.version_id = sv.id
WHERE a.course_id = 2
  AND a.due_at >= timestamptz '2026-01-01 00:00+03'
  AND a.due_at <  timestamptz '2026-04-01 00:00+03'
GROUP BY c.title;

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Полнотекстовый поиск: GIN по tsvector.
-- ---------------------------------------------------------------------------
BEGIN;
DROP INDEX IF EXISTS idx_assignments_search_gin;

\echo '================ 3a. FTS ДО GIN-индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title
FROM assignments
WHERE search_vector @@ plainto_tsquery('russian', 'эссе');

CREATE INDEX idx_assignments_search_gin ON assignments USING gin (search_vector);

\echo '================ 3b. FTS ПОСЛЕ GIN-индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title
FROM assignments
WHERE search_vector @@ plainto_tsquery('russian', 'эссе');
COMMIT;

-- ---------------------------------------------------------------------------
-- 4. Индекс по вычисляемому столбцу expected_minutes.
-- ---------------------------------------------------------------------------
BEGIN;
DROP INDEX IF EXISTS idx_assignments_expected_minutes;

\echo '================ 4a. Фильтр по GENERATED-столбцу ДО индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, expected_minutes
FROM assignments
WHERE expected_minutes BETWEEN 60 AND 90;

CREATE INDEX idx_assignments_expected_minutes ON assignments (expected_minutes);

\echo '================ 4b. Фильтр по GENERATED-столбцу ПОСЛЕ индекса ================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, expected_minutes
FROM assignments
WHERE expected_minutes BETWEEN 60 AND 90;
COMMIT;

-- ---------------------------------------------------------------------------
-- Вывод: на 1000+ строк PostgreSQL выбирает Bitmap Index Scan для фильтра
-- по (course_id, due_at) и GIN для полнотекстового поиска. Если для
-- аналитического отчёта остаётся Seq Scan, это объясняется тем, что запрос
-- читает большую долю таблицы — принудительно отключать Seq Scan не нужно.
-- ---------------------------------------------------------------------------
