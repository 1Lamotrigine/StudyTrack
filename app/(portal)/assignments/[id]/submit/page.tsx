import { Submit } from '@/features/submissions/submit';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <Submit {...await pageContext(props, ['assignments', ':id', 'submit'])} />;
}
