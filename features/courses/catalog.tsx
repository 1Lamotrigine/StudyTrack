import Link from 'next/link';
import { Field, Select, statuses } from '@/app/components';
import type { PageContext } from '@/lib/types';
import { PageHeader, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icon';
import { getCourses } from './queries';
import { CourseCards } from './cards';
export async function Catalog({ user, sp }: PageContext) {
  const scope = sp.scope === 'mine' ? 'mine' : 'all';
  const status = ['active', 'archived', 'all'].includes(sp.status || '') ? sp.status! : 'active';
  const courses = await getCourses(user, { q: sp.q || '', scope, status });
  return (
    <>
      <PageHeader
        eyebrow="Пространство знаний"
        title="Курсы"
        description="Найдите свой курс и продолжите с того места, где остановились."
        action={
          user.role === 'admin' ? (
            <Link className="btn" href="/admin/courses/create">
              <Icon name="plus" size={16} />
              Создать курс
            </Link>
          ) : undefined
        }
      />
      <div className="tabs">
        <Link className={scope === 'all' ? 'active' : ''} href="/courses">
          Все курсы
        </Link>
        <Link className={scope === 'mine' ? 'active' : ''} href="/courses?scope=mine">
          Мои курсы
        </Link>
      </div>
      <form className="filter-bar">
        <input type="hidden" name="scope" value={scope} />
        <div className="search-field">
          <Field name="q" label="Поиск по курсам и преподавателям" value={sp.q} required={false} />
        </div>
        <Select
          name="status"
          label="Статус"
          value={status}
          options={[...statuses(['active', 'archived']), { id: 'all', title: 'Все статусы' }]}
        />
        <button>
          <Icon name="search" size={16} />
          Найти
        </button>
        {sp.q && (
          <Link className="btn secondary" href={`/courses?scope=${scope}`}>
            Сбросить
          </Link>
        )}
      </form>
      <p className="filter-count">Найдено курсов: {courses.length}</p>
      {courses.length ? (
        <CourseCards courses={courses} role={user.role} />
      ) : (
        <div className="card">
          <EmptyState
            title="Курсы не найдены"
            description="Попробуйте другой запрос или выберите все статусы."
            href="/courses"
            label="Сбросить фильтры"
            icon="search"
          />
        </div>
      )}
    </>
  );
}
