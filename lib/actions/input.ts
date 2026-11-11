export class Input {
  constructor(public form: FormData) {}
  text(key: string) {
    return String(this.form.get(key) || '').trim();
  }
  raw(key: string) {
    return String(this.form.get(key) || '');
  }
  required(key: string, label: string, min = 1, max = 10000) {
    const value = this.text(key);
    if (value.length < min) throw new Error(`${label}: минимум ${min} символов`);
    if (value.length > max) throw new Error(`${label}: максимум ${max} символов`);
    return value;
  }
  id(key: string, optional = false) {
    const raw = this.text(key);
    if (!raw && optional) return null;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1)
      throw new Error('Выберите корректную запись');
    return n;
  }
  number(key: string, label: string, min = 0, max = 100000) {
    const raw = this.text(key).replace(',', '.');
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < min || value > max)
      throw new Error(`${label}: число от ${min} до ${max}`);
    return value;
  }
  email() {
    const value = this.required('email', 'Email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Укажите корректный email');
    return value;
  }
  password() {
    const value = this.raw('password');
    if (value.length < 8 || value.length > 128)
      throw new Error('Пароль должен содержать от 8 до 128 символов');
    return value;
  }
  choice(key: string, allowed: string[]) {
    const value = this.text(key);
    if (!allowed.includes(value)) throw new Error('Выберите значение из списка');
    return value;
  }
  date(key: string) {
    const raw = this.text(key);
    const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? raw + ':00+05:00' : raw;
    const date = new Date(zoned);
    if (!raw || Number.isNaN(date.getTime())) throw new Error('Укажите корректную дату и время');
    return date.toISOString();
  }
  values() {
    return Object.fromEntries(
      [...this.form.entries()]
        .filter(
          ([k, v]) =>
            typeof v === 'string' && !k.startsWith('$') && !['password', 'op', 'back'].includes(k),
        )
        .map(([k, v]) => [k, String(v)]),
    );
  }
}
export function safeReturnPath(raw: string) {
  try {
    if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\r\n]/.test(raw)) return '/';
    const url = new URL(raw, 'http://studytrack.local');
    return url.origin === 'http://studytrack.local' ? url.pathname + url.search : '/';
  } catch {
    return '/';
  }
}
export function friendlyError(error: unknown) {
  const e = error as { code?: string; message?: string; constraint?: string };
  if (e.code === '23505') return 'Такая запись уже существует. Проверьте логин, email или код.';
  if (e.code === '23503')
    return 'Связанная запись недоступна. Обновите страницу и выберите её заново.';
  if (e.code === '23514') return 'Данные не соответствуют ограничениям. Проверьте значения полей.';
  if (e.code === '22P02' || e.code === '22007' || e.code === '22008')
    return 'Проверьте формат чисел и даты.';
  if (e.code && !['P0001', '42501', '22023'].includes(e.code))
    return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
  return e.message || 'Не удалось выполнить действие';
}
