import type { Row } from './db';
export type Role = 'student' | 'teacher' | 'admin';
export type User = { id: number; full_name: string; email: string; role: Role };
export type SearchParams = Record<string, string | undefined>;
export type RouteProps = {
  params: Promise<{ id?: string; section?: string[] }>;
  searchParams: Promise<SearchParams>;
};
export type PageContext = { user: User; sp: SearchParams; path: string; segments: string[] };
export type ActionState = { error?: string; values?: Record<string, string> };
export type Course = Row & {
  id: number;
  title: string;
  code: string;
  status: string;
  teacher_name: string;
  assignments_count: number;
  completed_count?: number;
  category_path?: string;
};
