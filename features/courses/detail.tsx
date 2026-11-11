import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card, Table } from '@/app/components';
import { Badge, EmptyState, Notice, PageHeader, Progress } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDateTime, plural } from '@/lib/format';
export async function CourseDetail({ user, segments, sp }: PageContext) {
  const id = Number(segments[1]);
  const course = await one(
    'SELECT c.*,u.full_name teacher_name,cc.title category FROM courses c JOIN users u ON u.id=c.teacher_id JOIN course_categories cc ON cc.id=c.category_id WHERE c.id=$1',
    [id],
  );
  if (
    !course ||
    (course.status === 'draft' && user.role !== 'admin' && course.teacher_id !== user.id)
  )
    notFound();
  const own = user.role === 'admin' || (user.role === 'teacher' && user.id === course.teacher_id);
  const enrolled =
    user.role === 'student'
      ? await one(
          "SELECT id FROM enrollments WHERE course_id=$1 AND student_id=$2 AND status='active'",
          [id, user.id],
        )
      : null;
  const assignments = await query(
    `SELECT a.*,lv.version_no,lv.score FROM assignments a LEFT JOIN LATERAL(SELECT sv.version_no,g.score FROM submission_versions sv LEFT JOIN grades g ON g.version_id=sv.id WHERE sv.assignment_id=a.id AND sv.student_id=$2 ORDER BY sv.version_no DESC LIMIT 1) lv ON true WHERE a.course_id=$1 ORDER BY a.due_at,a.id`,
    [id, user.id],
  );
  const versions =
    own || enrolled
      ? await query(
          `SELECT sv.id,a.title assignment_title,a.max_score,u.full_name student_name,sv.version_no,sv.submitted_at,sv.is_late,g.score,g.comment FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id JOIN users u ON u.id=sv.student_id LEFT JOIN grades g ON g.version_id=sv.id WHERE a.course_id=$1 ${user.role === 'student' ? 'AND sv.student_id=$2' : ''} ORDER BY sv.submitted_at DESC`,
          user.role === 'student' ? [id, user.id] : [id],
        )
      : [];
  const tab = sp.tab === 'results' ? 'results' : 'assignments';
  const completed = assignments.filter((a) => a.version_no).length;
  return (
    <>
      <Link className="back-link" href="/courses">
        <Icon name="back" size={14} />К курсам
      </Link>
      <PageHeader
        eyebrow={`${course.code} · ${course.category}`}
        title={course.title}
        description={course.description}
        action={<Badge status={course.status} />}
      />
      {course.status === 'archived' && (
        <Notice>
          Курс завершён. Работы и оценки доступны для просмотра, новые отправки закрыты.
        </Notice>
      )}
      {user.role === 'student' && !enrolled && (
        <Notice kind="warn">
          Вы не зачислены на этот курс. Для доступа к сдаче заданий обратитесь к администратору.
        </Notice>
      )}
      <div className="detail-grid">
        <div>
          <div className="tabs">
            <Link className={tab === 'assignments' ? 'active' : ''} href={`/courses/${id}`}>
              Задания <span className="badge">{assignments.length}</span>
            </Link>
            {(own || enrolled) && (
              <Link
                className={tab === 'results' ? 'active' : ''}
                href={`/courses/${id}?tab=results`}
              >
                {user.role === 'student' ? 'Мои результаты' : 'Работы студентов'}
              </Link>
            )}
          </div>
          {tab === 'results' && (own || enrolled) ? (
            <Table
              rows={versions}
              columns={{
                assignment_title: 'Задание',
                ...(user.role !== 'student' ? { student_name: 'Студент' } : {}),
                version_no: 'Версия',
                submitted_at: 'Отправлено',
                score: 'Оценка',
                max_score: 'Из',
                comment: 'Обратная связь',
              }}
              link={user.role === 'teacher' && own ? (r) => `/versions/${r.id}/grade` : undefined}
            />
          ) : assignments.length ? (
            assignments.map((a, i) => (
              <article className="assignment-card" key={a.id}>
                <span className="task-number">{String(i + 1).padStart(2, '0')}</span>
                <div className="assignment-content">
                  <div className="split-head">
                    <h3>{a.title}</h3>
                    {user.role === 'student' && enrolled && (
                      <Badge
                        status={
                          a.score != null
                            ? 'graded'
                            : a.version_no
                              ? 'pending'
                              : new Date(a.due_at) < new Date()
                                ? 'late'
                                : 'neutral'
                        }
                      >
                        {a.score != null
                          ? `${a.score} / ${a.max_score}`
                          : a.version_no
                            ? 'На проверке'
                            : new Date(a.due_at) < new Date()
                              ? 'Срок прошёл'
                              : 'К сдаче'}
                      </Badge>
                    )}
                  </div>
                  <p className="description">{a.description}</p>
                  <p>
                    {formatDateTime(a.due_at)} · {a.max_score} баллов · {a.expected_minutes || '—'}{' '}
                    мин.
                  </p>
                  {user.role === 'student' && enrolled && (
                    <Link
                      className="btn secondary small"
                      style={{ marginTop: 14 }}
                      href={`/assignments/${a.id}/submit`}
                    >
                      {a.version_no || course.status !== 'active' ? 'Открыть работу' : 'Выполнить'}
                      <Icon name="arrow" size={13} />
                    </Link>
                  )}
                </div>
              </article>
            ))
          ) : (
            <Card>
              <EmptyState
                title="Программа готовится"
                description="Преподаватель скоро добавит задания."
              />
            </Card>
          )}
        </div>
        <aside>
          <Card>
            <h2>О курсе</h2>
            <dl className="details-list">
              <div>
                <dt>Преподаватель</dt>
                <dd>{course.teacher_name}</dd>
              </div>
              <div>
                <dt>Задания</dt>
                <dd>{plural(assignments.length, ['задание', 'задания', 'заданий'])}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <Badge status={course.status} />
                </dd>
              </div>
            </dl>
          </Card>
          {user.role === 'student' && enrolled && (
            <Card>
              <h2>Ваш прогресс</h2>
              <Progress
                value={(completed / assignments.length) * 100}
                label={`${completed} из ${assignments.length} сдано`}
              />
            </Card>
          )}
          {user.role === 'admin' && (
            <Card>
              <h2>Управление</h2>
              <Link className="btn secondary" href={`/admin/courses/${id}`}>
                Настройки курса
              </Link>
              <Link className="btn ghost" href={`/admin/courses/${id}/enrollments`}>
                Участники
                <Icon name="arrow" size={14} />
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
