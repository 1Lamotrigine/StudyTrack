import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Field, Form } from '@/app/components';
import { ThemeToggle } from '@/components/theme-toggle';
import { Icon } from '@/components/icon';
export const dynamic = 'force-dynamic';
export default async function Login() {
  if (await currentUser()) redirect('/');
  return (
    <div className="login-page">
      <div className="public-theme">
        <ThemeToggle />
      </div>
      <section className="login-story">
        <div className="brand">
          <span className="logo">
            <Icon name="book" />
          </span>
          StudyTrack<span className="brand-dot">.</span>
        </div>
        <div>
          <div className="eyebrow">Ваш следующий шаг</div>
          <h1>Знания становятся результатом.</h1>
          <p>
            Курсы, работы и обратная связь — в одном пространстве. Сосредоточьтесь на том, что
            важно.
          </p>
        </div>
        <small>Учиться. Создавать. Двигаться вперёд.</small>
      </section>
      <section className="login-content">
        <div className="login-form">
          <div className="eyebrow">Рады видеть вас снова</div>
          <h2>Вход в пространство</h2>
          <p className="lead">Продолжите с того места, где остановились.</p>
          <Form op="login" back="/login">
            <Field name="login" label="Логин" />
            <Field name="password" label="Пароль" type="password" />
          </Form>
          <details className="login-demo">
            <summary>Попробовать демоверсию</summary>
            <table>
              <thead>
                <tr>
                  <th>Роль</th>
                  <th>Логин / пароль</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Студент', 'student'],
                  ['Преподаватель', 'teacher'],
                  ['Администратор', 'admin'],
                ].map(([label, role]) => (
                  <tr key={role}>
                    <td>{label}</td>
                    <td>
                      <code>{role}</code> / <code>{role}123</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </section>
    </div>
  );
}
