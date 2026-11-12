import { createHmac, timingSafeEqual } from 'node:crypto';
import { tokenHash } from './password';
export const SESSION_SECONDS = 12 * 60 * 60;
type Claims = { id: number; exp: number; credential: string };
// Intentionally usable without configuration for this public classroom demo.
function secret() {
  return process.env.SESSION_SECRET || 'studytrack-classroom-demo-session-v1';
}
export function credentialVersion(passwordHash: string) {
  return tokenHash(passwordHash);
}
export function createDemoSession(
  id: number,
  passwordHash: string,
  now = Date.now(),
  key = secret(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      id,
      exp: Math.floor(now / 1000) + SESSION_SECONDS,
      credential: credentialVersion(passwordHash),
    } satisfies Claims),
  ).toString('base64url');
  const data = `v1.${payload}`;
  return `${data}.${createHmac('sha256', key).update(data).digest('base64url')}`;
}
export function readDemoSession(token: string, now = Date.now(), key = secret()): Claims | null {
  try {
    if (token.length > 1024) return null;
    const [version, payload, signature, extra] = token.split('.');
    if (version !== 'v1' || !payload || !signature || extra) return null;
    const expected = createHmac('sha256', key).update(`${version}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
    return Number.isSafeInteger(claims.id) &&
      claims.id > 0 &&
      Number.isSafeInteger(claims.exp) &&
      claims.exp > Math.floor(now / 1000) &&
      typeof claims.credential === 'string' &&
      /^[a-f0-9]{64}$/.test(claims.credential)
      ? claims
      : null;
  } catch {
    return null;
  }
}
