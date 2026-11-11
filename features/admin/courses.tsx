import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';
import { Notice } from '@/components/ui';

import { Card, Field, Form, Select, Table, statuses } from '@/app/components';
import type { AdminContext } from './types';
export async function Courses({ segments: s, path }: AdminContext) {
  const id = s[1] && s[1] !== 'create' && s[1] !== '0' ? Number(s[1]) : null;
  let body;
  if (s.length === 1) {
    const rows = await query(
      'SELECT c.*,u.full_name teacher FROM courses c JOIN users u ON u.id=c.teacher_id ORDER BY c.id',
    );
    body = (
      <>
        <div className="section-actions">
          <Link className="btn" href="/admin/courses/create">
            Добавить курс
          </Link>
        </div>
        <Table
          rows={rows}
          columns={{ code: 'Код', title: 'Курс', teacher: 'Преподаватель', status: 'Статус' }}
          link={(r) => `/admin/courses/${r.id}`}
        />
      </>
    );
  } else {
    const c = id ? await one('SELECT * FROM courses WHERE id=$1', [id]) : null;
    if (id && !c) notFound();
    if (s[2] === 'enrollments') {
      const students = await query(
        "SELECT id,full_name FROM users WHERE role='student' AND is_active ORDER BY full_name",
      );
      const rows = await query(
        'SELECT e.*,u.full_name FROM enrollments e JOIN users u ON u.id=e.student_id WHERE course_id=$1 ORDER BY u.full_name',
        [id],
      );
      body = (
        <>
          <h2>{c?.title}: зачисления</h2>
          {c?.status !== 'active' && (
            <Notice kind="warn">Зачисление доступно только в активный курс.</Notice>
          )}
          <Form op="enroll" back={path} disabled={c?.status !== 'active'}>
            <input type="hidden" name="course_id" value={id!} />
            <Select
              name="student_id"
              label="Студент"
              options={students.filter(
                (u) => !rows.some((r) => r.student_id === u.id && r.status === 'active'),
              )}
            />
          </Form>
          {rows.map((r) => (
            <Card key={r.id}>
              <p>
                {r.full_name} · {r.status}
              </p>
              {r.status === 'active' && (
                <Form op="drop" back={path}>
                  <input type="hidden" name="course_id" value={id!} />
                  <input type="hidden" name="student_id" value={r.student_id} />
                </Form>
              )}
            </Card>
          ))}
        </>
      );
    } else {
      const teachers = await query(
        "SELECT id,full_name FROM users WHERE role='teacher' AND is_active ORDER BY full_name",
      );
      const categories = await query('SELECT id,title FROM course_categories ORDER BY title');
      body = (
        <>
          <Card>
            <Form op="course" id={id ?? undefined} back={path}>
              <Field name="code" label="Код курса" value={c?.code} />
              <Field name="title" label="Название" value={c?.title} />
              <Field
                name="description"
                label="Описание"
                value={c?.description}
                type="textarea"
                required={false}
              />
              <Select
                name="teacher_id"
                label="Преподаватель"
                value={c?.teacher_id}
                options={teachers}
              />
              <Select
                name="category_id"
                label="Категория"
                value={c?.category_id}
                options={categories}
              />
              <Select
                name="status"
                label="Статус"
                value={c?.status || 'draft'}
                options={statuses(['draft', 'active', 'archived'])}
              />
            </Form>
          </Card>
          {id && (
            <Card>
              <Link href={`/admin/courses/${id}/enrollments`}>Управление зачислениями →</Link>
              <Form op="archive" id={id} back={path} />
            </Card>
          )}
        </>
      );
    }
  }

  return body;
}
