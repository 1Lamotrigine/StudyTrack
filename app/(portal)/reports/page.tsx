import { Reports } from '@/features/reports/overview';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Reports {...await pageContext(props, ['reports'])} />;
}
