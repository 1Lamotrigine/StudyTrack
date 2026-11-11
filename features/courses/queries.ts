import { query } from '@/lib/db';
import type { User, Course } from '@/lib/types';
export async function getCourses(user: User, { q = '', scope = 'all', status = 'active' } = {}) {
  return query<Course>(
    `WITH RECURSIVE tree AS (
 SELECT id,title,title::text path FROM course_categories WHERE parent_id IS NULL
 UNION ALL SELECT c.id,c.title,t.path||' / '||c.title FROM course_categories c JOIN tree t ON t.id=c.parent_id)
 SELECT c.*,u.full_name teacher_name,t.path category_path,
 (SELECT count(*)::int FROM assignments a WHERE a.course_id=c.id) assignments_count,
 (SELECT count(*)::int FROM enrollments e WHERE e.course_id=c.id AND e.status='active') students_count,
 (SELECT count(*)::int FROM assignments a WHERE a.course_id=c.id AND EXISTS(SELECT 1 FROM submission_versions sv WHERE sv.assignment_id=a.id AND sv.student_id=$1)) completed_count,
 (SELECT count(*)::int FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id WHERE a.course_id=c.id AND NOT EXISTS(SELECT 1 FROM grades g WHERE g.version_id=sv.id)) ungraded_count,
 EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.student_id=$1 AND e.status='active') enrolled
 FROM courses c JOIN users u ON u.id=c.teacher_id JOIN tree t ON t.id=c.category_id
 WHERE (c.title ILIKE $2 OR c.code ILIKE $2 OR u.full_name ILIKE $2)
 AND ($3='all' OR c.status=$3) AND ($4='all' OR ($5='teacher' AND c.teacher_id=$1) OR ($5='student' AND EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.student_id=$1 AND e.status='active')) OR $5='admin')
 AND ($5='admin' OR c.status<>'draft' OR c.teacher_id=$1)
 ORDER BY c.status='active' DESC,c.title`,
    [user.id, '%' + q + '%', status, scope, user.role],
  );
}
export async function getStudentTasks(user: User) {
  return query(
    `SELECT a.*,c.title course_title,c.code course_code,c.status course_status,
 lv.version_no,lv.submitted_at,lv.score,lv.is_late,
 CASE WHEN lv.id IS NULL AND a.due_at<now() THEN 'late' WHEN lv.id IS NULL THEN 'todo' WHEN lv.score IS NULL THEN 'pending' ELSE 'graded' END task_status
 FROM assignments a JOIN courses c ON c.id=a.course_id JOIN enrollments e ON e.course_id=c.id
 LEFT JOIN LATERAL(SELECT sv.*,g.score FROM submission_versions sv LEFT JOIN grades g ON g.version_id=sv.id WHERE sv.assignment_id=a.id AND sv.student_id=$1 ORDER BY sv.version_no DESC LIMIT 1) lv ON true
 WHERE e.student_id=$1 AND e.status='active' AND c.status='active' ORDER BY (lv.id IS NULL) DESC,a.due_at,a.id`,
    [user.id],
  );
}
export async function getReviewQueue(user: User) {
  return query(
    `SELECT sv.id,sv.version_no,sv.submitted_at,sv.is_late,a.title,a.max_score,c.title course_title,c.code course_code,c.id course_id,u.full_name student_name,
 NOT EXISTS(SELECT 1 FROM submission_versions newer WHERE newer.assignment_id=sv.assignment_id AND newer.student_id=sv.student_id AND newer.version_no>sv.version_no) is_latest
 FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=sv.student_id
 LEFT JOIN grades g ON g.version_id=sv.id WHERE c.teacher_id=$1 AND g.id IS NULL ORDER BY sv.submitted_at,sv.id`,
    [user.id],
  );
}
