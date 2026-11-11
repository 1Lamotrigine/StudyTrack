import Link from 'next/link';
import { query } from '@/lib/db';
import type { PageContext } from '@/lib/types';
import { Field } from '@/app/components';
import { EmptyState, PageHeader, Badge } from '@/components/ui';
import { Icon } from '@/components/icon';
import { formatDate } from '@/lib/format';
export async function SearchPage({ user, sp }: PageContext) {
  const q = (sp.q || '').trim().slice(0, 200);
  const rows = q
    ? await query(
        `SELECT a.id,a.course_id,a.title,a.description,a.due_at,a.max_score,a.expected_minutes,c.title course_title,
 ts_rank(a.search_vector,websearch_to_tsquery('russian',$1)) rank FROM assignments a JOIN courses c ON c.id=a.course_id
 WHERE (a.search_vector @@ websearch_to_tsquery('russian',$1) OR a.title ILIKE $2 OR c.title ILIKE $2)
 AND (c.status<>'draft' OR c.teacher_id=$3 OR $4='admin') ORDER BY rank DESC,a.title LIMIT 50`,
        [q, '%' + q + '%', user.id, user.role],
      )
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Найдётся нужное"
        title="Поиск заданий"
        description="Ищите по названию, описанию или курсу. Можно ввести часть слова."
      />
      <form className="filter-bar">
        <div className="search-field">
          <Field name="q" label="Что ищем?" value={q} required={false} />
        </div>
        <button>
          <Icon name="search" size={16} />
          Найти
        </button>
      </form>
      {!q ? (
        <div className="card">
          <EmptyState
            title="Знания ближе, чем кажется"
            description="Введите тему, название задания или курса. Например: SQL, Python или анализ данных."
            icon="search"
          />
        </div>
      ) : rows.length ? (
        <>
          <p className="filter-count">
            Результаты для «{q}»: {rows.length}
            {rows.length === 50 ? ' (первые 50)' : ''}
          </p>
          {rows.map((a) => (
            <article className="assignment-card" key={a.id}>
              <span className="course-symbol">
                <Icon name="file" />
              </span>
              <div className="assignment-content">
                <h3>{a.title}</h3>
                <p className="description">{a.description}</p>
                <p>
                  {a.course_title} · {formatDate(a.due_at, true)} · {a.max_score} баллов
                  {a.expected_minutes ? ` · ${a.expected_minutes} мин.` : ''}
                </p>
              </div>
              <Link className="btn secondary small" href={`/courses/${a.course_id}`}>
                К курсу
                <Icon name="arrow" size={13} />
              </Link>
            </article>
          ))}
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Ничего не нашлось"
            description="Попробуйте сократить запрос или использовать другое слово."
            icon="search"
          />
        </div>
      )}
    </>
  );
}
