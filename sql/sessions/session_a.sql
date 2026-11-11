-- StudyTrack / sessions/session_a.sql
-- Сеанс A: блокирует строку задания 5 на 12 секунд.
-- В это время запустите в другом терминале session_b.sql:
--   docker compose exec db psql -U studytrack -d studytrack -f /sql/sessions/session_b.sql
--
-- Ожидаемое поведение:
--   A удерживает блокировку assignments.id=5;
--   B (submit_version) ждёт освобождения;
--   после COMMIT сеанса A сеанс B продолжает работу и создаёт следующую версию
--   без дублирования version_no.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

\echo '=== A: блокируем задание 5 ==='
SELECT id, title
FROM assignments
WHERE id = 5
FOR UPDATE;

\echo '=== A: блокировка удерживается 12 секунд. Запустите session_b.sql ==='
SELECT pg_sleep(12);

\echo '=== A: завершаем транзакцию и освобождаем строку ==='
UPDATE assignments SET title = title WHERE id = 5;

COMMIT;

\echo '=== A: готово ==='
