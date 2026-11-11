-- StudyTrack / queries_Q01_Q16.sql
-- Обязательные запросы по ТЗ, раздел 6. Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/queries_Q01_Q16.sql
-- Отчётный период: 01.09.2026 – 31.10.2026 (по due_at).
-- Текущий результат = последняя версия, у которой есть оценка.
-- Исправленная оценка хранится в grades (одна строка на версию), история — в grade_history,
-- поэтому исправление не удваивает итог.

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo '================ Q01. SELECT с WHERE, проекцией и ORDER BY ================'
-- Назначение: активные задания октября 2026, ближайшие первыми.
-- Параметры: границы периода.
SELECT a.id,
       a.title,
       a.due_at,
       a.max_score,
       a.expected_minutes
FROM assignments AS a
WHERE a.due_at >= timestamptz '2026-10-01 00:00+03'
  AND a.due_at <  timestamptz '2026-11-01 00:00+03'
ORDER BY a.due_at, a.title;

\echo ''
\echo '================ Q02. JOIN не менее трёх связанных таблиц ================'
-- Назначение: все версии курса 2 с оценками, студентами и заданиями.
SELECT c.title       AS course,
       a.title       AS assignment,
       u.full_name   AS student,
       sv.version_no,
       sv.submitted_at,
       g.score,
       a.max_score
FROM submission_versions AS sv
JOIN assignments AS a ON a.id = sv.assignment_id
JOIN courses     AS c ON c.id = a.course_id
JOIN users       AS u ON u.id = sv.student_id
LEFT JOIN grades AS g ON g.version_id = sv.id
WHERE c.id = 2
ORDER BY a.id, u.full_name, sv.version_no;

\echo ''
\echo '================ Q03. LEFT JOIN со справочником и пустой категорией ========'
-- Назначение: число курсов в каждой категории; категория 9 не имеет курсов.
SELECT pc.title        AS parent_category,
       cc.id,
       cc.title        AS category,
       count(c.id)     AS courses_count
FROM course_categories AS cc
LEFT JOIN course_categories AS pc ON pc.id = cc.parent_id
LEFT JOIN courses AS c ON c.category_id = cc.id
GROUP BY pc.title, cc.id, cc.title
ORDER BY courses_count, cc.id;

\echo ''
\echo '================ Q04. GROUP BY, агрегат и HAVING ========================='
-- Назначение: курсы, где не менее двух заданий; сумма максимальных баллов.
SELECT c.id,
       c.title,
       count(a.id)          AS assignments_count,
       sum(a.max_score)     AS total_max_score,
       round(avg(a.max_score), 2) AS avg_max_score
FROM courses AS c
JOIN assignments AS a ON a.course_id = c.id
GROUP BY c.id, c.title
HAVING count(a.id) >= 2
ORDER BY total_max_score DESC;

\echo ''
\echo '================ Q05. EXISTS / NOT EXISTS и коррелированный подзапрос ====='
-- 5a. Зачисленные на курс 2, не сдавшие задание 4.
SELECT u.id, u.full_name
FROM enrollments AS e
JOIN users AS u ON u.id = e.student_id
WHERE e.course_id = 2
  AND e.status = 'active'
  AND NOT EXISTS (
      SELECT 1
      FROM submission_versions AS sv
      WHERE sv.assignment_id = 4
        AND sv.student_id = e.student_id
  )
ORDER BY u.full_name;

-- 5b. Студенты, у которых есть хотя бы одна просроченная версия.
SELECT u.id, u.full_name,
       (SELECT count(*) FROM submission_versions AS sv
         WHERE sv.student_id = u.id AND sv.is_late) AS late_versions
FROM users AS u
WHERE u.role = 'student'
  AND EXISTS (
      SELECT 1 FROM submission_versions AS sv
      WHERE sv.student_id = u.id AND sv.is_late
  )
ORDER BY late_versions DESC, u.full_name;

\echo ''
\echo '================ Q06. Отчёт 1: сдаваемость заданий и просрочки ==========='
-- Назначение: по каждому заданию периода — охват сдавших и доля просрочек.
-- Единица: задание. Статусы: все версии; просрочка — is_late=true.
SELECT assignment_id,
       assignment_title,
       course_title,
       enrolled_students,
       students_submitted,
       versions_count,
       late_versions,
       graded_versions,
       round(students_submitted::numeric / nullif(enrolled_students, 0) * 100, 1) AS submitted_pct,
       round(late_versions::numeric / nullif(versions_count, 0) * 100, 1)          AS late_pct,
       avg_score,
       max_score
FROM v_assignment_status
WHERE due_at >= timestamptz '2026-09-01 00:00+03'
  AND due_at <  timestamptz '2026-11-01 00:00+03'
ORDER BY late_pct DESC NULLS LAST, assignment_id;

