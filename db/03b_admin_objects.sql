-- StudyTrack / 03b_admin_objects.sql
-- Административные процедуры: управление пользователями, курсами, заданиями,
-- категориями и зачислениями. Все изменения проходят через БД, проверяются
-- ограничениями и записываются в admin_audit_log.
--
-- Процедуры создаются как SECURITY DEFINER, чтобы приложение работало под
-- ограниченной ролью studytrack_app, а проверка «это администратор» выполнялась
-- по данным users. Прямой доступ к admin_audit_log рабочим ролям закрыт.

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Вспомогательная функция: проверить, что actor — активный администратор.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assert_admin(p_actor_id integer)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = p_actor_id AND is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь % не найден или отключён', p_actor_id
            USING ERRCODE = '42501';
    END IF;
    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'Операция доступна только администратору (у %)', v_role
            USING ERRCODE = '42501';
    END IF;
END;
$$;

COMMENT ON FUNCTION fn_assert_admin(integer) IS
    'Проверяет, что пользователь активен и имеет роль admin; иначе исключение 42501.';

-- ---------------------------------------------------------------------------
-- Вспомогательная функция: запись в журнал.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_admin_log(
    p_actor_id integer,
    p_action   text,
    p_entity   text,
    p_entity_id integer,
    p_details  jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO admin_audit_log (actor_id, action, entity, entity_id, details)
    VALUES (p_actor_id, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

COMMENT ON FUNCTION fn_admin_log(integer, text, text, integer, jsonb) IS
    'Пишет строку в admin_audit_log.';

-- ---------------------------------------------------------------------------
-- Пользователи
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE admin_create_user(
    p_actor_id integer,
    p_full_name text,
    p_email    text,
    p_role     text,
    p_login    text,
    p_password_hash text,
    INOUT p_user_id integer DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    IF p_role NOT IN ('student', 'teacher', 'admin') THEN
        RAISE EXCEPTION 'Недопустимая роль: %', p_role USING ERRCODE = '22023';
    END IF;

    INSERT INTO users (full_name, email, role, login, password_hash)
    VALUES (btrim(p_full_name), lower(btrim(p_email)), p_role, lower(btrim(p_login)), p_password_hash)
    RETURNING id INTO p_user_id;

    PERFORM fn_admin_log(p_actor_id, 'create_user', 'user', p_user_id,
        jsonb_build_object('login', p_login, 'role', p_role, 'email', p_email));
END;
$$;

COMMENT ON PROCEDURE admin_create_user(integer, text, text, text, text, text, integer) IS
    'Создаёт пользователя с ролью; логин и email уникальны, формат проверяют ограничения.';

CREATE OR REPLACE PROCEDURE admin_set_role(
    p_actor_id integer,
    p_user_id  integer,
    p_role     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old text;
BEGIN
    PERFORM fn_assert_admin(p_actor_id);
    IF p_role NOT IN ('student', 'teacher', 'admin') THEN
        RAISE EXCEPTION 'Недопустимая роль: %', p_role USING ERRCODE = '22023';
    END IF;

    SELECT role INTO v_old FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь % не найден', p_user_id USING ERRCODE = '23503';
    END IF;

    UPDATE users SET role = p_role WHERE id = p_user_id;

    PERFORM fn_admin_log(p_actor_id, 'set_role', 'user', p_user_id,
        jsonb_build_object('old_role', v_old, 'new_role', p_role));
END;
$$;

COMMENT ON PROCEDURE admin_set_role(integer, integer, text) IS
    'Меняет предметную роль пользователя и пишет старое/новое значение в журнал.';

CREATE OR REPLACE PROCEDURE admin_toggle_user(
    p_actor_id integer,
    p_user_id  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old boolean;
BEGIN
    PERFORM fn_assert_admin(p_actor_id);
    IF p_user_id = p_actor_id THEN
        RAISE EXCEPTION 'Нельзя отключить собственную учётную запись' USING ERRCODE = '42501';
    END IF;

    SELECT is_active INTO v_old FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь % не найден', p_user_id USING ERRCODE = '23503';
    END IF;

    UPDATE users SET is_active = NOT v_old WHERE id = p_user_id;

    PERFORM fn_admin_log(p_actor_id, 'toggle_user', 'user', p_user_id,
        jsonb_build_object('old_is_active', v_old, 'new_is_active', NOT v_old));
END;
$$;

COMMENT ON PROCEDURE admin_toggle_user(integer, integer) IS
    'Мягкое включение/отключение учётной записи; себя отключить нельзя.';

CREATE OR REPLACE PROCEDURE admin_update_user(
    p_actor_id  integer,
    p_user_id   integer,
    p_full_name text,
    p_email     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    UPDATE users
       SET full_name = btrim(p_full_name),
           email     = lower(btrim(p_email))
     WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь % не найден', p_user_id USING ERRCODE = '23503';
    END IF;

    PERFORM fn_admin_log(p_actor_id, 'update_user', 'user', p_user_id,
        jsonb_build_object('full_name', p_full_name, 'email', p_email));
END;
$$;

COMMENT ON PROCEDURE admin_update_user(integer, integer, text, text) IS
    'Меняет ФИО и email пользователя (логин и пароль здесь не меняются).';

CREATE OR REPLACE PROCEDURE admin_reset_password(
    p_actor_id      integer,
    p_user_id       integer,
    p_password_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Пользователь % не найден', p_user_id USING ERRCODE = '23503';
    END IF;

    PERFORM fn_admin_log(p_actor_id, 'reset_password', 'user', p_user_id, '{}'::jsonb);
END;
$$;

COMMENT ON PROCEDURE admin_reset_password(integer, integer, text) IS
    'Устанавливает новый scrypt-хеш пароля; сам пароль в журнал не пишется.';

-- ---------------------------------------------------------------------------
-- Категории
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE admin_upsert_category(
    p_actor_id  integer,
    p_category_id integer,
    p_title     text,
    p_slug      text,
    p_parent_id integer,
    INOUT p_id  integer DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    IF p_category_id IS NULL THEN
        INSERT INTO course_categories (title, slug, parent_id)
        VALUES (btrim(p_title), lower(btrim(p_slug)), p_parent_id)
        RETURNING id INTO p_id;
        PERFORM fn_admin_log(p_actor_id, 'create_category', 'category', p_id,
            jsonb_build_object('title', p_title, 'parent_id', p_parent_id));
    ELSE
        UPDATE course_categories
           SET title = btrim(p_title),
               slug = lower(btrim(p_slug)),
               parent_id = p_parent_id
         WHERE id = p_category_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Категория % не найдена', p_category_id USING ERRCODE = '23503';
        END IF;
        p_id := p_category_id;
        PERFORM fn_admin_log(p_actor_id, 'update_category', 'category', p_id,
            jsonb_build_object('title', p_title, 'parent_id', p_parent_id));
    END IF;
END;
$$;

COMMENT ON PROCEDURE admin_upsert_category(integer, integer, text, text, integer, integer) IS
    'Создаёт или обновляет категорию курсов; самоссылку и цикл запрещают ограничения.';

-- ---------------------------------------------------------------------------
-- Курсы
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE admin_upsert_course(
    p_actor_id   integer,
    p_course_id  integer,
    p_category_id integer,
    p_teacher_id integer,
    p_code       text,
    p_title      text,
    p_description text,
    p_status     text,
    INOUT p_id   integer DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_role text;
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    IF p_status NOT IN ('draft', 'active', 'archived') THEN
        RAISE EXCEPTION 'Недопустимый статус курса: %', p_status USING ERRCODE = '22023';
    END IF;

    SELECT role INTO v_teacher_role FROM users WHERE id = p_teacher_id AND is_active;
    IF NOT FOUND OR v_teacher_role <> 'teacher' THEN
        RAISE EXCEPTION 'Преподаватель % не найден или не является активным преподавателем', p_teacher_id
            USING ERRCODE = '23503';
    END IF;

    IF p_course_id IS NULL THEN
        INSERT INTO courses (category_id, teacher_id, code, title, description, status)
        VALUES (p_category_id, p_teacher_id, upper(btrim(p_code)), btrim(p_title),
                coalesce(p_description, ''), p_status)
        RETURNING id INTO p_id;
        PERFORM fn_admin_log(p_actor_id, 'create_course', 'course', p_id,
            jsonb_build_object('code', p_code, 'teacher_id', p_teacher_id));
    ELSE
        UPDATE courses
           SET category_id = p_category_id,
               teacher_id  = p_teacher_id,
               code        = upper(btrim(p_code)),
               title       = btrim(p_title),
               description = coalesce(p_description, ''),
               status      = p_status
         WHERE id = p_course_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Курс % не найден', p_course_id USING ERRCODE = '23503';
        END IF;
        p_id := p_course_id;
        PERFORM fn_admin_log(p_actor_id, 'update_course', 'course', p_id,
            jsonb_build_object('code', p_code, 'teacher_id', p_teacher_id, 'status', p_status));
    END IF;
END;
$$;

COMMENT ON PROCEDURE admin_upsert_course(integer, integer, integer, integer, text, text, text, text, integer) IS
    'Создаёт или обновляет курс; преподаватель должен быть активным teacher.';

CREATE OR REPLACE PROCEDURE admin_archive_course(
    p_actor_id  integer,
    p_course_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    UPDATE courses SET status = 'archived' WHERE id = p_course_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Курс % не найден', p_course_id USING ERRCODE = '23503';
    END IF;

    PERFORM fn_admin_log(p_actor_id, 'archive_course', 'course', p_course_id, '{}'::jsonb);
END;
$$;

COMMENT ON PROCEDURE admin_archive_course(integer, integer) IS
    'Мягкое удаление курса: перевод в статус archived, записи сохраняются.';

-- ---------------------------------------------------------------------------
-- Задания
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE admin_upsert_assignment(
    p_actor_id     integer,
    p_assignment_id integer,
    p_course_id    integer,
    p_title        text,
    p_description  text,
    p_due_at       timestamptz,
    p_max_score    numeric,
    p_extra        jsonb,
    INOUT p_id     integer DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    IF p_assignment_id IS NULL THEN
        INSERT INTO assignments (course_id, title, description, due_at, max_score, extra)
        VALUES (p_course_id, btrim(p_title), coalesce(p_description, ''),
                p_due_at, p_max_score, coalesce(p_extra, '{}'::jsonb))
        RETURNING id INTO p_id;
        PERFORM fn_admin_log(p_actor_id, 'create_assignment', 'assignment', p_id,
            jsonb_build_object('course_id', p_course_id, 'max_score', p_max_score));
    ELSE
        UPDATE assignments
           SET course_id   = p_course_id,
               title       = btrim(p_title),
               description = coalesce(p_description, ''),
               due_at      = p_due_at,
               max_score   = p_max_score,
               extra       = coalesce(p_extra, '{}'::jsonb)
         WHERE id = p_assignment_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Задание % не найдено', p_assignment_id USING ERRCODE = '23503';
        END IF;
        p_id := p_assignment_id;
        PERFORM fn_admin_log(p_actor_id, 'update_assignment', 'assignment', p_id,
            jsonb_build_object('course_id', p_course_id, 'max_score', p_max_score));
    END IF;
END;
$$;

COMMENT ON PROCEDURE admin_upsert_assignment(integer, integer, integer, text, text, timestamptz, numeric, jsonb, integer) IS
    'Создаёт или обновляет задание; JSONB-параметры и max_score проверяют ограничения.';

-- ---------------------------------------------------------------------------
-- Зачисления
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE admin_enroll(
    p_actor_id  integer,
    p_course_id integer,
    p_student_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    SELECT role INTO v_role FROM users WHERE id = p_student_id AND is_active;
    IF NOT FOUND OR v_role <> 'student' THEN
        RAISE EXCEPTION 'Пользователь % не найден или не является активным студентом', p_student_id
            USING ERRCODE = '23503';
    END IF;

    INSERT INTO enrollments (course_id, student_id, status)
    VALUES (p_course_id, p_student_id, 'active')
    ON CONFLICT (course_id, student_id) DO UPDATE SET status = 'active';

    PERFORM fn_admin_log(p_actor_id, 'enroll', 'enrollment', NULL,
        jsonb_build_object('course_id', p_course_id, 'student_id', p_student_id, 'status', 'active'));
END;
$$;

COMMENT ON PROCEDURE admin_enroll(integer, integer, integer) IS
    'Зачисляет студента на курс; повторная операция восстанавливает статус active.';

CREATE OR REPLACE PROCEDURE admin_drop_enrollment(
    p_actor_id   integer,
    p_course_id  integer,
    p_student_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM fn_assert_admin(p_actor_id);

    UPDATE enrollments
       SET status = 'dropped'
     WHERE course_id = p_course_id AND student_id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Зачисление студента % на курс % не найдено', p_student_id, p_course_id
            USING ERRCODE = '23503';
    END IF;

    PERFORM fn_admin_log(p_actor_id, 'drop_enrollment', 'enrollment', NULL,
        jsonb_build_object('course_id', p_course_id, 'student_id', p_student_id, 'status', 'dropped'));
END;
$$;

COMMENT ON PROCEDURE admin_drop_enrollment(integer, integer, integer) IS
    'Мягкое удаление зачисления: перевод в статус dropped.';

COMMIT;
