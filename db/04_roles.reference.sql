-- StudyTrack / 04_roles.sql
-- Роли PostgreSQL и права. Роль БД — не то же самое, что запись в users.
-- studytrack_app  — операционная роль приложения (без DELETE и без CREATE в схеме)
-- report_reader   — отчётная роль: только чтение разрешённых VIEW
-- studytrack      — владелец объектов / администратор демонстрации (создан docker-образом)

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studytrack_app') THEN
        EXECUTE 'CREATE ROLE studytrack_app NOLOGIN';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_reader') THEN
        EXECUTE 'CREATE ROLE report_reader NOLOGIN';
    END IF;
END;
$$;

-- Владелец может переключаться на рабочие роли для демонстрации SET ROLE.
GRANT studytrack_app TO studytrack;
GRANT report_reader  TO studytrack;

GRANT CONNECT ON DATABASE studytrack TO studytrack_app, report_reader;
GRANT USAGE ON SCHEMA public TO studytrack_app, report_reader;

-- Операционная роль. Изменять операционные таблицы она может, но структурные
-- справочники (пользователи, курсы, задания, категории, зачисления) меняются
-- ТОЛЬКО через SECURITY DEFINER-процедуры. Поэтому INSERT/UPDATE на справочники
-- здесь не выдаются: прямой обход процедур запрещён.
GRANT INSERT, UPDATE ON
    submission_versions,
    grades
TO studytrack_app;

-- На users столбцовый SELECT: password_hash операционной роли недоступен.
-- Табличный GRANT SELECT выдал бы все столбцы, поэтому перечисляем их явно.
GRANT SELECT (
    id, full_name, email, role, login, is_active, created_at
) ON users TO studytrack_app;

GRANT SELECT ON
    course_categories,
    courses,
    enrollments,
    assignments,
    submission_versions,
    grades
TO studytrack_app;

-- На всякий случай явно закрываем хеш пароля (страховка при смене прав).
REVOKE SELECT (password_hash) ON users FROM studytrack_app;

GRANT SELECT, INSERT ON grade_history TO studytrack_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO studytrack_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO studytrack_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO studytrack_app;

-- Журнал администратора приложению недоступен даже на чтение: его читает
-- только SECURITY DEFINER-функция/владелец. Так журнал нельзя подделать.
REVOKE ALL ON admin_audit_log FROM studytrack_app, report_reader;
GRANT SELECT ON admin_audit_log TO studytrack_app;  -- список операций показываем в UI

-- Доступ к SECURITY DEFINER-функции аутентификации: только она может прочитать
-- хеш пароля; прямой SELECT users.password_hash рабочим ролям запрещён.
GRANT EXECUTE ON FUNCTION fn_login_lookup(text) TO studytrack_app;

-- Отчётная роль: только представления, без доступа к базовым таблицам.
GRANT SELECT ON v_course_results, v_assignment_status TO report_reader;
GRANT SELECT ON v_course_results, v_assignment_status TO studytrack_app;

-- Демонстрация REVOKE: удаление не должно быть доступно приложению.
GRANT DELETE ON submission_versions TO studytrack_app;
REVOKE DELETE ON submission_versions FROM studytrack_app;

-- И отчётная роль не должна читать служебную историю: выдали и сразу отозвали.
GRANT SELECT ON grade_history TO report_reader;
REVOKE SELECT ON grade_history FROM report_reader;

-- Роли не должны создавать объекты в public.
REVOKE CREATE ON SCHEMA public FROM studytrack_app, report_reader;

COMMIT;
