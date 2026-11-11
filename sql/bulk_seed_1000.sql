-- StudyTrack / bulk_seed_1000.sql
-- Большая выборка для сравнения планов EXPLAIN (ТЗ, раздел 9.2).
-- Добавляет 1000 заданий, 1000 версий и 1000 оценок в той же схеме.
-- Скрипт идемпотентен (ON CONFLICT DO NOTHING) и НЕ входит в автоинициализацию.
-- После эксперимента демонстрационную БД лучше пересоздать:
--   docker compose down -v && docker compose up -d
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/bulk_seed_1000.sql

\set ON_ERROR_STOP on

BEGIN;

-- 1000 заданий с явными id 10001..11000.
INSERT INTO assignments (id, course_id, title, description, due_at, max_score, extra)
SELECT 10000 + g AS id,
       (CASE g % 4 WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 ELSE 4 END) AS course_id,
       'Массовое задание ' || g AS title,
       'Учебное описание массового задания ' || g ||
       ': адаптивная вёрстка, SQL-отчёт и обработка данных.' AS description,
       timestamptz '2026-01-01 00:00+03' + make_interval(days => g % 300) AS due_at,
       100 AS max_score,
       jsonb_build_object(
           'submission_format', 'zip',
           'expected_minutes', 30 + (g % 180),
           'allow_revision', true
       ) AS extra
FROM generate_series(1, 1000) AS g
ON CONFLICT (id) DO NOTHING;

-- Одна версия на каждое массовое задание: студент, зачисленный на курс задания.
INSERT INTO submission_versions (assignment_id, student_id, version_no, body, submitted_at, is_late)
SELECT a.id,
       e.student_id,
       1,
       'Массовая работа по заданию ' || a.id,
       a.due_at - interval '1 day',
       false
FROM assignments AS a
JOIN LATERAL (
    SELECT en.student_id
    FROM enrollments AS en
    WHERE en.course_id = a.course_id
      AND en.status = 'active'
    ORDER BY en.student_id
    LIMIT 1
) AS e ON true
WHERE a.id > 10000
ON CONFLICT (assignment_id, student_id, version_no) DO NOTHING;

-- Оценка каждой массовой версии преподавателем курса.
INSERT INTO grades (version_id, graded_by, score, comment, graded_at)
SELECT sv.id,
       c.teacher_id,
       round(a.max_score * 0.8, 2),
       'Массовая оценка для проверки планов',
       a.due_at
FROM submission_versions AS sv
JOIN assignments AS a ON a.id = sv.assignment_id
JOIN courses     AS c ON c.id = a.course_id
WHERE a.id > 10000
ON CONFLICT (version_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('assignments', 'id'),
              (SELECT max(id) FROM assignments));

COMMIT;

ANALYZE assignments;
ANALYZE submission_versions;
ANALYZE grades;

SELECT (SELECT count(*) FROM assignments)          AS assignments,
       (SELECT count(*) FROM submission_versions) AS versions,
       (SELECT count(*) FROM grades)              AS grades;
