-- StudyTrack / restore_verify.sql
-- Проверка новой операции в восстановленной БД.
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack_restored -f /sql/restore_verify.sql

\set ON_ERROR_STOP on
\pset pager off

\echo '=== Новая сдача в восстановленной БД ==='
CALL submit_version(7, 1, 'Проверка восстановленной БД.', NULL) \gset

\echo '=== Оценка новой версии ==='
CALL grade_version(2, :p_version_id, 95, 'Оценка в восстановленной БД');

\echo '=== Результат через VIEW ==='
SELECT assignment_id,
       version_no,
       score,
       percent
FROM v_course_results
WHERE student_id = 7 AND course_id = 1
ORDER BY assignment_id;

\echo '=== История оценок пополнилась ==='
SELECT count(*) AS history_rows FROM grade_history;
