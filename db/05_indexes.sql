-- StudyTrack / 05_indexes.sql
-- Индексы создаются после данных: так быстрее первичная загрузка.
-- Составной индекс (course_id, due_at) обслуживает основной список заданий курса
-- с фильтром по сроку; порядок столбцов соответствует условиям запроса.

\set ON_ERROR_STOP on

BEGIN;

-- FK-столбцы, по которым выполняются соединения.
CREATE INDEX IF NOT EXISTS idx_courses_category      ON courses (category_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher       ON courses (teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student   ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_courses_status        ON courses (status);

-- Основной список: задания курса, отсортированные по сроку.
CREATE INDEX IF NOT EXISTS idx_assignments_course_due
    ON assignments (course_id, due_at);

-- Аналитические выборки версий и оценок.
CREATE INDEX IF NOT EXISTS idx_versions_student_submitted
    ON submission_versions (student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_assignment
    ON submission_versions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_versions_late
    ON submission_versions (assignment_id)
    WHERE is_late;
CREATE INDEX IF NOT EXISTS idx_grades_graded_at
    ON grades (graded_at);
CREATE INDEX IF NOT EXISTS idx_grade_history_grade
    ON grade_history (grade_id, changed_at);

-- Полнотекстовый поиск (GIN по tsvector).
CREATE INDEX IF NOT EXISTS idx_assignments_search_gin
    ON assignments USING gin (search_vector);

-- Индекс по вычисляемому столбцу expected_minutes.
CREATE INDEX IF NOT EXISTS idx_assignments_expected_minutes
    ON assignments (expected_minutes);

COMMIT;

ANALYZE users;
ANALYZE course_categories;
ANALYZE courses;
ANALYZE enrollments;
ANALYZE assignments;
ANALYZE submission_versions;
ANALYZE grades;
