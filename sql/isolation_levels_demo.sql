-- StudyTrack / isolation_levels_demo.sql
-- Сравнение READ COMMITTED и REPEATABLE READ на повторном чтении одной строки.
-- Второй сеанс эмулируется через dblink (отдельное соединение к той же БД).
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/isolation_levels_demo.sql

\set ON_ERROR_STOP on
\pset pager off

CREATE EXTENSION IF NOT EXISTS dblink;

SELECT dblink_connect('other', 'dbname=studytrack user=studytrack');

\echo '=== Исходное название курса 1 ==='
SELECT id, title FROM courses WHERE id = 1;

\echo ''
\echo '=== 1. READ COMMITTED: каждый оператор видит новый снимок ==='
BEGIN ISOLATION LEVEL READ COMMITTED;

SELECT title AS first_read FROM courses WHERE id = 1;

\echo '--- Другой сеанс меняет и фиксирует название ---'
SELECT dblink_exec('other',
    'UPDATE courses SET title = ''Web Basics (changed)'' WHERE id = 1');

SELECT title AS second_read_read_committed FROM courses WHERE id = 1;

ROLLBACK;

\echo ''
\echo '=== 2. REPEATABLE READ: снимок фиксируется на первом чтении ==='
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT title AS first_read FROM courses WHERE id = 1;

\echo '--- Другой сеанс снова меняет и фиксирует название ---'
SELECT dblink_exec('other',
    'UPDATE courses SET title = ''Web Basics (changed again)'' WHERE id = 1');

SELECT title AS second_read_repeatable_read FROM courses WHERE id = 1;

COMMIT;

\echo '--- После COMMIT новое значение видно ---'
SELECT title AS after_commit FROM courses WHERE id = 1;

\echo ''
\echo '=== 3. Восстанавливаем исходное название ==='
SELECT dblink_exec('other',
    'UPDATE courses SET title = ''Основы веб-разработки'' WHERE id = 1');

SELECT id, title FROM courses WHERE id = 1;

SELECT dblink_disconnect('other');
DROP EXTENSION IF EXISTS dblink;

\echo ''
\echo '=== Почему нужна блокировка ==='
\echo 'Проверка «свободен ли ресурс» без блокировки читает снимок и не мешает'
\echo 'второму сеансу сделать то же самое. Оба могут решить, что ресурс свободен,'
\echo 'и создать конфликтующие записи. submit_version блокирует задание и зачисление'
\echo '(SELECT ... FOR UPDATE) до вычисления следующего номера версии.'
