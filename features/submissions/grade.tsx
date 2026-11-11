import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, one } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Card, Field, Form, Table } from '@/app/components';
import { Badge, Notice, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDateTime } from '@/lib/format';
export async function Grade({ user, segments, path, sp }: PageContext) {
  if (user.role !== 'teacher') redirect('/');
  const v = await one(
    `SELECT sv.*,a.title,a.max_score,c.teacher_id,c.title course_title,c.id course_id,u.full_name student_name,g.score,g.comment,
 (SELECT id FROM submission_versions WHERE assignment_id=sv.assignment_id AND student_id=sv.student_id ORDER BY version_no DESC LIMIT 1) latest_id FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=sv.student_id LEFT JOIN grades g ON g.version_id=sv.id WHERE sv.id=$1`,
    [Number(segments[1])],
  );
  if (!v) notFound();
  if (v.teacher_id !== user.id) redirect('/review');
  const history = await query(
    'SELECT h.*,u.full_name grader FROM grade_history h LEFT JOIN users u ON u.id=h.changed_by WHERE version_id=$1 ORDER BY h.changed_at DESC',
    [v.id],
  );
  return (
    <>
      <Link className="back-link" href="/review">
        <Icon name="back" size={14} />К очереди проверки
      </Link>
      <PageHeader
        eyebrow={v.course_title}
        title={v.title}
        description={`${v.student_name} · версия ${v.version_no} · ${formatDateTime(v.submitted_at)}`}
      />
      {sp.success && (
        <Notice kind="ok">Оценка сохранена. Студент увидит её вместе с вашим комментарием.</Notice>
      )}
      {v.latest_id !== v.id && (
        <Notice kind="warn">
          У студента есть более новая версия этой работы.{' '}
          <Link href={`/versions/${v.latest_id}/grade`}>Перейти к последней →</Link>
        </Notice>
      )}
      <div className="detail-grid">
        <div>
          <Card>
            <div className="card-head">
              <h2>Работа студента</h2>
              <Badge status={v.is_late ? 'late' : 'active'}>
                {v.is_late ? 'С опозданием' : 'Сдано в срок'}
              </Badge>
            </div>
            <pre className="body">{v.body}</pre>
          </Card>
          <Card>
            <h2>История оценок</h2>
            <Table
              rows={history}
              columns={{
                grader: 'Преподаватель',
                old_score: 'Было',
                new_score: 'Стало',
                changed_at: 'Дата',
                comment: 'Комментарий',
              }}
            />
          </Card>
        </div>
        <aside>
          <Card>
            <h2>{v.score != null ? 'Изменить оценку' : 'Оценить работу'}</h2>
            <Form op="grade" id={v.id} back={path}>
              <Field
                name="score"
                label={`Балл из ${v.max_score}`}
                type="number"
                value={v.score ?? ''}
                min={0}
                max={Number(v.max_score)}
              />
              <Field
                name="comment"
                label="Обратная связь"
                type="textarea"
                value={v.comment || ''}
                required={false}
                hint="Что получилось хорошо и что можно улучшить?"
              />
            </Form>
            <Link href="/review" className="btn ghost" style={{ marginTop: 12 }}>
              Следующая работа
              <Icon name="arrow" size={14} />
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
