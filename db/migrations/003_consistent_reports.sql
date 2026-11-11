-- Submission coverage counts only currently enrolled students; historical versions remain intact.
-- Average assignment scores use one current graded result per student.
CREATE OR REPLACE VIEW v_assignment_status AS
WITH sub AS (
 SELECT sv.assignment_id,count(*) versions_count,
 count(DISTINCT sv.student_id) FILTER (WHERE e.status='active') students_submitted,
 count(*) FILTER (WHERE sv.is_late) late_versions,
 count(*) FILTER (WHERE g.id IS NULL) ungraded_versions,
 count(g.id) graded_versions
 FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id
 LEFT JOIN enrollments e ON e.course_id=a.course_id AND e.student_id=sv.student_id
 LEFT JOIN grades g ON g.version_id=sv.id GROUP BY sv.assignment_id
), results AS (
 SELECT assignment_id,round(avg(score),2) avg_score,round(avg(percent),2) avg_percent
 FROM v_course_results GROUP BY assignment_id
), enrolled AS (
 SELECT course_id,count(*) FILTER(WHERE status='active') active_students FROM enrollments GROUP BY course_id
)
SELECT a.id assignment_id,a.title assignment_title,c.id course_id,c.title course_title,
 a.due_at,a.max_score,a.expected_minutes,
 coalesce(enrolled.active_students,0) enrolled_students,
 coalesce(sub.versions_count,0) versions_count,
 coalesce(sub.students_submitted,0) students_submitted,
 coalesce(sub.late_versions,0) late_versions,
 coalesce(sub.ungraded_versions,0) ungraded_versions,
 coalesce(sub.graded_versions,0) graded_versions,
 results.avg_score,results.avg_percent
FROM assignments a JOIN courses c ON c.id=a.course_id
LEFT JOIN sub ON sub.assignment_id=a.id
LEFT JOIN results ON results.assignment_id=a.id
LEFT JOIN enrolled ON enrolled.course_id=a.course_id;
