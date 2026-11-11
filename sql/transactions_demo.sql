-- StudyTrack / transactions_demo.sql
-- BEGIN → изменение → ROLLBACK и BEGIN → изменение → COMMIT для ключевой операции.
-- После отката сверяются все связанные таблицы.
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/transactions_demo.sql

\set ON_ERROR_STOP on
\pset pager off

\echo '=== Исходные счётчики ==='
SELECT (SELECT count(*) FROM submission_versions WHERE student_id = 7 AND assignment_id = 1) AS versions_s7_a1,
       (SELECT count(*) FROM grades)    AS grades_total,
       (SELECT count(*) FROM grade_history) AS history_total;

\echo ''
\echo '=== 1. ROLLBACK: сдача и оценка откатываются вместе ==='
BEGIN;

CALL submit_version(7, 1, 'Версия для проверки ROLLBACK.', NULL) \gset

SELECT count(*) AS versions_inside_tx
FROM submission_versions
WHERE student_id = 7 AND assignment_id = 1;

CALL grade_version(2, :p_version_id, 91, 'Оценка внутри откатываемой транзакции.');

SELECT (SELECT count(*) FROM grades)        AS grades_inside_tx,
       (SELECT count(*) FROM grade_history) AS history_inside_tx;

ROLLBACK;

\echo '--- После ROLLBACK: связанные таблицы вернулись к исходному состоянию ---'
SELECT (SELECT count(*) FROM submission_versions WHERE student_id = 7 AND assignment_id = 1) AS versions_s7_a1,
       (SELECT count(*) FROM grades)    AS grades_total,
       (SELECT count(*) FROM grade_history) AS history_total;

\echo ''
\echo '=== 2. COMMIT: успешная сдача и оценка сохраняются ==='
BEGIN;

CALL submit_version(7, 1, 'Версия, зафиксированная через COMMIT.', NULL) \gset

CALL grade_version(2, :p_version_id, 91, 'Оценка зафиксирована вместе со сдачей.');

COMMIT;

\echo '--- После COMMIT: результат виден в представлении ---'
SELECT assignment_id,
       assignment_title,
       version_no,
       score,
       max_score,
       is_late
FROM fn_student_course_result(7, 1);

SELECT (SELECT count(*) FROM submission_versions WHERE student_id = 7 AND assignment_id = 1) AS versions_s7_a1,
       (SELECT count(*) FROM grades)    AS grades_total,
       (SELECT count(*) FROM grade_history) AS history_total;

\echo ''
\echo '=== Примечание ==='
\echo 'Повторный запуск скрипта добавит ещё одну версию (allow_revision=true).'
\echo 'Для чистой демонстрации: docker compose down -v && docker compose up -d'
