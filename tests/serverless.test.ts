import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { initialize } from '../lib/db';
import { ensureDefaultUsers, DEFAULT_USERS } from '../lib/default-users';
import { usesEphemeralDatabase } from '../lib/runtime';
import { createDemoSession, readDemoSession, credentialVersion } from '../lib/demo-session';
import { hashPassword, verifyPassword } from '../lib/password';

test('Vercel uses memory instead of the read-only project directory', () => {
  assert.equal(usesEphemeralDatabase({ VERCEL: '1', PGLITE_DATA_DIR: './data/studytrack' }), true);
  assert.equal(usesEphemeralDatabase({ PGLITE_DATA_DIR: 'memory://' }), true);
  assert.equal(usesEphemeralDatabase({ PGLITE_DATA_DIR: './data/studytrack' }), false);
});
test('Missing default accounts are created idempotently without resetting existing passwords', async () => {
  const db = await initialize(new PGlite());
  try {
    await db.exec('TRUNCATE users RESTART IDENTITY CASCADE');
    await ensureDefaultUsers(db);
    await ensureDefaultUsers(db);
    const users = (
      await db.query<{ login: string; password_hash: string; role: string }>(
        'SELECT login,password_hash,role FROM users',
      )
    ).rows;
    assert.equal(users.length, 3);
    for (const expected of DEFAULT_USERS) {
      const user = users.find((u) => u.login === expected.login)!;
      assert.equal(user.role, expected.role);
      assert.ok(verifyPassword(expected.password, user.password_hash));
    }
    const changed = hashPassword('myNewPassword123');
    await db.query("UPDATE users SET password_hash=$1 WHERE login='student'", [changed]);
    await initialize(db);
    assert.equal(
      (
        await db.query<{ password_hash: string }>(
          "SELECT password_hash FROM users WHERE login='student'",
        )
      ).rows[0].password_hash,
      changed,
    );
  } finally {
    await db.close();
  }
});
test('Default-user session is portable between independently initialized serverless databases', async () => {
  const first = await initialize(new PGlite());
  const second = await initialize(new PGlite());
  try {
    const now = 1700000000000;
    const key = 'shared-test-session-key';
    for (const account of DEFAULT_USERS) {
      const user = (
        await first.query<{ id: number; password_hash: string }>(
          'SELECT id,password_hash FROM users WHERE login=$1',
          [account.login],
        )
      ).rows[0];
      const token = createDemoSession(user.id, user.password_hash, now, key);
      const claims = readDemoSession(token, now + 1000, key)!;
      assert.ok(claims);
      const other = (
        await second.query<{ id: number; password_hash: string }>(
          'SELECT id,password_hash FROM users WHERE login=$1',
          [account.login],
        )
      ).rows[0];
      assert.equal(claims.id, other.id);
      assert.equal(claims.credential, credentialVersion(other.password_hash));
      assert.equal(readDemoSession(token, now + 13 * 3600000, key), null);
      assert.equal(readDemoSession(token, now + 1000, 'different-key'), null);
      assert.equal(readDemoSession(token + 'x', now + 1000, key), null);
    }
  } finally {
    await first.close();
    await second.close();
  }
});
