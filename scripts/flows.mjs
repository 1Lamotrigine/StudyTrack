import assert from 'node:assert/strict';
import { client } from './http.mjs';
if (process.env.ALLOW_TEST_WRITES !== 'yes')
  throw new Error(
    'Запустите отдельный сервер с PGLITE_DATA_DIR=./data/test-flows. Для тестовых записей задайте ALLOW_TEST_WRITES=yes.',
  );
const base = process.env.TEST_URL || 'http://127.0.0.1:3111';
const unique = Date.now().toString(36);
const password = 'FlowTest123!';
const admin = await client(base).login('admin', 'admin123');
async function created(path, op, fields) {
  const r = await admin.post(path, op, fields);
  assert.equal(r.response.status, 303, r.html.slice(0, 300));
  const id = Number(r.location?.match(/\/(\d+)(?:\?|$)/)?.[1]);
  assert.ok(id, `${op}: ${r.location}`);
  return id;
}
const teacherId = await created('/admin/users/create', 'create_user', {
  full_name: 'Тестовый Преподаватель',
  email: `teacher.${unique}@test.local`,
  login: `teacher.${unique}`,
  role: 'teacher',
  password,
});
const studentId = await created('/admin/users/create', 'create_user', {
  full_name: 'Тестовый Студент',
  email: `student.${unique}@test.local`,
  login: `student.${unique}`,
  role: 'student',
  password,
});
const courseId = await created('/admin/courses/create', 'course', {
  category_id: 1,
  teacher_id: teacherId,
  code: `FLOW-${unique}`,
  title: 'Курс сквозного теста',
  description: 'Изолированный проверочный курс',
  status: 'active',
});
const assignmentId = await created('/admin/assignments/create', 'assignment', {
  course_id: courseId,
  title: 'Задание сквозного теста',
  description: 'Проверка полного пути',
  due_at: '2027-12-01T12:00',
  max_score: 100,
  submission_format: 'text',
  expected_minutes: 30,
  allow_revision: 'true',
});
let result = await admin.post(`/admin/courses/${courseId}/enrollments`, 'enroll', {
  course_id: courseId,
  student_id: studentId,
});
assert.equal(result.response.status, 303);
const student = await client(base).login(`student.${unique}`, password);
const submitPath = `/assignments/${assignmentId}/submit`;
const originalForm = (await student.get(submitPath)).html;
result = await student.post(
  submitPath,
  'submit',
  { body: 'Полное решение из сквозного теста' },
  originalForm,
);
assert.equal(result.response.status, 303);
const teacher = await client(base).login(`teacher.${unique}`, password);
const queue = (await teacher.get('/review')).html;
const versionId = Number(queue.match(/href="\/versions\/(\d+)\/grade"/)?.[1]);
assert.ok(versionId, 'Работа появилась в очереди преподавателя');
const gradePath = `/versions/${versionId}/grade`;
const gradeForm = (await teacher.get(gradePath)).html;
result = await teacher.post(
  gradePath,
  'grade',
  { score: '101', comment: 'Этот комментарий должен сохраниться' },
  gradeForm,
);
assert.equal(result.response.status, 200);
assert.ok(result.html.includes('Этот комментарий должен сохраниться'));
assert.ok(result.html.includes('Оценка'));
result = await teacher.post(
  gradePath,
  'grade',
  { score: 87, comment: 'Хорошая работа, решение принято' },
  gradeForm,
);
assert.equal(result.response.status, 303);
const studentResult = (await student.get(submitPath)).html;
assert.ok(studentResult.includes('Хорошая работа, решение принято'));
assert.ok(studentResult.includes('87.00'));
result = await student.post(gradePath, 'grade', { score: 100, comment: 'Чужая оценка' }, gradeForm);
assert.equal(result.response.status, 200);
assert.ok(result.html.includes('Оценивать работы может только преподаватель'));
result = await admin.post(`/admin/courses/${courseId}`, 'archive', {});
assert.equal(result.response.status, 303);
const archived = (await student.get(submitPath)).html;
assert.ok(archived.includes('Приём новых работ закрыт'));
result = await student.post(
  submitPath,
  'submit',
  { body: 'Запрещённая отправка после архива' },
  originalForm,
);
assert.equal(result.response.status, 200);
assert.ok(result.html.includes('активном курсе'));
console.log(
  'Сквозной сценарий OK: пользователи → курс → задание → зачисление → сдача → валидация → оценка → результат → отказ чужой роли → архив → отказ новой сдачи.',
);
