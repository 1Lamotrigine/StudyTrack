import { actionData } from './http.mjs';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3107';
for (const role of ['student', 'teacher', 'admin']) {
  let response = await fetch(base + '/login');
  let html = await response.text();
  assert.equal(response.status, 200);
  const data = actionData(html);
  data.set('op', 'login');
  data.set('back', '/login');
  data.set('login', role);
  data.set('password', role + '123');
  response = await fetch(base + '/login', {
    method: 'POST',
    body: data,
    headers: { origin: base },
    redirect: 'manual',
  });
  assert.equal(response.status, 303);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Session cookie: ' + response.headers.get('location'));
  const paths = [
    '/',
    '/courses',
    '/courses/2',
    '/search?q=данные',
    ...(role !== 'student' ? ['/reports', '/reports/course/2'] : []),
    ...(role === 'student' ? ['/assignments/1/submit', '/tasks', '/tasks?status=graded'] : []),
    ...(role === 'teacher' ? ['/versions/10/grade', '/review'] : []),
    ...(role === 'admin'
      ? [
          '/admin',
          '/admin/users',
          '/admin/users/create',
          '/admin/users/3',
          '/admin/categories',
          '/admin/categories/0',
          '/admin/categories/1',
          '/admin/courses',
          '/admin/courses/create',
          '/admin/courses/1',
          '/admin/courses/1/enrollments',
          '/admin/assignments',
          '/admin/assignments/create',
          '/admin/assignments/1',
          '/admin/audit',
        ]
      : []),
  ];
  for (const path of paths) {
    const r = await fetch(base + path, { headers: { cookie }, redirect: 'manual' });
    const text = await r.text();
    assert.equal(r.status, 200, `${role} ${path}: ${text.slice(0, 200)}`);
    assert.ok(!text.includes('Application error'), path);
  }
  if (role === 'student') {
    const r = await fetch(base + '/admin', { headers: { cookie }, redirect: 'manual' });
    const text = await r.text();
    assert.ok(
      r.status === 307 || (r.status === 200 && text.includes('NEXT_REDIRECT')),
      'Unauthorized route redirects',
    );
    assert.ok(!text.includes('Настройки пространства'), 'Protected content is absent');
  }
  console.log(`${role}: ${paths.length} страниц, вход и права OK`);
}
