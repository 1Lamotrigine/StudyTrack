import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, one } from '@/lib/db';

import { Card, Field, Form, Select, Table, statuses } from '@/app/components';
import type { AdminContext } from './types';
export async function Users({ segments: s, sp, path, user }: AdminContext) {
  const id = s[1] && s[1] !== 'create' && s[1] !== '0' ? Number(s[1]) : null;
  let body;
  if (s.length === 1) {
    const rows = await query(
      "SELECT id,full_name,email,login,role,is_active FROM users WHERE (full_name ILIKE $1 OR login ILIKE $1 OR email ILIKE $1) AND ($2='' OR role=$2) ORDER BY id",
      ['%' + (sp.q || '') + '%', sp.role || ''],
    );
    body = (
      <>
        <div className="section-actions">
          <Link className="btn" href="/admin/users/create">
            Добавить пользователя
          </Link>
        </div>
        <form className="filter-bar">
          <Field name="q" label="Поиск" value={sp.q} required={false} />
          <Select
            name="role"
            label="Роль"
            value={sp.role}
            options={[{ id: '', title: 'Все' }, ...statuses(['student', 'teacher', 'admin'])]}
          />
          <button>Найти</button>
        </form>
        <Table
          rows={rows}
          columns={{
            full_name: 'ФИО',
            email: 'Email',
            login: 'Логин',
            role: 'Роль',
            is_active: 'Активен',
          }}
          link={(r) => `/admin/users/${r.id}`}
        />
      </>
    );
  } else {
    const u = id
      ? await one('SELECT id,full_name,email,login,role,is_active FROM users WHERE id=$1', [id])
      : null;
    if (id && !u) notFound();
    body = (
      <>
        <Card>
          <h2>{id ? u?.full_name : 'Новый пользователь'}</h2>
          <Form op={id ? 'update_user' : 'create_user'} id={id ?? undefined} back={path}>
            <Field name="full_name" label="ФИО" value={u?.full_name} />
            <Field name="email" label="Email" type="email" value={u?.email} />
            {!id && (
              <>
                <Field name="login" label="Логин" />
                <Field name="password" label="Пароль (от 8 символов)" type="password" />
                <Select
                  name="role"
                  label="Роль"
                  options={statuses(['student', 'teacher', 'admin'])}
                />
              </>
            )}
          </Form>
        </Card>
        {id && (
          <>
            <Card>
              <h2>Роль и доступ</h2>
              <Form op="set_role" id={id} back={path}>
                <Select
                  name="role"
                  label="Роль"
                  value={u?.role}
                  options={statuses(['student', 'teacher', 'admin'])}
                />
              </Form>
              <p>Активен: {u?.is_active ? 'Да' : 'Нет'}</p>
              {id !== user.id && <Form op="toggle_user" id={id} back={path} />}
            </Card>
            <Card>
              <h2>Сброс пароля</h2>
              <Form op="reset_password" id={id} back={path}>
                <Field name="password" label="Новый пароль (от 8 символов)" type="password" />
              </Form>
            </Card>
          </>
        )}
      </>
    );
  }

  return body;
}
