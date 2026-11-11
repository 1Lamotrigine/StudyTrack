import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from './types';
import { one } from './db';
import { tokenHash } from './password';
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get('studytrack_session')?.value;
  return token
    ? (one(
        'SELECT u.id,u.full_name,u.email,u.role FROM web_sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now() AND u.is_active',
        [tokenHash(token)],
      ) as Promise<User | undefined>)
    : undefined;
}
export async function requireUser(roles?: string[]) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (roles && !roles.includes(user.role))
    redirect('/?error=' + encodeURIComponent('Недостаточно прав'));
  return user;
}
