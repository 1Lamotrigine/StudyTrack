import Link from 'next/link';
import { query, one } from '@/lib/db';
import { Card, Table } from '@/app/components';
import { Metric, Notice, PageHeader } from '@/components/ui';
import { Users } from './users';
import { Categories } from './categories';
import { Courses } from './courses';
import { Assignments } from './assignments';
import type { AdminContext } from './types';
export async function Admin(context: AdminContext) {
  const { segments, sp } = context;
  const section = segments[0] || '';
  let content;
  if (!section) {
    const counts = await one(
      'SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM courses) courses,(SELECT count(*) FROM assignments) assignments,(SELECT count(*) FROM enrollments) enrollments',
    );
    content = (
      <>
        <div className="stats">
          <Metric label="Пользователи" value={counts.users} hint="Учётные записи" icon="users" />
          <Metric
            label="Курсы"
            value={counts.courses}
            hint="Учебные программы"
            icon="book"
            tone="green"
          />
          <Metric
            label="Задания"
            value={counts.assignments}
            hint="Практика и проекты"
            icon="file"
            tone="orange"
          />
          <Metric
            label="Зачисления"
            value={counts.enrollments}
            hint="Учебные связи"
            icon="chart"
            tone="blue"
          />
        </div>
        <Card>
          <h2>С чего начать</h2>
          <p className="lead">
            Создайте пользователей и категории, затем курс с преподавателем. Переведите курс в
            активный статус, добавьте задания и зачислите студентов.
          </p>
        </Card>
      </>
    );
  } else if (section === 'users') content = await Users(context);
  else if (section === 'categories') content = await Categories(context);
  else if (section === 'courses') content = await Courses(context);
  else if (section === 'assignments') content = await Assignments(context);
  else if (section === 'audit') {
    const rows = await query(
      'SELECT l.*,u.full_name actor FROM admin_audit_log l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.id DESC LIMIT 500',
    );
    content = (
      <Card>
        <h2>Журнал изменений</h2>
        <p className="field-help" style={{ marginBottom: 20 }}>
          Последние 500 административных операций. Пароли в журнал не записываются.
        </p>
        <Table
          rows={rows}
          columns={{
            created_at: 'Дата',
            actor: 'Администратор',
            action: 'Действие',
            entity: 'Сущность',
            entity_id: 'ID',
            details: 'Подробности',
          }}
        />
      </Card>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Настройки пространства"
        title="Управление порталом"
        description="Пользователи, учебные программы и порядок в данных."
      />
      {sp.success && <Notice kind="ok">Изменения сохранены.</Notice>}
      <nav className="admin-nav" aria-label="Управление">
        {[
          ['', 'Обзор'],
          ['users', 'Пользователи'],
          ['categories', 'Категории'],
          ['courses', 'Курсы'],
          ['assignments', 'Задания'],
          ['audit', 'Аудит'],
        ].map(([p, t]) => (
          <Link key={p} href={'/admin/' + p} aria-current={section === p ? 'page' : undefined}>
            {t}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}
