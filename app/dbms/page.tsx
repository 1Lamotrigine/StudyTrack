import { requireUser } from '@/lib/auth';
import { Workbench } from '@/features/dbms/workbench';
import { loadSnippets } from '@/lib/dbms/snippets';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'StudyTrack · SQL Workspace' };
export default async function Dbms() {
  const user = await requireUser(['admin']);
  return (
    <Workbench user={{ id: user.id, full_name: user.full_name }} snippets={await loadSnippets()} />
  );
}
