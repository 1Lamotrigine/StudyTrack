import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function hashPassword(password: string) {
  if (password.length < 8) throw new Error('Пароль должен содержать минимум 8 символов');
  const salt = randomBytes(16);
  return `scrypt$16384$8$1$${salt.toString('base64')}$${scryptSync(password, salt, 32).toString('base64')}`;
}
export function verifyPassword(password: string, stored: string) {
  try {
    const [alg, n, r, p, salt, hash] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    return timingSafeEqual(
      expected,
      scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      }),
    );
  } catch {
    return false;
  }
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
