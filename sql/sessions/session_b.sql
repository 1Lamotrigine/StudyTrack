-- StudyTrack / sessions/session_b.sql
-- Сеанс B: запускать во время паузы session_a.sql.
-- Вызов submit_version пытается заблокировать то же задание 5 и ждёт.
--
-- Ожидаемое поведение:
--   запрос ждёт ~12 секунд (пока A не выполнит COMMIT);
--   затем создаётся версия с корректным следующим номером;
--   итог согласован: обе транзакции не создали одинаковый version_no.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

\echo '=== B: пытаемся сдать версию задания 5 (ожидаем блокировку) ==='
CALL submit_version(6, 5, 'Версия, сданная во время ожидания блокировки.', NULL);

\echo '=== B: блокировка снята, версия создана ==='
SELECT student_id,
       assignment_id,
       version_no,
       is_late,
       submitted_at
FROM submission_versions
WHERE student_id = 6 AND assignment_id = 5
ORDER BY version_no;

COMMIT;
