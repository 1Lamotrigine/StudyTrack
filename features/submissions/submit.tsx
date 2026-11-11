import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, one } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card, Form } from '@/app/components';
import { DraftEditor } from '@/components/forms';
import { Badge, EmptyState, Notice, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDateTime } from '@/lib/format';
export async function Submit({ user, segments, path, sp }: PageContext) {
  if (user.role !== 'student') redirect('/');
  const a = await one(
    'SELECT a.*,c.title course_title,c.status course_status FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=$1',
    [Number(segments[1])],
  );
  if (!a || a.course_status === 'draft') notFound();
  const history = await query(
    'SELECT sv.*,g.score,g.comment,g.graded_at FROM submission_versions sv LEFT JOIN grades g ON g.version_id=sv.id WHERE sv.assignment_id=$1 AND sv.student_id=$2 ORDER BY version_no DESC',
    [a.id, user.id],
  );
  const enrolled = await one(
    "SELECT id FROM enrollments WHERE course_id=$1 AND student_id=$2 AND status='active'",
    [a.course_id, user.id],
  );
  const canSubmit =
    enrolled &&
    a.course_status === 'active' &&
    (a.extra.allow_revision !== false || !history.length);
  const late = new Date(a.due_at) < new Date();
  return (
    <>
      <Link href={`/courses/${a.course_id}`} className="back-link">
        <Icon name="back" size={14} />
        {a.course_title}
      </Link>
      <PageHeader
        eyebrow={`Задание · ${a.max_score} баллов`}
        title={a.title}
        description="Отправьте решение и получите обратную связь от преподавателя."
      />
      {sp.success && (
        <Notice kind="ok">Работа отправлена. Новая версия появилась в истории сдачи.</Notice>
      )}
      <div className="detail-grid">
        <div>
          <Card>
            <h2>Что нужно сделать</h2>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: 13,
                lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
              }}
            >
              {a.description || 'Описание пока не добавлено.'}
            </p>
          </Card>
          {canSubmit ? (
            <Card>
              <h2>{history.length ? 'Новая версия работы' : 'Ваше решение'}</h2>
              {late && (
                <Notice kind="warn">
                  Срок уже прошёл. Работу можно отправить, она будет отмечена как сданная с
                  опозданием.
                </Notice>
              )}
              <Form op="submit" back={path} id={a.id}>
                <DraftEditor
                  key={history.length}
                  assignmentId={a.id}
                  userId={user.id}
                  versionCount={history.length}
                />
              </Form>
            </Card>
          ) : (
            <Notice kind="warn">
              {!enrolled
                ? 'Вы не зачислены на курс. Обратитесь к администратору.'
                : a.course_status !== 'active'
                  ? 'Курс в архиве. Приём новых работ закрыт.'
                  : 'Работа отправлена. Для этого задания предусмотрена одна попытка.'}
            </Notice>
          )}
          <h2>История сдачи</h2>
          {history.length ? (
            history.map((v, i) => (
              <Card key={v.id}>
                <div className="split-head">
                  <h3>
                    Версия {v.version_no}
                    {i === 0 && (
                      <span className="badge" style={{ marginLeft: 10 }}>
                        Последняя
                      </span>
                    )}
                  </h3>
                  <Badge status={v.score != null ? 'graded' : 'pending'}>
                    {v.score != null ? `${v.score} / ${a.max_score} баллов` : 'На проверке'}
                  </Badge>
                </div>
                <p className="field-help" style={{ marginBottom: 15 }}>
                  {formatDateTime(v.submitted_at)} · {v.is_late ? 'с опозданием' : 'в срок'}
                </p>
                <details>
                  <summary style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>
                    Посмотреть отправленную работу
                  </summary>
                  <pre className="body" style={{ marginTop: 15 }}>
                    {v.body}
                  </pre>
                </details>
                {v.score != null && (
                  <div className="timeline-card">
                    <h3>Обратная связь</h3>
                    <p className="feedback">
                      {v.comment || 'Преподаватель выставил оценку без комментария.'}
                    </p>
                    <p className="field-help">{formatDateTime(v.graded_at)}</p>
                  </div>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                title="Первая версия впереди"
                description="После отправки здесь появится ваша работа, а затем оценка и комментарий."
              />
            </Card>
          )}
        </div>
        <aside>
          <Card>
            <h2>Детали задания</h2>
            <dl className="details-list">
              <div>
                <dt>Срок сдачи</dt>
                <dd>{formatDateTime(a.due_at)}</dd>
              </div>
              <div>
                <dt>Максимум</dt>
                <dd>{a.max_score} баллов</dd>
              </div>
              <div>
                <dt>Формат</dt>
                <dd>{a.extra.submission_format || 'Свободный'}</dd>
              </div>
              <div>
                <dt>На выполнение</dt>
                <dd>{a.expected_minutes || '—'} мин.</dd>
              </div>
              <div>
                <dt>Повторная сдача</dt>
                <dd>{a.extra.allow_revision === false ? 'Одна попытка' : 'Разрешена'}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h3>Перед отправкой</h3>
            <p className="field-help">
              Проверьте, что решение отвечает условиям задания. Укажите ссылку, если результат
              размещён отдельно.
            </p>
            <p className="field-help">Отправленные версии сохраняются и не заменяют предыдущие.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