\echo ''
\echo '================ Q07. Отчёт 2: текущие оценки и средние по курсам (CTE) ==='
-- Назначение: средний текущий процент по курсу и число студентов с результатами.
-- Одна строка = курс. Сначала считаем средний процент студента, затем курса,
-- чтобы студент с большим числом заданий не доминировал.
WITH per_student AS (
    SELECT course_id,
           student_id,
           avg(percent) AS student_avg_percent
    FROM v_course_results
    GROUP BY course_id, student_id
),
course_stats AS (
    SELECT course_id,
           count(*)                     AS students_with_results,
           round(avg(student_avg_percent), 2) AS avg_student_percent,
           min(student_avg_percent)     AS min_student_percent,
           max(student_avg_percent)     AS max_student_percent
    FROM per_student
    GROUP BY course_id
)
SELECT c.id,
       c.title,
       cs.students_with_results,
       cs.avg_student_percent,
       round(cs.min_student_percent, 2) AS min_student_percent,
       round(cs.max_student_percent, 2) AS max_student_percent
FROM course_stats AS cs
JOIN courses AS c ON c.id = cs.course_id
ORDER BY cs.avg_student_percent DESC;

\echo ''
\echo '================ Q08. WITH RECURSIVE: поддерево, глубина, путь ==========='
-- Параметр: id корневой категории. Обход прекращается, если узел уже в пути.
\set root_id 1
WITH RECURSIVE category_tree AS (
    SELECT cc.id,
           cc.parent_id,
           cc.title,
           0 AS depth,
           ARRAY[cc.id] AS path_ids,
           cc.title::text AS path_titles
    FROM course_categories AS cc
    WHERE cc.id = :root_id

    UNION ALL

    SELECT child.id,
           child.parent_id,
           child.title,
           t.depth + 1,
           t.path_ids || child.id,
           t.path_titles || ' → ' || child.title
    FROM course_categories AS child
    JOIN category_tree AS t ON child.parent_id = t.id
    WHERE NOT child.id = ANY(t.path_ids)   -- защита от цикла
)
SELECT id, parent_id, title, depth, path_titles
FROM category_tree
ORDER BY path_ids;

\echo '--- Q08b. Неизвестный id: пустой результат ---'
\set root_id 999
WITH RECURSIVE category_tree AS (
    SELECT cc.id, cc.parent_id, cc.title, 0 AS depth, ARRAY[cc.id] AS path_ids
    FROM course_categories AS cc WHERE cc.id = :root_id
    UNION ALL
    SELECT child.id, child.parent_id, child.title, t.depth + 1, t.path_ids || child.id
    FROM course_categories AS child
    JOIN category_tree AS t ON child.parent_id = t.id
    WHERE NOT child.id = ANY(t.path_ids)
)
SELECT count(*) AS nodes FROM category_tree;

\echo ''
\echo '================ Q09. ROW_NUMBER: последняя версия в группе ==============='
-- Назначение: последняя версия каждого студента по каждому заданию курса 2.
SELECT student_name,
       assignment_title,
       version_no,
       submitted_at,
       score,
       max_score,
       is_late
FROM (
    SELECT u.full_name AS student_name,
           a.title     AS assignment_title,
           sv.version_no,
           sv.submitted_at,
           g.score,
           a.max_score,
           sv.is_late,
           ROW_NUMBER() OVER (
               PARTITION BY sv.student_id, sv.assignment_id
               ORDER BY sv.version_no DESC
           ) AS rn
    FROM submission_versions AS sv
    JOIN assignments AS a ON a.id = sv.assignment_id
    JOIN courses     AS c ON c.id = a.course_id
    JOIN users       AS u ON u.id = sv.student_id
    LEFT JOIN grades AS g ON g.version_id = sv.id
    WHERE c.id = 2
) AS ranked
WHERE rn = 1
ORDER BY assignment_title, student_name;

\echo ''
\echo '================ Q10. RANK и DENSE_RANK с равными значениями ============='
-- Назначение: рейтинг по заданию 3; три студента имеют 18 баллов.
SELECT student_name,
       score,
       RANK()       OVER (ORDER BY score DESC) AS rank_position,
       DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank_position
FROM v_course_results
WHERE assignment_id = 3
ORDER BY score DESC, student_name;

\echo ''
\echo '================ Q11. LAG и LEAD: предыдущая/следующая версия ============'
-- Назначение: интервалы между версиями одного студента.
SELECT assignment_id,
       version_no,
       submitted_at,
       lag(submitted_at)  OVER (PARTITION BY student_id, assignment_id ORDER BY version_no) AS prev_submitted_at,
       lead(submitted_at) OVER (PARTITION BY student_id, assignment_id ORDER BY version_no) AS next_submitted_at,
       round(extract(epoch FROM submitted_at -
             lag(submitted_at) OVER (PARTITION BY student_id, assignment_id ORDER BY version_no)
           ) / 3600.0, 1) AS hours_since_prev
