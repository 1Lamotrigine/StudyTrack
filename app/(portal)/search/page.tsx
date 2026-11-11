import { SearchPage } from '@/features/search/view';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <SearchPage {...await pageContext(props, ['search'])} />;
}
