'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty-state">
      <h1>Не удалось загрузить страницу</h1>
      <p>Попробуйте ещё раз. Если проблема повторится, вернитесь к обзору.</p>
      <div className="btn-row">
        <button onClick={() => reset()}>Попробовать снова</button>{' '}
        <Link className="btn secondary" href="/">
          К обзору
        </Link>
      </div>
    </div>
  );
}
