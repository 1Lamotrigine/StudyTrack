import Link from 'next/link';
import type { ReactNode } from 'react';
import type { User } from '@/lib/types';
import { Navigation } from './navigation';
import { Icon } from './icon';
import { ThemeToggle } from './theme-toggle';
import { Form } from '@/app/components';
const roles = { student: 'Студент', teacher: 'Преподаватель', admin: 'Администратор' };
export function Shell({ user, children }: { user: User; children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="logo">
            <Icon name="book" size={22} />
          </span>
          StudyTrack<span className="brand-dot">.</span>
        </Link>
        <div className="mobile-account">
          <ThemeToggle />
          <Form op="logout" back="/" />
        </div>
        <Navigation role={user.role} />
        <div className="sidebar-note">
          <span className="mini-icon">
            <Icon name="spark" />
          </span>
          <strong>
            Учиться. Создавать.
            <br />
            Двигаться вперёд.
          </strong>
          <p>Каждая работа — ещё один шаг к результату.</p>
        </div>
        <div className="account">
          <span className="avatar">
            {user.full_name
              .split(' ')
              .slice(0, 2)
              .map((s) => s[0])
              .join('')}
          </span>
          <div>
            <strong>{user.full_name.split(' ').slice(0, 2).join(' ')}</strong>
            <small>{roles[user.role]}</small>
          </div>
          <Form op="logout" back="/" />
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <span className="topbar-label">Ваше учебное пространство</span>
          <Link href="/search" className="top-search">
            <Icon name="search" size={17} />
            Найти задание<span>⌕</span>
          </Link>
          <span className="role-label">{roles[user.role]}</span>
          <ThemeToggle />
        </header>
        <main id="main">{children}</main>
        <footer className="page-footer">
          <span>StudyTrack</span>
          <span>Маленькие шаги. Большие результаты.</span>
        </footer>
      </div>
    </div>
  );
}