FROM submission_versions
WHERE student_id = 3
ORDER BY assignment_id, version_no;

\echo ''
\echo '================ Q12. NTILE(4): четыре группы по среднему проценту ======='
-- Назначение: разбить 10 студентов на 4 квартиля по среднему текущему проценту.
WITH student_avg AS (
    SELECT u.id,
           u.full_name,
           round(avg(r.percent), 2) AS avg_percent
    FROM v_course_results AS r
    JOIN users AS u ON u.id = r.student_id
    GROUP BY u.id, u.full_name
)
SELECT full_name,
       avg_percent,
       NTILE(4) OVER (ORDER BY avg_percent DESC) AS quartile
FROM student_avg
ORDER BY avg_percent DESC, full_name;

\echo ''
\echo '================ Q13. UNION и UNION ALL =================================='
-- Назначение: студенты, сдававшие задание 1 или 2.
-- UNION устраняет повторяющиеся student_id, UNION ALL сохраняет их.
SELECT student_id
FROM submission_versions
WHERE assignment_id = 1
UNION
SELECT student_id
FROM submission_versions
WHERE assignment_id = 2
ORDER BY student_id;

SELECT 'UNION' AS mode, count(*) AS rows_count
FROM (
    SELECT student_id FROM submission_versions WHERE assignment_id = 1
    UNION
    SELECT student_id FROM submission_versions WHERE assignment_id = 2
) AS u
UNION ALL
SELECT 'UNION ALL', count(*)
FROM (
    SELECT student_id FROM submission_versions WHERE assignment_id = 1
    UNION ALL
    SELECT student_id FROM submission_versions WHERE assignment_id = 2
) AS ua;

\echo ''
\echo '================ Q14. Полнотекстовый поиск и релевантность ==============='
-- Назначение: поиск по названию и описанию задания с сортировкой по ts_rank.
-- Синтаксис websearch_to_tsquery: слова, фразы в кавычках, OR, -исключение.
SELECT a.id,
       a.title,
       ts_rank(a.search_vector, q.query) AS rank,
       ts_headline('russian', a.description, q.query,
                   'StartSel=<b>, StopSel=</b>, MaxWords=25, MinWords=10') AS headline
FROM assignments AS a,
     websearch_to_tsquery('russian', 'адаптивная вёрстка') AS q(query)
WHERE a.search_vector @@ q.query
ORDER BY rank DESC, a.id;

\echo '--- Q14b. Фраза и исключение ---'
SELECT a.id, a.title, ts_rank(a.search_vector, q.query) AS rank
FROM assignments AS a,
     websearch_to_tsquery('russian', '"адаптивная вёрстка" -мобильные') AS q(query)
WHERE a.search_vector @@ q.query
ORDER BY rank DESC;

\echo ''
\echo '================ Q15. JSONB: извлечение, фильтр и обновление ============='
-- 15a. Извлечение текстового/числового значения и фильтр по формату.
SELECT id,
       title,
       extra ->> 'submission_format'       AS submission_format,
       (extra ->> 'expected_minutes')::int AS expected_minutes,
       extra -> 'allow_revision'           AS allow_revision
FROM assignments
WHERE extra ->> 'submission_format' = 'zip'
ORDER BY id;

-- 15b. Обновление одного ключа через jsonb_set; вычисляемый столбец пересчитывается.
BEGIN;
UPDATE assignments
   SET extra = jsonb_set(extra, '{expected_minutes}', '150'::jsonb, true)
 WHERE id = 1
RETURNING id, extra ->> 'expected_minutes' AS json_value, expected_minutes AS generated_value;
ROLLBACK;

\echo ''
\echo '================ Q16. Параметризованный запрос приложения ================='
-- Назначение: задания курса + последняя версия и оценка выбранного студента.
-- Параметры: course_id, student_id (в приложении передаются отдельно от SQL-текста).
\set course_id 2
\set student_id 3
SELECT a.id,
       a.title,
       a.due_at,
       last_version.version_no,
       last_version.submitted_at,
       last_version.score,
       a.max_score,
       last_version.is_late
FROM assignments AS a
LEFT JOIN LATERAL (
    SELECT sv.version_no,
           sv.submitted_at,
           sv.is_late,
           g.score
    FROM submission_versions AS sv
    LEFT JOIN grades AS g ON g.version_id = sv.id
    WHERE sv.assignment_id = a.id
      AND sv.student_id = :student_id
    ORDER BY sv.version_no DESC
    LIMIT 1
) AS last_version ON true
WHERE a.course_id = :course_id
ORDER BY a.due_at;
