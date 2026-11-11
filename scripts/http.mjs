import assert from 'node:assert/strict';
export function actionData(html, operation) {
  const forms = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].map((m) => m[1]);
  const form = operation
    ? forms.find((f) => f.includes(`name="op" value="${operation}"`))
    : forms[0];
  assert.ok(form, `Form ${operation || ''} exists`);
  const data = new FormData();
  for (const match of form.matchAll(/<input([^>]+)>/g)) {
    const attrs = Object.fromEntries(
      [...match[1].matchAll(/([\w:$-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]),
    );
    if (attrs.type === 'hidden' && attrs.name) data.set(attrs.name, attrs.value || '');
  }
  return data;
}
function decode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
export function client(base) {
  let cookie = '';
  return {
    async get(path) {
      const r = await fetch(base + path, { headers: { cookie }, redirect: 'manual' });
      return { response: r, html: await r.text() };
    },
    async post(path, op, fields, html) {
      if (!html) html = (await this.get(path)).html;
      const data = actionData(html, op);
      for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
      const r = await fetch(base + path, {
        method: 'POST',
        body: data,
        headers: { origin: base, cookie },
        redirect: 'manual',
      });
      const session = r.headers.get('set-cookie')?.split(';')[0];
      if (session) cookie = session;
      return { response: r, html: await r.text(), location: r.headers.get('location') };
    },
    async json(path, body, extraHeaders = {}) {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: base, cookie, ...extraHeaders },
        body: JSON.stringify(body),
        redirect: 'manual',
      });
      return { response, data: await response.json() };
    },
    async login(login, password) {
      const result = await this.post('/login', 'login', { login, password });
      assert.equal(result.response.status, 303, 'Вход ' + login);
      return this;
    },
  };
}
