import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { initialize } from '../lib/db';
import { verifyPassword, hashPassword } from '../lib/password';
test('Полная схема, данные, сценарии и ограничения PGlite', async () => {
  const db = await initialize(new PGlite());
  try {
    const q = async (sql: string, args: unknown[] = []) => (await db.query<any>(sql, args)).rows;
    assert.equal((await q('SELECT count(*)::int n FROM users'))[0].n, 13);
    assert.equal((await q('SELECT count(*)::int n FROM submission_versions'))[0].n, 48);
    for (const [login, password] of [
      ['student', 'student123'],
      ['teacher', 'teacher123'],
      ['admin', 'admin123'],
    ]) {
      const u = (await q('SELECT * FROM fn_login_lookup($1)', [login]))[0];
      assert.ok(verifyPassword(password, u.password_hash));
      assert.ok(!verifyPassword('bad', u.password_hash));
    }
    assert.ok(verifyPassword('testpass123', hashPassword('testpass123')));
    const version = (await q('CALL submit_version($1,$2,$3,NULL)', [3, 1, 'Тестовая работа']))[0]
      .p_version_id;
    assert.ok(version > 48);
    assert.equal(
      (await q('SELECT version_no FROM submission_versions WHERE id=$1', [version]))[0].version_no,
      2,
    );
    await assert.rejects(q('CALL submit_version(3,3,$1,NULL)', ['Повторная работа']));
    await assert.rejects(q('CALL submit_version(3,5,$1,NULL)', ['Нет зачисления']));
    await assert.rejects(q('CALL grade_version(1,$1,90,NULL)', [version]));
    await assert.rejects(q('CALL grade_version(2,$1,101,NULL)', [version]));
    await q('CALL grade_version(2,$1,90,$2)', [version, 'Первая оценка']);
    await q('CALL grade_version(2,$1,95,$2)', [version, 'Исправление']);
    assert.equal(
      (await q('SELECT count(*)::int n FROM grade_history WHERE version_id=$1', [version]))[0].n,
      2,
    );
    await assert.rejects(q("CALL admin_set_role(3,4,'teacher')"));
    await assert.rejects(q('CALL admin_toggle_user(13,13)'));
    await q("CALL admin_upsert_category(13,NULL,'Тест','test-category',1,NULL)");
    await assert.rejects(q('UPDATE course_categories SET parent_id=3 WHERE id=1'));
    await q('CALL admin_enroll(13,3,3)');
    await q('CALL admin_drop_enrollment(13,3,3)');
    assert.equal((await q('SELECT count(*)::int n FROM admin_audit_log'))[0].n, 3);
    const uid = (
      await q(
        "CALL admin_create_user(13,'Тестовый студент','test@example.edu','student','test_user',$1,NULL)",
        [hashPassword('newpass123')],
      )
    )[0].p_user_id;
    await q("CALL admin_update_user(13,$1,'Новое имя','updated@example.edu')", [uid]);
    await q("CALL admin_set_role(13,$1,'teacher')", [uid]);
    await q('CALL admin_toggle_user(13,$1)', [uid]);
    assert.equal((await q("SELECT * FROM fn_login_lookup('test_user')")).length, 0);
    await q('CALL admin_toggle_user(13,$1)', [uid]);
    await q('CALL admin_reset_password(13,$1,$2)', [uid, hashPassword('changed123')]);
    assert.ok(
      verifyPassword(
        'changed123',
        (await q("SELECT * FROM fn_login_lookup('test_user')"))[0].password_hash,
      ),
    );
    const cid = (
      await q(
        "CALL admin_upsert_course(13,NULL,1,$1,'TEST-1','Тестовый курс','Описание','active',NULL)",
        [uid],
      )
    )[0].p_id;
    await q(
      "CALL admin_upsert_course(13,$1,1,$2,'TEST-1','Обновлённый курс','Описание','active',NULL)",
      [cid, uid],
    );
    const aid = (
      await q(
        "CALL admin_upsert_assignment(13,NULL,$1,'Тестовое задание','Описание','2027-01-01T00:00:00Z',100,$2,NULL)",
        [cid, JSON.stringify({ expected_minutes: 30, allow_revision: true })],
      )
    )[0].p_id;
    await q(
      "CALL admin_upsert_assignment(13,$1,$2,'Обновлённое задание','Описание','2027-01-01T00:00:00Z',50,'{}',NULL)",
      [aid, cid],
    );
    await q('CALL admin_archive_course(13,$1)', [cid]);
    assert.equal((await q('SELECT status FROM courses WHERE id=$1', [cid]))[0].status, 'archived');
    const before = (await q('SELECT count(*)::int n FROM submission_versions'))[0].n;
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query("CALL submit_version(3,1,'Откатываемая версия',NULL)");
        throw new Error('rollback');
      }),
    );
    assert.equal((await q('SELECT count(*)::int n FROM submission_versions'))[0].n, before);

    assert.ok(
      (
        await q(
          "SELECT id FROM assignments WHERE search_vector @@ websearch_to_tsquery('russian','данные')",
        )
      ).length,
    );
    assert.ok((await q('SELECT * FROM v_course_results')).length);
    assert.equal((await q('SELECT count(*)::int n FROM v_assignment_status'))[0].n, 13);
    await initialize(db);
    assert.equal((await q('SELECT count(*)::int n FROM users'))[0].n, 14);
  } finally {
    await db.close();
  }
});

test('Файловая персистентность и восстановление архива', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studytrack-'));
  try {
    let db = await initialize(new PGlite(path.join(root, 'source')));
    await db.query(
      "CALL admin_upsert_category(13,NULL,'Сохранённая категория','persistent',NULL,NULL)",
    );
    const archive = await db.dumpDataDir('gzip');
    await db.close();
    db = await initialize(new PGlite(path.join(root, 'source')));
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM course_categories WHERE slug='persistent'",
        )
      ).rows[0].n,
      1,
    );
    await db.close();
    db = new PGlite(path.join(root, 'restored'), { loadDataDir: archive });
    await db.waitReady;
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM course_categories WHERE slug='persistent'",
        )
      ).rows[0].n,
      1,
    );
    await db.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
