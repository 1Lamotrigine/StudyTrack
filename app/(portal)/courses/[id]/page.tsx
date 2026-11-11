import { CourseDetail } from '@/features/courses/detail';
import { pageContext } from '@/lib/page-context';
import type { RouteProps } from '@/lib/types';
export default async function Page(props: RouteProps) {
  return <CourseDetail {...await pageContext(props, ['courses', ':id'])} />;
}
