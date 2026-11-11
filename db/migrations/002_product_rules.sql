-- Product invariants apply to direct SQL as well as Server Actions.
CREATE OR REPLACE FUNCTION guard_user_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.role='admin' AND OLD.is_active AND (NEW.role<>'admin' OR NOT NEW.is_active)
    AND NOT EXISTS(SELECT 1 FROM users WHERE id<>OLD.id AND role='admin' AND is_active) THEN
   RAISE EXCEPTION 'Нельзя убрать последнего активного администратора';
 END IF;
 IF NEW.role<>OLD.role THEN
   IF EXISTS(SELECT 1 FROM courses WHERE teacher_id=OLD.id) AND NEW.role<>'teacher' THEN
     RAISE EXCEPTION 'Сначала переназначьте курсы этого преподавателя';
   END IF;
   IF (EXISTS(SELECT 1 FROM enrollments WHERE student_id=OLD.id) OR EXISTS(SELECT 1 FROM submission_versions WHERE student_id=OLD.id)) AND NEW.role<>'student' THEN
     RAISE EXCEPTION 'У пользователя есть учебная история. Смена роли студента недоступна';
   END IF;
   IF EXISTS(SELECT 1 FROM grades WHERE graded_by=OLD.id) AND NEW.role<>'teacher' THEN
     RAISE EXCEPTION 'У преподавателя есть история оценивания. Используйте отдельную учётную запись для другой роли';
   END IF;
 END IF;
 IF OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
   DELETE FROM web_sessions WHERE user_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_product_guard BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION guard_user_changes();

CREATE OR REPLACE FUNCTION guard_course_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text;
BEGIN
 IF TG_TABLE_NAME='submission_versions' THEN
   SELECT c.status INTO state FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=NEW.assignment_id;
   IF state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Приём работ доступен только в активном курсе'; END IF;
 ELSE
   IF NEW.status='active' THEN
     SELECT status INTO state FROM courses WHERE id=NEW.course_id;
     IF state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Зачисление доступно только в активный курс'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER submission_course_guard BEFORE INSERT ON submission_versions FOR EACH ROW EXECUTE FUNCTION guard_course_activity();
CREATE TRIGGER enrollment_course_guard BEFORE INSERT OR UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION guard_course_activity();

CREATE OR REPLACE FUNCTION guard_assignment_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.course_id<>OLD.course_id AND EXISTS(SELECT 1 FROM submission_versions WHERE assignment_id=OLD.id) THEN
   RAISE EXCEPTION 'Нельзя переместить задание с уже отправленными работами в другой курс';
 END IF;
 IF NEW.max_score<OLD.max_score AND EXISTS(SELECT 1 FROM grades g JOIN submission_versions sv ON sv.id=g.version_id WHERE sv.assignment_id=OLD.id AND g.score>NEW.max_score) THEN
   RAISE EXCEPTION 'Максимальный балл не может быть ниже уже выставленной оценки';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignment_product_guard BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION guard_assignment_changes();
CREATE INDEX web_sessions_expiry ON web_sessions(expires_at);
