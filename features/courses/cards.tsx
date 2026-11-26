import Link from 'next/link';
import type { Course, Role } from '@/lib/types';
import { Icon } from '@/components/icon';
import { Badge, Progress } from '@/components/ui';
import { plural } from '@/lib/format';
export function CourseCards({ courses, role }: { courses: Course[]; role: Role }) {
  return (
    <div className="course-grid">
      {courses.map((c) => {
        return (
          <Link href={`/courses/${c.id}`} className="course-card" key={c.id}>
            <div className="course-card-top">
              <span className="course-symbol">
                <Icon name="book" size={23} />
              </span>
              <span className="course-code">{c.code}</span>
            </div>
            <h3>{c.title}</h3>
            <p className="course-desc">{c.description || c.category_path}</p>
            <div className="course-meta">
              <span>
                <Icon name="file" size={13} />
                {plural(Number(c.assignments_count), ['задание', 'задания', 'заданий'])}
              </span>
              <span>
                <Icon name="users" size={13} />
                {c.students_count} студентов
              </span>
            </div>
            {role === 'student' && c.enrolled ? (
              <Progress
                value={(Number(c.completed_count) / Number(c.assignments_count)) * 100}
                label={`${c.completed_count} из ${c.assignments_count} сдано`}
              />
            ) : role === 'teacher' ? (
              <Badge status={Number(c.ungraded_count) > 0 ? 'pending' : 'active'}>
                {Number(c.ungraded_count) > 0
                  ? `${c.ungraded_count} работ ждут проверки`
                  : 'Все работы проверены'}
              </Badge>
            ) : (
              <Badge status={c.status} />
            )}
            <div className="course-bottom">
              <span className="teacher-name">
                <span className="avatar">
                  {c.teacher_name
                    .split(' ')
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join('')}
                </span>
                {c.teacher_name.split(' ').slice(0, 2).join(' ')}
              </span>
              <Icon name="arrow" size={16} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
