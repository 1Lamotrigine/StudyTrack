'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import type { Role } from '@/lib/types';
export function Navigation({ role }: { role: Role }) {
  const path = usePathname();
  const current = path.startsWith('/assignments/')
    ? '/tasks'
    : path.startsWith('/versions/')
      ? '/review'
      : path;
  const links = [
    ['/', 'grid', 'Обзор'],
    ['/courses', 'book', 'Курсы'],
    [
      role === 'student' ? '/tasks' : '/review',
      role === 'student' ? 'file' : 'check',
      role === 'student' ? 'Мои задания' : 'Проверка работ',
    ],
    ['/search', 'search', 'Поиск заданий'],
    ...(role !== 'student' ? [['/reports', 'chart', 'Аналитика']] : []),
    ...(role === 'admin'
      ? [
          ['/admin', 'settings', 'Управление'],
          ['/dbms', 'database', 'SQL Workspace'],
        ]
      : []),
  ];
  return (
    <nav className="side-nav" aria-label="Основная навигация">
      {links
        .filter(([url]) => role !== 'admin' || url !== '/review')
        .map(([url, icon, label]) => {
          const active = url === '/' ? current === '/' : current.startsWith(url);
          return (
            <Link
              key={url}
              href={url}
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
