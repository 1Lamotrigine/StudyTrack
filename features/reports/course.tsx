import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card, Table } from '@/app/components';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
export async function CourseReport({ user, segments }: PageContext) {
  const id = Number(segments[2]);
  const c = await one('SELECT * FROM courses WHERE id=$1', [id]);
  if (!c || (user.role === 'teacher' && c.teacher_id !== user.id)) notFound();
  const rows = await query(
    'SELECT * FROM v_course_results WHERE course_id=$1 ORDER BY assignment_id,student_name',
    [id],
  );
  const students = await query(
    'SELECT student_name,count(*) assignments_count,round(avg(percent),2) avg_percent FROM v_course_results WHERE course_id=$1 GROUP BY student_id,student_name ORDER BY avg_percent DESC',
    [id],
  );
  return (
    <>
      <Link className="back-link" href="/reports">
        <Icon name="back" size={14} />К аналитике
      </Link>
      <PageHeader
        eyebrow={c.code}
        title={c.title}
        description="Текущие результаты и подробная ведомость курса."
      />
      <Card>
        <h2>Результаты студентов</h2>
        <Table
          rows={students}
          columns={{
            student_name: 'Студент',
            assignments_count: 'Оценено заданий',
            avg_percent: 'Средний результат, %',
          }}
        />
      </Card>
      <Card>
        <h2>Подробная ведомость</h2>
        <Table
          rows={rows}
          columns={{
            assignment_title: 'Задание',
            student_name: 'Студент',
            version_no: 'Версия',
            score: 'Балл',
            max_score: 'Максимум',
            percent: 'Результат, %',
            is_late: 'Срок',
            graded_at: 'Оценено',
          }}
        />
      </Card>
    </>
  );
}
