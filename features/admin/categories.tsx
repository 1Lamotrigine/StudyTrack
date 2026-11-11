import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';

import { Card, Field, Form, Select, Table, statuses } from '@/app/components';
import type { AdminContext } from './types';
export async function Categories({ segments: s, path }: AdminContext) {
  const id = s[1] && s[1] !== 'create' && s[1] !== '0' ? Number(s[1]) : null;
  let body;
  const rows = await query(
    "WITH RECURSIVE t AS(SELECT *,title::text path FROM course_categories WHERE parent_id IS NULL UNION ALL SELECT c.*,t.path||' / '||c.title FROM course_categories c JOIN t ON t.id=c.parent_id) SELECT * FROM t ORDER BY path",
  );
  if (s.length === 1)
    body = (
      <>
        <div className="section-actions">
          <Link className="btn" href="/admin/categories/0">
            Добавить категорию
          </Link>
        </div>
        <Table
          rows={rows}
          columns={{ path: 'Категория', slug: 'Slug' }}
          link={(r) => `/admin/categories/${r.id}`}
        />
      </>
    );
  else {
    const c = id ? await one('SELECT * FROM course_categories WHERE id=$1', [id]) : null;
    if (id && !c) notFound();
    body = (
      <Card>
        <Form op="category" id={id ?? undefined} back={path}>
          <Field name="title" label="Название" value={c?.title} />
          <Field name="slug" label="Slug" value={c?.slug} />
          <Select
            name="parent_id"
            label="Родитель"
            value={c?.parent_id}
            options={[
              { id: '', title: 'Без родителя' },
              ...rows.filter((r) => r.id !== id).map((r) => ({ ...r, title: r.path })),
            ]}
          />
        </Form>
      </Card>
    );
  }
  return body;
}
