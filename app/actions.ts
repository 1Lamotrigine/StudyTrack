'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { call, one, query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { verifyPassword, tokenHash } from '@/lib/password';
import { adminMutation } from '@/lib/actions/admin';
import { Input, safeReturnPath, friendlyError } from '@/lib/actions/input';
import type { ActionState } from '@/lib/types';
export async function mutate(_previous: ActionState, form: FormData): Promise<ActionState> {
  const input = new Input(form);
  const op = input.text('op');
  const back = safeReturnPath(input.text('back'));
  const user = op === 'login' ? undefined : await requireUser();
  let target = back;
  try {
    if (op === 'login') {
      const account = await one('SELECT * FROM fn_login_lookup($1)', [input.text('login')]);
      if (!account || !verifyPassword(input.raw('password'), account.password_hash))
        throw new Error('Неверный логин или пароль. Проверьте данные и попробуйте ещё раз.');
      const token = randomBytes(32).toString('hex');
      await query('DELETE FROM web_sessions WHERE expires_at<now()');
      await query("INSERT INTO web_sessions VALUES($1,$2,now()+interval '12 hours')", [
        tokenHash(token),
        account.id,
      ]);
      (await cookies()).set('studytrack_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 43200,
        path: '/',
      });
      target = '/';
    } else if (op === 'logout') {
      const jar = await cookies();
      const token = jar.get('studytrack_session')?.value;
      if (token) await query('DELETE FROM web_sessions WHERE token=$1', [tokenHash(token)]);
      jar.delete('studytrack_session');
      target = '/login';
    } else if (op === 'submit') {
      if (user!.role !== 'student') throw new Error('Отправлять работы может только студент');
      await call('submit_version', [
        user!.id,
        input.id('id'),
        input.required('body', 'Текст работы', 1, 100000),
        null,
      ]);
    } else if (op === 'grade') {
      if (user!.role !== 'teacher') throw new Error('Оценивать работы может только преподаватель');
      const versionId = input.id('id');
      const version = await one(
        'SELECT a.max_score,c.teacher_id FROM submission_versions sv JOIN assignments a ON a.id=sv.assignment_id JOIN courses c ON c.id=a.course_id WHERE sv.id=$1',
        [versionId],
      );
      if (!version || version.teacher_id !== user!.id)
        throw new Error('Эта работа недоступна для оценивания');
      await call('grade_version', [
        user!.id,
        versionId,
        input.number('score', 'Оценка', 0, Number(version.max_score)),
        input.text('comment') || null,
      ]);
    } else {
      const result = await adminMutation(user!, op, input);
      const row = Array.isArray(result) ? result[0] : undefined;
      if (op === 'create_user' && row?.p_user_id) target = `/admin/users/${row.p_user_id}`;
      if (['course', 'category', 'assignment'].includes(op) && row?.p_id) {
        const section = { course: 'courses', category: 'categories', assignment: 'assignments' }[
          op
        ];
        target = `/admin/${section}/${row.p_id}`;
      }
    }
  } catch (error) {
    return { error: friendlyError(error), values: input.values() };
  }
  revalidatePath('/', 'layout');
  if (!['login', 'logout'].includes(op)) {
    const url = new URL(target, 'http://studytrack.local');
    url.searchParams.set('success', '1');
    url.searchParams.delete('error');
    target = url.pathname + url.search;
  }
  redirect(target);
}
