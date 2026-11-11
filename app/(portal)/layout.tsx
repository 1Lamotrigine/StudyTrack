import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Layout({ children }: { children: ReactNode }) {
  return <Shell user={await requireUser()}>{children}</Shell>;
}
