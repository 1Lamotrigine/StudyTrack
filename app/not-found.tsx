import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="login-content" style={{ minHeight: '70vh' }}>
      <div className="empty-state">
        <div className="public-theme">
          <ThemeToggle />
        </div>
        <div className="eyebrow">404 · Страница не найдена</div>
        <h1>Кажется, вы свернули с пути</h1>
        <p>Страница могла переместиться или адрес содержит ошибку.</p>
        <Link href="/" className="btn">
          Вернуться к обзору
        </Link>
      </div>
    </div>
  );
}
