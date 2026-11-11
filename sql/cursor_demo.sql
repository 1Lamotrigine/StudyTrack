-- StudyTrack / cursor_demo.sql
-- Курсор: отчёт «студенты и их средний процент по курсу 2».
-- Строки читаются частями (FETCH 3), затем курсор закрывается.
-- Ниже приведён эквивалентный обычный SELECT.
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/cursor_demo.sql

\set ON_ERROR_STOP on

BEGIN;

DECLARE cur_course_report CURSOR FOR
    SELECT u.full_name AS student_name,
           count(*)    AS graded_assignments,
           round(avg(r.percent), 2) AS avg_percent
    FROM v_course_results AS r
    JOIN users AS u ON u.id = r.student_id
    WHERE r.course_id = 2
    GROUP BY u.id, u.full_name
    ORDER BY avg(r.percent) DESC, u.full_name;

\echo '=== Курсор: первые 3 строки ==='
FETCH 3 FROM cur_course_report;

\echo '=== Курсор: следующие строки ==='
FETCH ALL FROM cur_course_report;

CLOSE cur_course_report;

\echo '=== Тот же результат обычным SELECT ==='
SELECT u.full_name AS student_name,
       count(*)    AS graded_assignments,
       round(avg(r.percent), 2) AS avg_percent
FROM v_course_results AS r
JOIN users AS u ON u.id = r.student_id
WHERE r.course_id = 2
GROUP BY u.id, u.full_name
ORDER BY avg(r.percent) DESC, u.full_name;

COMMIT;
