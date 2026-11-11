import assert from 'node:assert/strict';
import { client } from './http.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:3110';
const anonymous = await fetch(base + '/api/dbms');
assert.equal(anonymous.status, 401);
const student = await client(base).login('student', 'student123');
assert.equal((await student.get('/api/dbms')).response.status, 403);
assert.equal(
  (await student.json('/api/dbms', { mode: 'execute', sql: 'SELECT 1' })).response.status,
  403,
);
const admin = await client(base).login('admin', 'admin123');
assert.equal((await admin.get('/dbms')).response.status, 200);
const catalogResponse = await admin.get('/api/dbms');
assert.equal(catalogResponse.response.status, 200);
const catalog = JSON.parse(catalogResponse.html);
assert.ok(catalog.database.tables >= 9);
assert.ok(catalog.columns.length > 20);
const table = catalog.objects.find((o) => o.name === 'courses' && o.kind === 'table');
const object = JSON.parse((await admin.get(`/api/dbms?oid=${table.oid}&kind=table`)).html);
assert.ok(object.definition.includes('CREATE TABLE'));
assert.ok(object.constraints.some((c) => c.type === 'f'));
let r = await admin.json('/api/dbms', {
  mode: 'execute',
  sql: 'SELECT code, title FROM public.courses ORDER BY code;',
});
assert.equal(r.response.status, 200);
assert.ok(!r.data.error);
assert.equal(r.data.results[0].rowCount, 6);
r = await admin.json('/api/dbms', {
  mode: 'execute',
  sql: "BEGIN; CREATE TEMP TABLE dbms_http_test(id int PRIMARY KEY, note text); INSERT INTO dbms_http_test VALUES(1,'real SQL'); SELECT * FROM dbms_http_test; ROLLBACK;",
});
assert.ok(!r.data.error, JSON.stringify(r.data));
assert.equal(r.data.results[3].rows[0][1], 'real SQL');
r = await admin.json('/api/dbms', { mode: 'execute', sql: 'SELECT * FROM dbms_http_test;' });
assert.equal(r.data.error.code, '42P01');
r = await admin.json('/api/dbms', {
  mode: 'preview',
  sql: "UPDATE courses SET description='temporary HTTP test' WHERE id=1 RETURNING description;",
});
assert.ok(r.data.rolledBack);
assert.equal(r.data.results[0].rows[0][0], 'temporary HTTP test');
r = await admin.json('/api/dbms', {
  mode: 'execute',
  sql: 'SELECT description FROM courses WHERE id=1;',
});
assert.notEqual(r.data.results[0].rows[0][0], 'temporary HTTP test');
r = await admin.json('/api/dbms', { mode: 'explain', sql: 'SELECT * FROM courses WHERE id=2;' });
assert.ok(JSON.parse(r.data.results[0].rows[0][0])[0].Plan);
r = await admin.json(
  '/api/dbms',
  { mode: 'execute', sql: 'SELECT 1' },
  { origin: 'https://external.invalid' },
);
assert.equal(r.response.status, 403);
console.log(
  'DBMS HTTP OK: admin-only, catalog, metadata, real SELECT/DDL/DML, transaction rollback, dry run, SQLSTATE, EXPLAIN, origin validation.',
);
