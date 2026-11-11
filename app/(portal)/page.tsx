import { Dashboard } from '@/features/dashboard/view';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Dashboard {...await pageContext(props, [])} />;
}
