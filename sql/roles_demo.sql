-- StudyTrack / roles_demo.sql
-- Проверка прав через SET ROLE (ТЗ, раздел 10).
-- Запуск:
--   docker compose exec -T db psql -U studytrack -d studytrack -f /sql/roles_demo.sql
--
-- Ожидаемо:
--   report_reader читает только VIEW, изменение таблиц запрещено;
--   studytrack_app выполняет операционную работу, но не удаляет данные;
--   обе роли не могут создавать объекты в схеме public.

\set ON_ERROR_STOP 0
\pset pager off

\echo '=== report_reader: разрешённый SELECT из VIEW ==='
SET ROLE report_reader;
SELECT course_title, student_name, assignment_title, score, max_score
FROM v_course_results
ORDER BY course_id, student_id, assignment_id
LIMIT 5;

\echo ''
\echo '=== report_reader: запрещённый SELECT базовой таблицы ==='
SELECT * FROM users LIMIT 1;

\echo ''
\echo '=== report_reader: запрещённый UPDATE ==='
UPDATE courses SET title = 'Изменение запрещено' WHERE id = 1;

\echo ''
\echo '=== report_reader: запрещённое создание таблицы ==='
CREATE TABLE forbidden_table (id integer);

RESET ROLE;

\echo ''
\echo '=== studytrack_app: разрешённый UPDATE (title = title, данные не меняются) ==='
SET ROLE studytrack_app;
SELECT id, login, role FROM users ORDER BY id LIMIT 3;

\echo ''
\echo '=== studytrack_app: запрещённое чтение password_hash напрямую ==='
SELECT password_hash FROM users LIMIT 1;

\echo ''
\echo '=== studytrack_app: хеш доступен только через SECURITY DEFINER-функцию ==='
SELECT id, role, left(password_hash, 16) || '...' AS hash_prefix
FROM fn_login_lookup('teacher');

\echo ''
\echo '=== studytrack_app: запрещённый прямой UPDATE структурной таблицы ==='
-- Раньше это было разрешено; теперь структура меняется только процедурами.
UPDATE courses SET title = title WHERE id = 1;

\echo ''
\echo '=== studytrack_app: запрещённый DELETE ==='
DELETE FROM submission_versions WHERE id = 1;

\echo ''
\echo '=== studytrack_app: запрещённый INSERT структуры в обход процедур ==='
INSERT INTO courses (category_id, teacher_id, code, title) VALUES (1, 1, 'HACK', 'Обход процедур');
INSERT INTO admin_audit_log (actor_id, action, entity) VALUES (13, 'fake', 'user');

\echo ''
\echo '=== studytrack_app: запрещённое создание объекта в public ==='
CREATE TABLE forbidden_table (id integer);

\echo ''
\echo '=== studytrack_app: админские процедуры сами проверяют роль ==='
-- Студент (id=3) не администратор — процедура обязана отказать.
CALL admin_archive_course(3, 1);

\echo ''
\echo '=== studytrack_app: администратор (id=13) может менять структуру ==='
CALL admin_upsert_category(13, NULL, 'Проверка прав', 'role-check', NULL, NULL);

RESET ROLE;

\echo ''
\echo '=== Права ролей ==='
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('studytrack_app', 'report_reader')
ORDER BY grantee, table_name, privilege_type;
