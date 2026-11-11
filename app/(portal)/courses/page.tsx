import { Catalog } from '@/features/courses/catalog';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Catalog {...await pageContext(props, ['courses'])} />;
}
