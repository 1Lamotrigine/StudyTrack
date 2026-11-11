-- StudyTrack / scenario_main.sql
-- Основной предметный сценарий:
--   курс → зачисление → задание → новая версия работы → оценка → текущий результат.
-- Плюс два ожидаемых отказа: запрет повторной сдачи и оценка выше max_score.
-- Всё выполняется в одной транзакции и завершается ROLLBACK, чтобы демонстрационный
-- набор можно было прогонять повторно без накопления мусорных версий.
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/scenario_main.sql

\set ON_ERROR_STOP 0
\echo '=== 0. Исходное состояние: студент 7, курс 1 ==='
SELECT * FROM fn_student_course_result(7, 1);

BEGIN;

\echo '=== 1. Успешная сдача новой версии (срок уже прошёл → is_late = true) ==='
CALL submit_version(7, 1, 'Лендинг: итоговая версия с формой и валидацией.', NULL);

SELECT id, assignment_id, student_id, version_no, is_late, submitted_at
FROM submission_versions
WHERE student_id = 7 AND assignment_id = 1
ORDER BY version_no;

\echo '=== 2. Оценка новой версии преподавателем курса ==='
SELECT max(id) AS new_version_id
FROM submission_versions
WHERE student_id = 7 AND assignment_id = 1
\gset

CALL grade_version(2, :new_version_id, 91, 'Учтены замечания, работа принята.');

\echo '=== 3. Текущий результат после оценки ==='
SELECT * FROM fn_student_course_result(7, 1);

SAVEPOINT before_forbidden_submit;

\echo '=== 4. ОЖИДАЕМЫЙ ОТКАЗ: повторная сдача задания 3 запрещена (allow_revision=false) ==='
CALL submit_version(3, 3, 'Попытка второй версии.', NULL);

ROLLBACK TO SAVEPOINT before_forbidden_submit;

SAVEPOINT before_forbidden_grade;

\echo '=== 5. ОЖИДАЕМЫЙ ОТКАЗ: оценка 101 при max_score = 100 ==='
CALL grade_version(2, 1, 101, 'Недопустимая оценка');

ROLLBACK TO SAVEPOINT before_forbidden_grade;

\echo '=== 6. Данные после отказов не изменились ==='
SELECT * FROM fn_student_course_result(7, 1);
SELECT count(*) AS versions_after_failures
FROM submission_versions
WHERE student_id = 7 AND assignment_id = 1;

ROLLBACK;

\echo '=== 7. После ROLLBACK демонстрационные данные восстановлены ==='
SELECT * FROM fn_student_course_result(7, 1);
