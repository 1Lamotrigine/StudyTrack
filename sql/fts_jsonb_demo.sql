-- StudyTrack / fts_jsonb_demo.sql
-- Полнотекстовый поиск, JSONB и вычисляемый столбец expected_minutes.
-- Все изменения данных откатываются, демонстрационный набор не меняется.
--
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/fts_jsonb_demo.sql

\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. Полнотекстовые тексты: 12 заданий, согласованная конфигурация russian ==='
SELECT count(*) AS indexed_texts,
       count(*) FILTER (WHERE search_vector IS NOT NULL) AS with_tsvector
FROM assignments;

SELECT id, title, length(search_vector::text) AS tsvector_chars
FROM assignments
ORDER BY id;

\echo ''
\echo '=== 2. Поиск слов через tsquery и @@ с релевантностью ==='
SELECT a.id,
       a.title,
       ts_rank(a.search_vector, q.query) AS rank
FROM assignments AS a,
     plainto_tsquery('russian', 'вёрстка адаптивная') AS q(query)
WHERE a.search_vector @@ q.query
ORDER BY rank DESC, a.id;

\echo ''
\echo '=== 3. Фраза и исключение (синтаксис websearch_to_tsquery) ==='
-- "адаптивная вёрстка" — фраза; -мобильные — исключить слово.
SELECT a.id, a.title, ts_rank(a.search_vector, q.query) AS rank
FROM assignments AS a,
     websearch_to_tsquery('russian', '"адаптивная вёрстка" -мобильные') AS q(query)
WHERE a.search_vector @@ q.query
ORDER BY rank DESC;

\echo ''
\echo '=== 4. Поиск без результатов ==='
SELECT count(*) AS found
FROM assignments AS a,
     plainto_tsquery('russian', 'квантовый телепорт') AS q(query)
WHERE a.search_vector @@ q.query;

\echo ''
\echo '=== 5. Проверка GIN-индекса ==='
EXPLAIN (COSTS OFF)
SELECT id, title
FROM assignments
WHERE search_vector @@ plainto_tsquery('russian', 'вёрстка');

\echo ''
\echo '=== 6. Сравнение с LIKE (разный смысл: LIKE ищет подстроку, FTS — лексемы) ==='
SELECT (SELECT count(*) FROM assignments WHERE description ILIKE '%вёрстк%') AS like_matches,
       (SELECT count(*) FROM assignments
         WHERE search_vector @@ plainto_tsquery('russian', 'вёрстка')) AS fts_matches;

\echo ''
\echo '=== 7. Обновление текста: tsvector пересчитывается автоматически ==='
BEGIN;

UPDATE assignments
   SET description = description || ' Добавлен раздел про каскадные таблицы стилей.'
 WHERE id = 1;

SELECT id,
       (search_vector @@ plainto_tsquery('russian', 'каскадные')) AS found_after_update
FROM assignments
WHERE id = 1;

ROLLBACK;

\echo ''
\echo '=== 8. JSONB: извлечение по пути, тип значения, обновление jsonb_set ==='
SELECT id,
       extra -> 'submission_format'        AS format_json,
       extra ->> 'submission_format'       AS format_text,
       extra -> 'expected_minutes'         AS minutes_json,
       (extra ->> 'expected_minutes')::int AS minutes_int,
       jsonb_typeof(extra -> 'allow_revision') AS allow_type
FROM assignments
WHERE id IN (1, 3, 9)
ORDER BY id;

BEGIN;

UPDATE assignments
   SET extra = jsonb_set(extra, '{submission_format}', '"docx"'::jsonb, true)
 WHERE id = 3
RETURNING id, extra ->> 'submission_format' AS new_format;

-- Добавление отсутствующего ключа (create_if_missing = true).
UPDATE assignments
   SET extra = jsonb_set(extra, '{peer_review}', 'true'::jsonb, true)
 WHERE id = 3
RETURNING id, extra -> 'peer_review' AS peer_review;

ROLLBACK;

\echo ''
\echo '=== 9. GENERATED-столбец: корректное значение, отсутствие ключа, неверный тип ==='
BEGIN;

-- 9a. Корректное значение.
INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
VALUES (3, 'Проверка generated-столбца', 'Тестовое задание', now() + interval '7 days', 10,
        '{"expected_minutes": 45, "submission_format": "txt", "allow_revision": false}')
RETURNING id, expected_minutes;

-- 9b. Ключа нет: generated-значение NULL, это допустимо.
INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
VALUES (3, 'Задание без expected_minutes', 'Тестовое задание', now() + interval '7 days', 10,
        '{"submission_format": "txt"}')
RETURNING id, expected_minutes;

-- 9c. Неверный тип и выход за диапазон: ошибки перехватываются и показываются.
DO $$
BEGIN
    BEGIN
        INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
        VALUES (3, 'Неверный тип', 'Тест', now() + interval '7 days', 10,
                '{"expected_minutes": "много"}');
        RAISE NOTICE 'ОШИБКА ТЕСТА: неверный тип был принят';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Ожидаемая ошибка типа: %', SQLERRM;
    END;

    BEGIN
        INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
        VALUES (3, 'Вне диапазона', 'Тест', now() + interval '7 days', 10,
                '{"expected_minutes": 2}');
        RAISE NOTICE 'ОШИБКА ТЕСТА: значение 2 было принято';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Ожидаемая ошибка диапазона: %', SQLERRM;
    END;
END;
$$;

ROLLBACK;
