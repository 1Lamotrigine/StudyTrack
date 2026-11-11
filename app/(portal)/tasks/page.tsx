import { Tasks } from '@/features/submissions/tasks';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Tasks {...await pageContext(props, ['tasks'])} />;
}
