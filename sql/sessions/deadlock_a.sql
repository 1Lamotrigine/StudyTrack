-- StudyTrack / sessions/deadlock_a.sql
-- Учебный пример взаимной блокировки, сеанс A.
-- Запускать почти одновременно с deadlock_b.sql в двух терминалах:
--   docker compose exec db psql -U studytrack -d studytrack -f /sql/sessions/deadlock_a.sql
--   docker compose exec db psql -U studytrack -d studytrack -f /sql/sessions/deadlock_b.sql
--
-- A блокирует задание 1, B — задание 2, затем каждый пытается взять строку другого.
-- PostgreSQL обнаружит deadlock и откатит одну транзакцию с ошибкой.
-- Одинаковый порядок захвата (например, всегда 1 → 2) предотвращает deadlock.

\set ON_ERROR_STOP 0
\pset pager off

BEGIN;

UPDATE assignments SET title = title WHERE id = 1;
\echo '=== A: строка 1 заблокирована, ждём 5 секунд ==='
SELECT pg_sleep(5);

UPDATE assignments SET title = title WHERE id = 2;
\echo '=== A: если эта строка выполнилась, deadlock не возник ==='

COMMIT;
