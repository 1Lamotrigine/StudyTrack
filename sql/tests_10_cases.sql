-- StudyTrack / tests_10_cases.sql
-- 10 проверочных случаев по ТЗ, раздел 11.
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/tests_10_cases.sql
--
-- Ожидаемые ошибки выводятся намеренно (ON_ERROR_STOP=0). Каждый успешный
-- сценарий откатывается, чтобы не менять демонстрационный набор.

\set ON_ERROR_STOP 0
\pset pager off

\echo ''
\echo '=== ТЕСТ 1. Успешная основная операция: сдача + оценка ==='
BEGIN;
CALL submit_version(7, 1, 'Тест 1: успешная сдача.', NULL) \gset
CALL grade_version(2, :p_version_id, 90, 'Тест 1: оценка.');
SELECT version_no, score, percent
FROM v_course_results
WHERE student_id = 7 AND assignment_id = 1;
ROLLBACK;

\echo ''
\echo '=== ТЕСТ 2. Допустимое исправление оценки и история ==='
BEGIN;
SELECT score AS before_score FROM grades WHERE id = 1;
UPDATE grades SET score = 90, comment = 'Тест 2: исправление' WHERE id = 1;
SELECT old_score, new_score, action FROM grade_history
WHERE grade_id = 1 ORDER BY id DESC LIMIT 1;
SELECT score AS after_score FROM v_course_results
WHERE student_id = 3 AND assignment_id = 1;
ROLLBACK;

\echo ''
\echo '=== ТЕСТ 3. Отказ FK ==='
INSERT INTO enrollments (course_id, student_id) VALUES (9999, 3);

\echo ''
\echo '=== ТЕСТ 4. Отказ UNIQUE и CHECK ==='
INSERT INTO submission_versions (assignment_id, student_id, version_no, body)
VALUES (1, 3, 1, 'Дубликат версии');
UPDATE course_categories SET parent_id = id WHERE id = 1;

\echo ''
\echo '=== ТЕСТ 5. Отказ ключевого предметного правила ==='
-- 5a. Повторная сдача запрещена (allow_revision=false).
CALL submit_version(3, 3, 'Повторная версия', NULL);
-- 5b. Оценку выставляет не преподаватель курса.
CALL grade_version(2, 10, 19, 'Чужой преподаватель');

\echo ''
\echo '=== ТЕСТ 6. Два сеанса: ожидание блокировки и согласованный итог ==='
CREATE EXTENSION IF NOT EXISTS dblink;
SELECT dblink_connect('sess6', 'dbname=studytrack user=studytrack');

BEGIN;
SAVEPOINT before_lock;

-- Второй сеанс удерживает строку задания 5.
SELECT dblink_exec('sess6', 'BEGIN');
SELECT * FROM dblink('sess6',
    'SELECT id FROM assignments WHERE id = 5 FOR UPDATE') AS locked(id integer);

-- Наш сеанс не должен ждать бесконечно.
SET LOCAL lock_timeout = '2s';
CALL submit_version(6, 5, 'Тест 6: ожидание блокировки', NULL);

ROLLBACK TO SAVEPOINT before_lock;

-- Освобождаем ресурс во втором сеансе и повторяем операцию.
SELECT dblink_exec('sess6', 'ROLLBACK');
CALL submit_version(6, 5, 'Тест 6: после освобождения блокировки', NULL);

SELECT student_id, assignment_id, version_no
FROM submission_versions
WHERE student_id = 6 AND assignment_id = 5
ORDER BY version_no DESC
LIMIT 1;

ROLLBACK;

SELECT dblink_disconnect('sess6');
DROP EXTENSION IF EXISTS dblink;  -- чтобы не засорять схему public

\echo ''
\echo '=== ТЕСТ 7. Откат связанного изменения без частичного результата ==='
SELECT count(*) AS versions_before FROM submission_versions WHERE student_id = 7 AND assignment_id = 1;
BEGIN;
CALL submit_version(7, 1, 'Тест 7: откат', NULL) \gset
CALL grade_version(2, :p_version_id, 88, 'Тест 7: откат');
SELECT count(*) AS versions_inside
FROM submission_versions WHERE student_id = 7 AND assignment_id = 1;
ROLLBACK;
SELECT count(*) AS versions_after FROM submission_versions WHERE student_id = 7 AND assignment_id = 1;

\echo ''
\echo '=== ТЕСТ 8. Отчёт совпадает с ручным расчётом ==='
-- Ручной расчёт по assignment 3: (19 + 18 + 15 + 18 + 17 + 16) / 6 = 17.166... => 17.17
SELECT assignment_id,
       graded_versions,
       avg_score
FROM v_assignment_status
WHERE assignment_id = 3;

-- Курс 2: средний процент студента, затем средний по курсу (Q07).
WITH per_student AS (
    SELECT student_id, avg(percent) AS p
    FROM v_course_results WHERE course_id = 2
    GROUP BY student_id
)
SELECT round(avg(p), 2) AS course_avg_percent
FROM per_student;

\echo ''
\echo '=== ТЕСТ 9. Поиск и JSONB; неверный тип атрибута обработан ==='
SELECT count(*) AS fts_found
FROM assignments
WHERE search_vector @@ websearch_to_tsquery('russian', 'эссе');

SELECT id, extra ->> 'submission_format' AS format,
       (extra ->> 'expected_minutes')::int AS minutes
FROM assignments
WHERE extra ->> 'submission_format' = 'zip'
ORDER BY id
LIMIT 3;

DO $$
BEGIN
    BEGIN
        INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
        VALUES (3, 'Тест 9: неверный тип', 'Тест', now() + interval '1 day', 10,
                '{"expected_minutes": "abc"}');
        RAISE NOTICE 'ОШИБКА: неверный тип принят';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Ожидаемый отказ неверного типа: %', SQLERRM;
    END;
END;
$$;

\echo ''
\echo '=== ТЕСТ 10. Роль чтения: SELECT разрешён, изменение запрещено ==='
SET ROLE report_reader;
SELECT count(*) AS view_rows FROM v_course_results;
UPDATE courses SET title = 'Запрещено' WHERE id = 1;
RESET ROLE;

\echo ''
\echo '=== ТЕСТ 11 (дополнительно). Объекты БД для восстановления ==='
SELECT (SELECT count(*) FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'v_%') AS views,
       (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace) AS routines,
       (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers,
       (SELECT count(*) FROM assignments) AS assignments,
       (SELECT count(*) FROM submission_versions) AS versions;
-- Восстановление отдельной БД проверяется скриптом sql/restore_verify.sql
-- и описано в backup/restore_commands.md (тест 10 из чек-листа ТЗ).
