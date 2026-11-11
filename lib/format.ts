export const labels: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin: 'Администратор',
  active: 'Активен',
  draft: 'Черновик',
  archived: 'В архиве',
  completed: 'Завершён',
  dropped: 'Отчислен',
  INSERT: 'Выставлена',
  UPDATE: 'Исправлена',
};
export function formatDate(value: Date | string, short = false) {
  return new Date(value).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Aqtobe',
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(!short ? { year: 'numeric' as const } : {}),
  });
}
export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Aqtobe',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function localDateInput(value: Date | string) {
  return new Date(new Date(value).getTime() + 5 * 3600000).toISOString().slice(0, 16);
}
export function plural(n: number, forms: [string, string, string]) {
  const x = n % 100;
  return `${n} ${forms[x >= 11 && x <= 19 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2]}`;
}
