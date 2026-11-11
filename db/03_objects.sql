-- StudyTrack / 03_objects.sql
-- VIEW, функция, процедуры, триггеры и история изменений.
-- Скрипт выполняется после 02_seed.sql, поэтому дополнительно проверяет,
-- что демонстрационные оценки не нарушают правило «0 <= score <= max_score».

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- VIEW 1. Текущие результаты: по одной строке на пару «студент — задание».
-- Берётся последняя версия, у которой есть оценка.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_course_results AS
WITH graded_versions AS (
    SELECT sv.id,
           sv.assignment_id,
           sv.student_id,
           sv.version_no,
           sv.is_late,
           ROW_NUMBER() OVER (
               PARTITION BY sv.student_id, sv.assignment_id
               ORDER BY sv.version_no DESC
           ) AS rn
    FROM submission_versions AS sv
    JOIN grades AS g ON g.version_id = sv.id
)
SELECT c.id                                AS course_id,
       c.title                             AS course_title,
       c.teacher_id                        AS teacher_id,
       a.id                                AS assignment_id,
       a.title                             AS assignment_title,
       a.due_at                            AS due_at,
       a.max_score                         AS max_score,
       u.id                                AS student_id,
       u.full_name                         AS student_name,
       gv.version_no                       AS version_no,
       g.score                             AS score,
       g.graded_at                         AS graded_at,
       gv.is_late                          AS is_late,
       round(g.score / a.max_score * 100, 2) AS percent
FROM graded_versions AS gv
JOIN grades           AS g  ON g.version_id = gv.id
JOIN assignments      AS a  ON a.id = gv.assignment_id
JOIN courses          AS c  ON c.id = a.course_id
JOIN users            AS u  ON u.id = gv.student_id
WHERE gv.rn = 1;

COMMENT ON VIEW v_course_results IS
    'Одна строка = текущий (последний оценённый) результат студента по заданию курса.';

-- ---------------------------------------------------------------------------
-- VIEW 2. Сдаваемость заданий: версии, просрочки, оценки, средний результат.
-- Предварительные агрегаты исключают размножение строк при соединениях.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_assignment_status AS
WITH sub AS (
    SELECT sv.assignment_id,
           count(*)                                        AS versions_count,
           count(DISTINCT sv.student_id)                   AS students_submitted,
           count(*) FILTER (WHERE sv.is_late)              AS late_versions,
           count(*) FILTER (WHERE g.id IS NULL)            AS ungraded_versions
    FROM submission_versions AS sv
    LEFT JOIN grades AS g ON g.version_id = sv.id
    GROUP BY sv.assignment_id
),
gr AS (
    SELECT sv.assignment_id,
           count(*)                                        AS graded_versions,
           round(avg(g.score), 2)                          AS avg_score,
           round(avg(g.score / a.max_score * 100), 2)      AS avg_percent
    FROM grades AS g
    JOIN submission_versions AS sv ON sv.id = g.version_id
    JOIN assignments AS a ON a.id = sv.assignment_id
    GROUP BY sv.assignment_id
),
en AS (
    SELECT course_id,
           count(*) FILTER (WHERE status = 'active') AS active_students
    FROM enrollments
    GROUP BY course_id
)
SELECT a.id                                      AS assignment_id,
       a.title                                   AS assignment_title,
       c.id                                      AS course_id,
       c.title                                   AS course_title,
       a.due_at,
       a.max_score,
       a.expected_minutes,
       coalesce(en.active_students, 0)           AS enrolled_students,
       coalesce(sub.versions_count, 0)           AS versions_count,
       coalesce(sub.students_submitted, 0)       AS students_submitted,
       coalesce(sub.late_versions, 0)            AS late_versions,
       coalesce(sub.ungraded_versions, 0)        AS ungraded_versions,
       coalesce(gr.graded_versions, 0)           AS graded_versions,
       gr.avg_score,
       gr.avg_percent
FROM assignments AS a
JOIN courses AS c ON c.id = a.course_id
LEFT JOIN sub ON sub.assignment_id = a.id
LEFT JOIN gr  ON gr.assignment_id = a.id
LEFT JOIN en  ON en.course_id = a.course_id;

COMMENT ON VIEW v_assignment_status IS
    'Одна строка = задание: число версий, просрочек, оценок и средний результат.';

