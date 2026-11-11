import { Admin } from '@/features/admin/view';
import { requireUser } from '@/lib/auth';
import type { RouteProps } from '@/lib/types';
import { notFound } from 'next/navigation';
export default async function Page(props: RouteProps) {
  const user = await requireUser(['admin']);
  const segments = (await props.params).section || [];
  const [section, id, sub] = segments;
  if (segments.length > 3) notFound();
  if (section && !['users', 'categories', 'courses', 'assignments', 'audit'].includes(section))
    notFound();
  if (section === 'audit' && segments.length !== 1) notFound();
  if (id && id !== 'create' && !/^\d+$/.test(id)) notFound();
  if (
    id &&
    id !== 'create' &&
    (!Number.isSafeInteger(Number(id)) ||
      Number(id) < 0 ||
      (Number(id) === 0 && section !== 'categories'))
  )
    notFound();
  if (id === 'create' && !['users', 'courses', 'assignments'].includes(section)) notFound();
  if (sub && (section !== 'courses' || sub !== 'enrollments' || !/^\d+$/.test(id))) notFound();
  return (
    <Admin
      segments={segments}
      sp={await props.searchParams}
      path={'/admin' + (segments.length ? '/' + segments.join('/') : '')}
      user={user}
    />
  );
}
