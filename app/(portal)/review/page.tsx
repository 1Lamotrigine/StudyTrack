import { Review } from '@/features/submissions/tasks';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Review {...await pageContext(props, ['review'])} />;
}