-- ---------------------------------------------------------------------------
-- FUNCTION. Текущие результаты студента по курсу.
-- Возвращает пустой набор, если подходящих записей нет.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_student_course_result(
    p_student_id integer,
    p_course_id  integer
)
RETURNS TABLE (
    assignment_id    integer,
    assignment_title text,
    due_at           timestamptz,
    version_no       integer,
    score            numeric,
    max_score        numeric,
    percent          numeric,
    is_late          boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT r.assignment_id,
           r.assignment_title,
           r.due_at,
           r.version_no,
           r.score,
           r.max_score,
           r.percent,
           r.is_late
    FROM v_course_results AS r
    WHERE r.student_id = p_student_id
      AND r.course_id = p_course_id
    ORDER BY r.assignment_id;
$$;

COMMENT ON FUNCTION fn_student_course_result(integer, integer) IS
    'Текущие результаты студента по курсу (пустой набор, если записей нет).';

-- ---------------------------------------------------------------------------
-- TRIGGER 1. Проверка оценки: 0 <= score <= max_score и преподаватель курса.
-- Правило затрагивает две таблицы, поэтому CHECK недостаточно.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_grades_validate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_score    numeric(6,2);
    v_teacher_id   integer;
    v_assignment   integer;
BEGIN
    SELECT a.max_score, c.teacher_id, a.id
      INTO v_max_score, v_teacher_id, v_assignment
    FROM submission_versions AS sv
    JOIN assignments AS a ON a.id = sv.assignment_id
    JOIN courses     AS c ON c.id = a.course_id
    WHERE sv.id = NEW.version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Версия работы % не найдена', NEW.version_id
            USING ERRCODE = '23503';
    END IF;

    IF NEW.score < 0 OR NEW.score > v_max_score THEN
        RAISE EXCEPTION 'Оценка % вне допустимого диапазона 0..% (задание %)',
            NEW.score, v_max_score, v_assignment
            USING ERRCODE = '23514';
    END IF;

    IF NEW.graded_by IS DISTINCT FROM v_teacher_id THEN
        RAISE EXCEPTION 'Оценивать задание может только преподаватель курса (user_id=%)',
            v_teacher_id
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grades_validate
BEFORE INSERT OR UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION fn_grades_validate();

-- ---------------------------------------------------------------------------
-- TRIGGER 2. Неизменяемая история выставления и исправления оценок.
-- Пишет в другую таблицу, поэтому не вызывает рекурсивного обновления grades.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_grades_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO grade_history (
        grade_id, version_id, old_score, new_score, action, changed_by, comment
    )
    VALUES (
        NEW.id,
        NEW.version_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.score ELSE NULL END,
        NEW.score,
        TG_OP,
        NEW.graded_by,
        NEW.comment
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_grades_history
AFTER INSERT OR UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION fn_grades_history();

-- ---------------------------------------------------------------------------
-- PROCEDURE 1. Сдача версии работы.
-- Порядок блокировок: assignments → enrollments (одинаков для всех сеансов).
-- Номер версии определяется после блокировки, поэтому две одновременные
-- попытки не получают одинаковый version_no.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE submit_version(
    p_student_id    integer,
    p_assignment_id integer,
    p_body          text,
    INOUT p_version_id integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_due_at        timestamptz;
    v_allow_revision boolean;
    v_course_id     integer;
    v_enroll_status text;
    v_student_role  text;
    v_student_active boolean;
    v_next_no       integer;
    v_is_late       boolean;
BEGIN
    IF p_body IS NULL OR btrim(p_body) = '' THEN
        RAISE EXCEPTION 'Текст работы не может быть пустым'
            USING ERRCODE = '22023';
    END IF;

    SELECT role, is_active INTO v_student_role, v_student_active
    FROM users WHERE id = p_student_id;

    IF NOT FOUND OR v_student_role <> 'student' OR NOT v_student_active THEN
        RAISE EXCEPTION 'Пользователь % не является активным студентом', p_student_id
            USING ERRCODE = '42501';
    END IF;

    -- Блокируем задание: следующий номер версии вычисляется под блокировкой.
    SELECT a.due_at,
           coalesce((a.extra ->> 'allow_revision')::boolean, true),
           a.course_id
      INTO v_due_at, v_allow_revision, v_course_id
    FROM assignments AS a
    WHERE a.id = p_assignment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Задание % не найдено', p_assignment_id
            USING ERRCODE = '23503';
    END IF;

    -- Блокируем запись зачисления.
    SELECT e.status INTO v_enroll_status
    FROM enrollments AS e
    WHERE e.course_id = v_course_id
      AND e.student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Студент % не зачислен на курс %', p_student_id, v_course_id
            USING ERRCODE = '42501';
    END IF;

    IF v_enroll_status <> 'active' THEN
        RAISE EXCEPTION 'Зачисление студента % на курс % не активно (%)',
            p_student_id, v_course_id, v_enroll_status
            USING ERRCODE = '42501';
    END IF;

    SELECT coalesce(max(sv.version_no), 0) + 1
      INTO v_next_no
    FROM submission_versions AS sv
    WHERE sv.assignment_id = p_assignment_id
      AND sv.student_id = p_student_id;

    IF v_next_no > 1 AND NOT v_allow_revision THEN
        RAISE EXCEPTION 'Повторная сдача задания % запрещена', p_assignment_id
            USING ERRCODE = '23505';
    END IF;

    v_is_late := now() > v_due_at;

    INSERT INTO submission_versions (
        assignment_id, student_id, version_no, body, submitted_at, is_late
    )
    VALUES (
        p_assignment_id, p_student_id, v_next_no, p_body, now(), v_is_late
    )
    RETURNING id INTO p_version_id;
END;
$$;

COMMENT ON PROCEDURE submit_version(integer, integer, text, integer) IS
    'Сдача версии: проверка зачисления, блокировка, следующий номер, отметка просрочки.';

-- ---------------------------------------------------------------------------
-- PROCEDURE 2. Выставление/исправление оценки версии.
-- Блокируется конкретная версия; диапазон и преподаватель проверяются
-- триггером, а также здесь — до изменения данных.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE grade_version(
    p_teacher_id integer,
    p_version_id integer,
    p_score      numeric,
    p_comment    text DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_score  numeric(6,2);
    v_teacher_id integer;
    v_course_id  integer;
    v_role       text;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = p_teacher_id;
    IF NOT FOUND OR v_role <> 'teacher' THEN
        RAISE EXCEPTION 'Пользователь % не является преподавателем', p_teacher_id
            USING ERRCODE = '42501';
    END IF;

    SELECT a.max_score, c.teacher_id, c.id
      INTO v_max_score, v_teacher_id, v_course_id
    FROM submission_versions AS sv
    JOIN assignments AS a ON a.id = sv.assignment_id
    JOIN courses     AS c ON c.id = a.course_id
    WHERE sv.id = p_version_id
    FOR UPDATE OF sv;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Версия % не найдена', p_version_id
            USING ERRCODE = '23503';
    END IF;

    IF p_teacher_id <> v_teacher_id THEN
        RAISE EXCEPTION 'Преподаватель % не ведёт курс %', p_teacher_id, v_course_id
            USING ERRCODE = '42501';
    END IF;

    IF p_score IS NULL OR p_score < 0 OR p_score > v_max_score THEN
        RAISE EXCEPTION 'Оценка % вне диапазона 0..%', p_score, v_max_score
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO grades (version_id, graded_by, score, comment, graded_at)
    VALUES (p_version_id, p_teacher_id, p_score, p_comment, now())
    ON CONFLICT (version_id) DO UPDATE
        SET score     = EXCLUDED.score,
            graded_by = EXCLUDED.graded_by,
            comment   = EXCLUDED.comment,
            graded_at = now();
END;
$$;

COMMENT ON PROCEDURE grade_version(integer, integer, numeric, text) IS
    'Оценка или исправление оценки версии; дата оценки записывается одновременно.';

-- ---------------------------------------------------------------------------
-- FUNCTION. Получение учётной записи для проверки пароля.
-- SECURITY DEFINER: рабочие роли не имеют доступа к столбцу users.password_hash,
-- поэтому единственный способ прочитать хеш — эта функция. Она возвращает
-- строку только по точному логину, активному пользователю, и только 6 полей.
-- Сравнение пароля с хешем выполняет приложение (scrypt, portal/auth.py);
-- сам хеш дальше сессии не сохраняется.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_login_lookup(p_login text)
RETURNS TABLE (
    id            integer,
    full_name     text,
    email         text,
    role          text,
    password_hash text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.full_name, u.email, u.role, u.password_hash
    FROM users AS u
    WHERE u.login = lower(btrim(p_login))
      AND u.is_active
    LIMIT 1;
$$;

COMMENT ON FUNCTION fn_login_lookup(text) IS
    'SECURITY DEFINER: выдаёт данные пользователя и хеш пароля строго по логину.';

REVOKE ALL ON FUNCTION fn_login_lookup(text) FROM PUBLIC;


-- ---------------------------------------------------------------------------
-- Контроль качества демонстрационных данных после установки правил.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_bad integer;
BEGIN
    SELECT count(*) INTO v_bad
    FROM grades AS g
    JOIN submission_versions AS sv ON sv.id = g.version_id
    JOIN assignments AS a ON a.id = sv.assignment_id
    WHERE g.score < 0 OR g.score > a.max_score;

    IF v_bad > 0 THEN
        RAISE EXCEPTION 'В данных % оценок вне диапазона 0..max_score', v_bad;
    END IF;
END;
$$;

-- Демонстрация исправления оценки: триггер запишет старую и новую оценку.
UPDATE grades
   SET score = 19,
       comment = 'Исправлено после апелляции: ключи и связи описаны верно.',
       graded_at = now()
 WHERE id = 10;

COMMIT;
