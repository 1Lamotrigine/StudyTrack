import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { PageContext } from '@/lib/types';
import { getStudentTasks, getReviewQueue } from '@/features/courses/queries';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDate, formatDateTime } from '@/lib/format';
export async function Tasks({ user, sp }: PageContext) {
  if (user.role !== 'student') redirect('/');
  const tasks = await getStudentTasks(user);
  const filter = ['all', 'todo', 'pending', 'graded'].includes(sp.status || '')
    ? sp.status!
    : 'todo';
  const visible = tasks.filter(
    (t) =>
      filter === 'all' ||
      (filter === 'todo' ? ['todo', 'late'].includes(t.task_status) : t.task_status === filter),
  );
  return (
    <>
      <PageHeader
        eyebrow="Шаг за шагом"
        title="Мои задания"
        description="Сроки, работы и результаты — ничего не потеряется."
      />
      <div className="tabs">
        {[
          ['todo', 'К сдаче'],
          ['pending', 'На проверке'],
          ['graded', 'Оценены'],
          ['all', 'Все задания'],
        ].map(([v, l]) => (
          <Link key={v} className={filter === v ? 'active' : ''} href={`/tasks?status=${v}`}>
            {l}
            <span className="badge" style={{ marginLeft: 7 }}>
              {
                tasks.filter(
                  (t) =>
                    v === 'all' ||
                    (v === 'todo' ? ['todo', 'late'].includes(t.task_status) : t.task_status === v),
                ).length
              }
            </span>
          </Link>
        ))}
      </div>
      {visible.length ? (
        visible.map((t) => (
          <article className="assignment-card" key={t.id}>
            <span className="course-symbol">
              <Icon name="file" />
            </span>
            <div className="assignment-content">
              <div className="split-head">
                <h3>{t.title}</h3>
                <Badge status={t.task_status}>
                  {
                    (
                      {
                        todo: 'К сдаче',
                        late: 'Срок прошёл',
                        pending: 'На проверке',
                        graded: `${t.score} / ${t.max_score}`,
                      } as Record<string, string>
                    )[t.task_status]
                  }
                </Badge>
              </div>
              <p>
                {t.course_title} · до {formatDateTime(t.due_at)} · {t.expected_minutes || '—'} мин.
              </p>
            </div>
            <Link className="btn secondary small" href={`/assignments/${t.id}/submit`}>
              {t.version_no ? 'Открыть работу' : 'Выполнить'}
              <Icon name="arrow" size={14} />
            </Link>
          </article>
        ))
      ) : (
        <div className="card">
          <EmptyState
            icon="check"
            title={filter === 'todo' ? 'Все доступные задания сданы' : 'Здесь пока нет работ'}
            description={
              filter === 'todo'
                ? 'Посмотрите результаты и обратную связь преподавателей.'
                : 'Работы появятся в этом разделе после отправки и проверки.'
            }
            href={filter === 'todo' ? '/tasks?status=graded' : '/tasks?status=all'}
            label={filter === 'todo' ? 'Мои результаты' : 'Все задания'}
          />
        </div>
      )}
    </>
  );
}
export async function Review({ user, sp }: PageContext) {
  if (user.role !== 'teacher') redirect('/');
  const rows = await getReviewQueue(user);
  const selected = sp.course || '';
  const visible = rows.filter((r) => !selected || String(r.course_id) === selected);
  const courses = Array.from(new Map(rows.map((r) => [r.course_id, r.course_title])).entries());
  return (
    <>
      <PageHeader
        eyebrow="Обратная связь имеет значение"
        title="Проверка работ"
        description="Сначала самые ранние отправки. Старые версии отмечены отдельно."
      />
      <form className="filter-bar">
        <label>
          Курс
          <select name="course" defaultValue={selected}>
            <option value="">Все мои курсы</option>
            {courses.map(([id, title]) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <button>Показать</button>
      </form>
      <p className="filter-count">Ожидают проверки: {visible.length}</p>
      {visible.length ? (
        visible.map((t) => (
          <article className="assignment-card" key={t.id}>
            <span className="course-symbol">
              <Icon name="file" />
            </span>
            <div className="assignment-content">
              <div className="split-head">
                <h3>{t.title}</h3>
                <Badge status={t.is_latest ? 'pending' : 'archived'}>
                  {t.is_latest ? `Версия ${t.version_no}` : 'Есть более новая версия'}
                </Badge>
              </div>
              <p>
                {t.student_name} · {t.course_code} · {formatDate(t.submitted_at, true)}
                {t.is_late ? ' · с опозданием' : ''}
              </p>
            </div>
            <Link href={`/versions/${t.id}/grade`} className="btn small">
              Проверить
              <Icon name="arrow" size={14} />
            </Link>
          </article>
        ))
      ) : (
        <div className="card">
          <EmptyState
            title="Всё проверено"
            description="Когда студенты отправят новые работы, они появятся здесь."
            icon="check"
          />
        </div>
      )}
    </>
  );
}
