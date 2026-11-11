-- StudyTrack / sessions/deadlock_b.sql
-- Учебный пример взаимной блокировки, сеанс B.
-- Запускать почти одновременно с deadlock_a.sql (в пределах 5 секунд).
-- B блокирует задание 2, затем пытается взять задание 1, удерживаемое A.
-- Одна из транзакций будет откачена PostgreSQL с ошибкой deadlock detected.

\set ON_ERROR_STOP 0
\pset pager off

BEGIN;

UPDATE assignments SET title = title WHERE id = 2;
\echo '=== B: строка 2 заблокирована, ждём 5 секунд ==='
SELECT pg_sleep(5);

UPDATE assignments SET title = title WHERE id = 1;
\echo '=== B: если эта строка выполнилась, deadlock не возник ==='

COMMIT;
