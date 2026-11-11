import { requireUser } from './auth';
import type { RouteProps, PageContext } from './types';
import { notFound } from 'next/navigation';
export async function pageContext(props: RouteProps, template: string[]): Promise<PageContext> {
  const params = await props.params;
  if (
    template.includes(':id') &&
    (!params.id ||
      !/^\d+$/.test(params.id) ||
      Number(params.id) < 1 ||
      !Number.isSafeInteger(Number(params.id)))
  )
    notFound();
  const segments = template.map((s) => (s === ':id' ? params.id! : s));
  const user = await requireUser(segments[0] === 'reports' ? ['teacher', 'admin'] : undefined);
  return { user, sp: await props.searchParams, path: '/' + segments.join('/'), segments };
}
