import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { initialize } from '../lib/db';
import { Input, safeReturnPath } from '../lib/actions/input';

test('Новые правила работают и после обновления существующей базы', async () => {
  const db = await initialize(new PGlite());
  try {
    const q = (sql: string, args: unknown[] = []) => db.query(sql, args);
    await assert.rejects(q("UPDATE users SET role='student' WHERE id=13"), /последнего/);
    await assert.rejects(q('UPDATE users SET is_active=false WHERE id=13'), /последнего/);
    await assert.rejects(q("CALL admin_set_role(13,1,'student')"), /переназначьте/);
    await assert.rejects(q("CALL admin_set_role(13,3,'teacher')"), /учебная история/);
    await assert.rejects(q('UPDATE assignments SET max_score=10 WHERE id=3'), /выставленной/);
    await assert.rejects(q('UPDATE assignments SET course_id=3 WHERE id=3'), /переместить/);
    await q("INSERT INTO web_sessions VALUES('test-session',3,now()+interval '1 hour')");
    await q('CALL admin_toggle_user(13,3)');
    assert.equal((await q('SELECT * FROM web_sessions')).rows.length, 0);
    await q('CALL admin_toggle_user(13,3)');
    await q('CALL admin_archive_course(13,1)');
    await assert.rejects(q("CALL submit_version(3,1,'После архивирования',NULL)"), /активном/);
    await assert.rejects(q('CALL admin_enroll(13,1,8)'), /активный/);
    assert.ok(
      (await q('SELECT * FROM submission_versions WHERE assignment_id=1')).rows.length > 0,
      'История сохраняется',
    );
    await initialize(db);
    assert.equal(
      (await db.query<{ n: number }>('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,
      3,
    );
  } finally {
    await db.close();
  }
});
test('Валидация не допускает некорректных ID, чисел и внешних переходов', () => {
  const form = new FormData();
  form.set('id', '-1');
  form.set('score', 'NaN');
  form.set('password', '  password  ');
  form.set('due_at', '2027-01-10T12:30');
  const input = new Input(form);
  assert.throws(() => input.id('id'));
  assert.throws(() => input.number('score', 'Оценка'));
  assert.equal(input.password(), '  password  ');
  assert.ok(!('password' in input.values()));
  assert.equal(input.date('due_at'), '2027-01-10T07:30:00.000Z');
  for (const url of ['https://example.com', '//example.com', '/\\example.com', '/\nredirect'])
    assert.equal(safeReturnPath(url), '/');
  assert.equal(safeReturnPath('/courses/2?tab=results'), '/courses/2?tab=results');
});

test('Сдаваемость не учитывает отчисленных, средний балл не удваивает версии', async () => {
  const db = await initialize(new PGlite());
  try {
    const created = await db.query<{ p_version_id: number }>(
      "CALL submit_version(3,1,'Новая версия для отчёта',NULL)",
    );
    await db.query('CALL grade_version(2,$1,90,NULL)', [created.rows[0].p_version_id]);
    let report = (
      await db.query<{ students_submitted: number; enrolled_students: number; avg_score: string }>(
        'SELECT * FROM v_assignment_status WHERE assignment_id=1',
      )
    ).rows[0];
    assert.equal(Number(report.avg_score), 85.67); // Latest scores: 90, 92, 75; first version 88 is not counted twice.
    await db.query('CALL admin_drop_enrollment(13,1,3)');
    report = (
      await db.query<{ students_submitted: number; enrolled_students: number; avg_score: string }>(
        'SELECT * FROM v_assignment_status WHERE assignment_id=1',
      )
    ).rows[0];
    assert.equal(Number(report.students_submitted), 3);
    assert.equal(Number(report.enrolled_students), 4);
    assert.ok(Number(report.students_submitted) <= Number(report.enrolled_students));
  } finally {
    await db.close();
  }
});
