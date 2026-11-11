import type { User, SearchParams } from '@/lib/types';
export type AdminContext = { segments: string[]; sp: SearchParams; path: string; user: User };
