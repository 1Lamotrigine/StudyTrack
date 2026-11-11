import { Grade } from '@/features/submissions/grade';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Grade {...await pageContext(props, ['versions', ':id', 'grade'])} />;
}
