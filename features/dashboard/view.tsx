import Link from 'next/link';
import { query, one } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card } from '@/app/components';
import { Badge, EmptyState, Metric, PageHeader, Progress, Notice } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDate, formatDateTime, plural } from '@/lib/format';
import { getCourses, getReviewQueue, getStudentTasks } from '@/features/courses/queries';
import { CourseCards } from '@/features/courses/cards';
export async function Dashboard({ user, sp }: PageContext) {
  const courses = await getCourses(user, { scope: 'mine' });
  const student = user.role === 'student';
  const teacher = user.role === 'teacher';
  const tasks = student ? await getStudentTasks(user) : teacher ? await getReviewQueue(user) : [];
  const pending = tasks.filter((t) => (student ? ['todo', 'late'].includes(t.task_status) : true));
  const done = student ? tasks.filter((t) => t.version_no != null).length : 0;
  const waiting = student ? tasks.filter((t) => t.task_status === 'pending').length : tasks.length;
  const average = student
    ? await one('SELECT round(avg(percent)) value FROM v_course_results WHERE student_id=$1', [
        user.id,
      ])
    : null;
  const adminStats =
    !student && !teacher
      ? await one(
          'SELECT (SELECT count(*) FROM users WHERE is_active) users,(SELECT count(*) FROM assignments) assignments,(SELECT count(*) FROM submission_versions sv LEFT JOIN grades g ON g.version_id=sv.id WHERE g.id IS NULL) ungraded',
        )
      : null;
  const activity = student
    ? await query(
        'SELECT a.title,g.score,a.max_score,g.graded_at happened_at,g.comment FROM grades g JOIN submission_versions sv ON sv.id=g.version_id JOIN assignments a ON a.id=sv.assignment_id WHERE sv.student_id=$1 ORDER BY g.graded_at DESC LIMIT 5',
        [user.id],
      )
    : teacher
      ? await query(
          'SELECT a.title,g.score,a.max_score,g.graded_at happened_at,u.full_name comment FROM grades g JOIN submission_versions sv ON sv.id=g.version_id JOIN assignments a ON a.id=sv.assignment_id JOIN users u ON u.id=sv.student_id WHERE g.graded_by=$1 ORDER BY g.graded_at DESC LIMIT 5',
          [user.id],
        )
      : await query(
          'SELECT action title,created_at happened_at,entity comment FROM admin_audit_log ORDER BY id DESC LIMIT 5',
        );
  const name =
    user.role === 'admin' ? 'администратор' : user.full_name.split(' ')[1] || user.full_name;
  return (
    <>
      {sp.error && <Notice kind="warn">{sp.error}</Notice>}
      <PageHeader
        title={`С возвращением, ${name}`}
        description={
          student
            ? 'Всё, что нужно для следующего шага в учёбе.'
            : teacher
              ? 'Работы студентов, обратная связь и ваши курсы.'
              : 'Порядок в курсах, пользователях и учебных процессах.'
        }
        action={<span className="date-note">{formatDate(new Date())}</span>}
      />
      <section className="hero">
        <div>
          <div className="eyebrow">
            {student
              ? 'Ваш учебный ритм'
              : teacher
                ? 'Время для обратной связи'
                : 'Всё под контролем'}
          </div>
          <h2>
            {student
              ? pending.length
                ? 'Каждая работа приближает к цели.'
                : 'Отличный темп. Продолжайте!'
              : teacher
                ? waiting
                  ? 'Ваших комментариев уже ждут.'
                  : 'Всё проверено. Можно выдохнуть.'
                : 'Хорошая организация — начало результата.'}
          </h2>
          <p>
            {student
              ? pending.length
                ? `${plural(pending.length, ['задание осталось', 'задания осталось', 'заданий осталось'])} сдать. Начните с самого важного — мы поможем не потерять фокус.`
                : 'Вы сдали все доступные задания. Следите за обратной связью преподавателей.'
              : teacher
                ? waiting
                  ? `${plural(waiting, ['работа ожидает', 'работы ожидают', 'работ ожидают'])} проверки. Оставьте обратную связь, которая поможет двигаться дальше.`
                  : 'Все работы получили обратную связь. Новые отправки появятся в очереди проверки.'
                : 'Настраивайте курсы и задания, управляйте доступом и следите за изменениями.'}
          </p>
          <Link className="btn" href={student ? '/tasks' : teacher ? '/review' : '/admin'}>
            {student ? 'Перейти к заданиям' : teacher ? 'Открыть очередь' : 'Управлять порталом'}
            <Icon name="arrow" size={15} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit" />
          <div className="hero-book">
            <Icon name="book" size={36} />
          </div>
          <span className="hero-star">
            <Icon name="spark" size={22} />
          </span>
          <span className="hero-dot" />
        </div>
      </section>
      <div className="stats">
        <Metric label="Мои курсы" value={courses.length} hint="Активное обучение" icon="book" />
        {student ? (
          <>
            <Metric
              label="Работы сданы"
              value={`${done}/${tasks.length}`}
              hint="По активным курсам"
              icon="check"
              tone="green"
            />
            <Metric
              label="Ждут проверки"
              value={waiting}
              hint="Обратная связь скоро появится"
              icon="clock"
              tone="orange"
            />
            <Metric
              label="Средний результат"
              value={average?.value != null ? `${average.value}%` : '—'}
              hint="По оценённым заданиям"
              icon="chart"
              tone="blue"
            />
          </>
        ) : teacher ? (
          <>
            <Metric
              label="Ждут проверки"
              value={waiting}
              hint="Все неоценённые версии"
              icon="clock"
              tone="orange"
            />
            <Metric
              label="Студенты"
              value={courses.reduce((s, c) => s + Number(c.students_count), 0)}
              hint="Активные зачисления"
              icon="users"
              tone="green"
            />
            <Metric
              label="Задания"
              value={courses.reduce((s, c) => s + Number(c.assignments_count), 0)}
              hint="В ваших активных курсах"
              icon="file"
              tone="blue"
            />
          </>
        ) : (
          <>
            <Metric
              label="Пользователи"
              value={adminStats?.users}
              hint="С активным доступом"
              icon="users"
              tone="green"
            />
            <Metric
              label="Задания"
              value={adminStats?.assignments}
              hint="Во всех курсах"
              icon="file"
              tone="blue"
            />
            <Metric
              label="Не проверено"
              value={adminStats?.ungraded}
              hint="Версии без оценки"
              icon="clock"
              tone="orange"
            />
          </>
        )}
      </div>
      <div className="section-head">
        <h2>Мои курсы</h2>
        <Link href="/courses?scope=mine">
          Все курсы
          <Icon name="arrow" size={14} />
        </Link>
      </div>
      {courses.length ? (
        <CourseCards courses={courses.slice(0, 3)} role={user.role} />
      ) : (
        <Card>
          <EmptyState
            title="Пока нет активных курсов"
            description="Курсы появятся после зачисления или назначения преподавателя."
            href="/courses"
          />
        </Card>
      )}
      <div className="section-head">
        <h2>{student ? 'Держим фокус' : teacher ? 'На проверку' : 'Последние события'}</h2>
        {user.role !== 'admin' && (
          <Link href={student ? '/tasks' : '/review'}>
            Смотреть все
            <Icon name="arrow" size={14} />
          </Link>
        )}
      </div>
      <div className="dashboard-grid">
        <Card>
          {user.role === 'admin' ? (
            <>
              <h2>Быстрые действия</h2>
              <div className="task-list">
                {[
                  [
                    '/admin/users/create',
                    'users',
                    'Добавить пользователя',
                    'Настроить роль и доступ',
                  ],
                  [
                    '/admin/courses/create',
                    'book',
                    'Создать курс',
                    'Объединить задания и студентов',
                  ],
                  [
                    '/admin/assignments/create',
                    'file',
                    'Добавить задание',
                    'Задать срок и критерии оценки',
                  ],
                ].map(([href, icon, title, hint]) => (
                  <Link className="task-row" href={href} key={href}>
                    <span className="task-number">
                      <Icon name={icon} size={16} />
                    </span>
                    <div>
                      <span className="task-title">{title}</span>
                      <p className="task-context">{hint}</p>
                    </div>
                    <Icon name="arrow" size={16} style={{ marginLeft: 'auto' }} />
                  </Link>
                ))}
              </div>
            </>
          ) : pending.length ? (
            <div className="task-list">
              {pending.slice(0, 5).map((t, i) => (
                <div className="task-row" key={t.id}>
                  <span className="task-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <Link
                      className="task-title"
                      href={student ? `/assignments/${t.id}/submit` : `/versions/${t.id}/grade`}
                    >
                      {t.title}
                    </Link>
                    <p className="task-context">
                      {student ? t.course_code : t.student_name} ·{' '}
                      {formatDate(student ? t.due_at : t.submitted_at, true)}
                    </p>
                  </div>
                  <Badge status={student ? t.task_status : 'pending'}>
                    {student
                      ? t.task_status === 'late'
                        ? 'Срок прошёл'
                        : 'К сдаче'
                      : t.is_latest
                        ? 'Новая версия'
                        : 'Ранняя версия'}
                  </Badge>
                  <Link
                    className="row-arrow"
                    href={student ? `/assignments/${t.id}/submit` : `/versions/${t.id}/grade`}
                    aria-label={`Открыть ${t.title}`}
                  >
                    <Icon name="chevron" size={15} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="check"
              title={student ? 'Все задания сданы' : 'Очередь пуста'}
              description={
                student
                  ? 'Можно уделить время обратной связи или посмотреть другие курсы.'
                  : 'Новые работы студентов появятся здесь.'
              }
            />
          )}
        </Card>
        <div className="dashboard-side">
          <Card>
            <h2>
              {student ? 'Обратная связь' : teacher ? 'Недавно проверено' : 'Журнал изменений'}
            </h2>
            {activity.length ? (
              <div>
                {activity.map((a, i) => (
                  <div key={i} className="activity-item">
                    {a.score != null && (
                      <span className="activity-score">
                        {a.score}/{a.max_score}
                      </span>
                    )}
                    <strong>{a.title}</strong>
                    <p>{a.comment || 'Без комментария'}</p>
                    <time>{formatDateTime(a.happened_at)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Всё ещё впереди" description="Здесь появятся последние события." />
            )}
          </Card>
          {student && (
            <Card>
              <h2>Ваш прогресс</h2>
              <Progress value={(done / tasks.length) * 100} label="Сданные задания" />
              <p className="field-help">
                Каждая отправленная работа учитывается один раз, независимо от числа версий.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
