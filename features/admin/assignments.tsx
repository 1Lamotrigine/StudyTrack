import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';

import { localDateInput } from '@/lib/format';
import { Card, Field, Form, Select, Table, statuses } from '@/app/components';
import type { AdminContext } from './types';
export async function Assignments({ segments: s, path }: AdminContext) {
  const id = s[1] && s[1] !== 'create' && s[1] !== '0' ? Number(s[1]) : null;
  let body;
  if (s.length === 1) {
    const rows = await query(
      'SELECT a.*,c.title course FROM assignments a JOIN courses c ON c.id=a.course_id ORDER BY a.id',
    );
    body = (
      <>
        <div className="section-actions">
          <Link className="btn" href="/admin/assignments/create">
            Добавить задание
          </Link>
        </div>
        <Table
          rows={rows}
          columns={{ title: 'Задание', course: 'Курс', due_at: 'Срок', max_score: 'Максимум' }}
          link={(r) => `/admin/assignments/${r.id}`}
        />
      </>
    );
  } else {
    const a = id ? await one('SELECT * FROM assignments WHERE id=$1', [id]) : null;
    if (id && !a) notFound();
    const courses = await query('SELECT id,title FROM courses ORDER BY title');
    body = (
      <Card>
        <Form op="assignment" id={id ?? undefined} back={path}>
          <Select name="course_id" label="Курс" value={a?.course_id} options={courses} />
          <Field name="title" label="Название" value={a?.title} />
          <Field
            name="description"
            label="Описание"
            value={a?.description}
            type="textarea"
            required={false}
          />
          <Field
            name="due_at"
            label="Срок сдачи (Актобе, UTC+5)"
            type="datetime-local"
            value={a?.due_at ? localDateInput(a.due_at) : ''}
          />
          <Field
            name="max_score"
            label="Максимальный балл"
            type="number"
            value={a?.max_score || 100}
          />
          <Field
            name="submission_format"
            label="Формат работы"
            value={a?.extra.submission_format || 'pdf'}
          />
          <Field
            name="expected_minutes"
            label="Ожидаемое время в минутах (5–10080)"
            type="number"
            value={a?.extra.expected_minutes || 60}
          />
          <Select
            name="allow_revision"
            label="Разрешить повторную сдачу"
            value={String(a?.extra.allow_revision ?? true)}
            options={statuses(['true', 'false'])}
          />
        </Form>
      </Card>
    );
  }

  return body;
}
