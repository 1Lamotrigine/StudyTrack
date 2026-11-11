import { call } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import type { User } from '@/lib/types';
import { Input } from './input';
export async function adminMutation(user: User, op: string, input: Input) {
  if (user.role !== 'admin') throw new Error('Действие доступно только администратору');
  const id = () => input.id('id');
  const optionalId = () => input.id('id', true);
  const title = () => input.required('title', 'Название', 3, 250);
  const role = () => input.choice('role', ['student', 'teacher', 'admin']);
  const operations: Record<string, () => Promise<unknown>> = {
    create_user: () => {
      const login = input.required('login', 'Логин', 3, 32).toLowerCase();
      if (!/^[a-z0-9_.]+$/.test(login))
        throw new Error('Логин: латинские буквы, цифры, точка и подчёркивание');
      return call('admin_create_user', [
        user.id,
        input.required('full_name', 'ФИО', 2, 150),
        input.email(),
        role(),
        login,
        hashPassword(input.password()),
        null,
      ]);
    },
    update_user: () =>
      call('admin_update_user', [
        user.id,
        id(),
        input.required('full_name', 'ФИО', 2, 150),
        input.email(),
      ]),
    set_role: () => call('admin_set_role', [user.id, id(), role()]),
    toggle_user: () => call('admin_toggle_user', [user.id, id()]),
    reset_password: () =>
      call('admin_reset_password', [user.id, id(), hashPassword(input.password())]),
    category: () => {
      const slug = input.required('slug', 'Slug', 2, 80).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug: латинские буквы, цифры и дефис');
      return call('admin_upsert_category', [
        user.id,
        optionalId(),
        title(),
        slug,
        input.id('parent_id', true),
        null,
      ]);
    },
    course: () =>
      call('admin_upsert_course', [
        user.id,
        optionalId(),
        input.id('category_id'),
        input.id('teacher_id'),
        input.required('code', 'Код курса', 2, 32),
        title(),
        input.text('description'),
        input.choice('status', ['draft', 'active', 'archived']),
        null,
      ]),
    archive: () => call('admin_archive_course', [user.id, id()]),
    assignment: () =>
      call('admin_upsert_assignment', [
        user.id,
        optionalId(),
        input.id('course_id'),
        title(),
        input.text('description'),
        input.date('due_at'),
        input.number('max_score', 'Максимальный балл', 0.01, 9999.99),
        JSON.stringify({
          submission_format: input.required('submission_format', 'Формат', 1, 30),
          expected_minutes: input.number('expected_minutes', 'Время выполнения', 5, 10080),
          allow_revision: input.choice('allow_revision', ['true', 'false']) === 'true',
        }),
        null,
      ]),
    enroll: () => call('admin_enroll', [user.id, input.id('course_id'), input.id('student_id')]),
    drop: () =>
      call('admin_drop_enrollment', [user.id, input.id('course_id'), input.id('student_id')]),
  };
  if (!operations[op]) throw new Error('Неизвестная операция');
  return operations[op]();
}
