import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Field, Form } from '@/app/components';
import { ThemeToggle } from '@/components/theme-toggle';
import { Icon } from '@/components/icon';
export const dynamic = 'force-dynamic';
export default async function Login() {
  if (await currentUser()) redirect('/');
  return (
    <div className="login-page study-ui">
      <div className="public-theme">
        <ThemeToggle />
      </div>
      <main className="login-content">
        <div className="login-form">
          <div className="brand">
            <span className="logo">
              <Icon name="book" />
            </span>
            StudyTrack
          </div>
          <h1>Вход в StudyTrack</h1>
          <Form op="login" back="/login">
            <Field name="login" label="Логин" />
            <Field name="password" label="Пароль" type="password" />
          </Form>
        </div>
      </main>
    </div>
  );
}
