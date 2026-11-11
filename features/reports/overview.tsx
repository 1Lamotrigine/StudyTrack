import Link from 'next/link';
import { query } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card, Table } from '@/app/components';
import { PageHeader, Progress, Metric, EmptyState } from '@/components/ui';
export async function Reports({ user }: PageContext) {
  const rows = await query(
    `SELECT s.*,round(students_submitted::numeric/nullif(enrolled_students,0)*100,1) submitted_pct,
 round(late_versions::numeric/nullif(versions_count,0)*100,1) late_pct FROM v_assignment_status s JOIN courses c ON c.id=s.course_id WHERE ($1='admin' OR c.teacher_id=$2) ORDER BY late_pct DESC NULLS LAST`,
    [user.role, user.id],
  );
  const courses = await query(
    `WITH students AS(SELECT course_id,course_title,student_id,avg(percent) p FROM v_course_results WHERE ($1='admin' OR teacher_id=$2) GROUP BY course_id,course_title,student_id)
 SELECT course_id,course_title,count(*) students_with_results,round(avg(p),2) avg_percent,round(min(p),2) min_percent,round(max(p),2) max_percent FROM students GROUP BY course_id,course_title ORDER BY avg_percent DESC`,
    [user.role, user.id],
  );
  return (
    <>
      <PageHeader
        eyebrow="От данных к пониманию"
        title="Аналитика обучения"
        description={
          user.role === 'teacher'
            ? 'Результаты ваших курсов и задания, которым нужно внимание.'
            : 'Общая картина обучения и результаты по курсам.'
        }
      />
      <div className="stats">
        <Metric
          label="Курсы с результатами"
          value={courses.length}
          hint="Есть оценённые работы"
          icon="book"
        />
        <Metric
          label="Сданные версии"
          value={rows.reduce((n, r) => n + Number(r.versions_count), 0)}
          hint="Включая повторные сдачи"
          icon="file"
          tone="blue"
        />
        <Metric
          label="Не проверено"
          value={rows.reduce((n, r) => n + Number(r.ungraded_versions), 0)}
          hint="Ожидают обратной связи"
          icon="clock"
          tone="orange"
        />
        <Metric
          label="Опоздания"
          value={rows.reduce((n, r) => n + Number(r.late_versions), 0)}
          hint="Версии после срока"
          icon="calendar"
          tone="green"
        />
      </div>
      <div className="dashboard-grid">
        <Card>
          <h2>Результаты по курсам</h2>
          {courses.length ? (
            <div className="report-bars">
              {courses.map((c) => (
                <div key={c.course_id} className="report-bar">
                  <Link href={`/reports/course/${c.course_id}`}>{c.course_title} →</Link>
                  <Progress
                    label={`${c.students_with_results} студентов с оценками`}
                    value={Number(c.avg_percent)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Пока недостаточно данных"
              description="Результаты появятся после проверки первых работ."
            />
          )}
        </Card>
        <Card>
          <h2>Как читать отчёт</h2>
          <p className="field-help">
            Результат курса — среднее по студентам. У каждого студента учитывается последняя
            оценённая версия каждого задания.
          </p>
          <p className="field-help">
            Процент сдачи рассчитывается среди активных зачислений. Неоценённая пересдача не стирает
            уже полученный результат.
          </p>
        </Card>
      </div>
      <Card>
        <h2>Сдаваемость заданий</h2>
        <Table
          rows={rows}
          columns={{
            assignment_title: 'Задание',
            course_title: 'Курс',
            enrolled_students: 'Студенты',
            students_submitted: 'Сдали',
            submitted_pct: 'Сдали, %',
            late_pct: 'Опоздания, %',
            ungraded_versions: 'На проверке',
            avg_score: 'Средний балл',
          }}
          link={(r) => `/reports/course/${r.course_id}`}
        />
      </Card>
    </>
  );
}
