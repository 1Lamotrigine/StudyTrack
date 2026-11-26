import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="login-content study-ui standalone-error">
      <div className="empty-state">
        <div className="public-theme">
          <ThemeToggle />
        </div>
        <div className="eyebrow">Ошибка 404</div>
        <h1>Страница не найдена</h1>
        <p>Страница могла переместиться или адрес содержит ошибку.</p>
        <Link href="/" className="btn">
          Вернуться к обзору
        </Link>
      </div>
    </div>
  );
}
