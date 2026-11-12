import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from './types';
import { one } from './db';
import { tokenHash } from './password';
import { usesEphemeralDatabase } from './runtime';
import { readDemoSession, credentialVersion } from './demo-session';
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get('studytrack_session')?.value;
  if (!token) return undefined;
  if (usesEphemeralDatabase()) {
    const claims = readDemoSession(token);
    if (!claims) return undefined;
    const row = await one(
      'SELECT id,full_name,email,role,password_hash FROM users WHERE id=$1 AND is_active',
      [claims.id],
    );
    if (!row || credentialVersion(row.password_hash) !== claims.credential) return undefined;
    return { id: row.id, full_name: row.full_name, email: row.email, role: row.role };
  }
  return one(
    'SELECT u.id,u.full_name,u.email,u.role FROM web_sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now() AND u.is_active',
    [tokenHash(token)],
  ) as Promise<User | undefined>;
}
export async function requireUser(roles?: string[]) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (roles && !roles.includes(user.role))
    redirect('/?error=' + encodeURIComponent('Недостаточно прав'));
  return user;
}
