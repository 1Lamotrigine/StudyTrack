import { CourseReport } from '@/features/reports/course';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <CourseReport {...await pageContext(props, ['reports', 'course', ':id'])} />;
}
