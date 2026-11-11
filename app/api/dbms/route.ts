import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { readCatalog, readObject } from '@/lib/dbms/catalog';
import { executeSql } from '@/lib/dbms/execute';
import { editData, type EditRequest } from '@/lib/dbms/edit';
import type { SqlResponse } from '@/features/dbms/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function authorize() {
  const user = await currentUser();
  return !user
    ? json({ error: 'Войдите в аккаунт администратора.' }, 401)
    : user.role !== 'admin'
      ? json({ error: 'SQL-консоль доступна только администратору.' }, 403)
      : null;
}
export async function GET(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const db = await getDb();
    const raw = request.nextUrl.searchParams.get('oid');
    if (raw) {
      const oid = Number(raw);
      if (!Number.isSafeInteger(oid) || oid < 1)
        return json({ error: 'Некорректный идентификатор объекта.' }, 400);
      return json(await readObject(db, oid, request.nextUrl.searchParams.get('kind') || undefined));
    }
    return json(await readCatalog(db));
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === request.headers.get('host');
  } catch {}
  if (!sameOrigin) return json({ error: 'Запрос разрешён только с этого сайта.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: 'Ожидается JSON.' }, 415);
  const denied = await authorize();
  if (denied) return denied;
  try {
    const body = await request.text();
    if (body.length > 400000) return json({ error: 'Слишком большой запрос.' }, 413);
    const input = JSON.parse(body);
    const db = await getDb();
    if (input.action === 'edit') {
      if (
        !Number.isSafeInteger(input.oid) ||
        !['insert', 'update', 'delete'].includes(input.operation)
      )
        throw new Error('Некорректное изменение строки.');
      const result = await editData(db, input as EditRequest);
      return json({ rows: result.rows, affectedRows: result.affectedRows });
    }
    if (
      typeof input.sql !== 'string' ||
      !['execute', 'preview', 'explain', 'analyze'].includes(input.mode)
    )
      throw new Error('Некорректный SQL-запрос или режим.');
    return json(await executeSql(db, input.sql, input.mode as SqlResponse['mode']));
  } catch (error) {
    const e = error as { message: string; code?: string; detail?: string; hint?: string };
    return json({ error: e.message, code: e.code, detail: e.detail, hint: e.hint }, 400);
  }
}
