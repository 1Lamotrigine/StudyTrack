'use client';
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
import { mutate } from '@/app/actions';
import type { ActionState } from '@/lib/types';
import type { Row } from '@/lib/db';
import { Icon } from './icon';
const StateContext = createContext<ActionState>({});
const names: Record<string, string> = {
  logout: 'Выйти',
  login: 'Войти в пространство',
  submit: 'Отправить работу',
  grade: 'Сохранить оценку',
  toggle_user: 'Изменить доступ',
  archive: 'Архивировать курс',
  drop: 'Отчислить',
  enroll: 'Зачислить',
  create_user: 'Создать пользователя',
};
function SubmitButton({
  op,
  confirm,
  disabled,
}: {
  op: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={['archive', 'drop', 'toggle_user'].includes(op) ? 'danger-button' : ''}
      aria-label={op === 'logout' ? 'Выйти' : undefined}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {op === 'logout' ? (
        <Icon name="logout" size={18} />
      ) : pending ? (
        <>
          <span className="spinner" />
          Сохраняем…
        </>
      ) : (
        <>
          {names[op] || 'Сохранить изменения'}
          <Icon name={op === 'submit' ? 'arrow' : 'check'} size={16} />
        </>
      )}
    </button>
  );
}
export function Form({
  op,
  back,
  id,
  children,
  disabled = false,
}: {
  op: string;
  back: string;
  id?: number;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(mutate, {});
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);
  const confirm =
    op === 'archive'
      ? 'Архивировать курс? Новые работы и зачисления будут недоступны.'
      : op === 'drop'
        ? 'Отчислить студента? Его работы и оценки сохранятся.'
        : op === 'toggle_user'
          ? 'Изменить доступ пользователя? Его текущие сессии завершатся.'
          : undefined;
  return (
    <StateContext.Provider value={state}>
      <form action={action} className={`action-form form-${op}`}>
        <input type="hidden" name="op" value={op} />
        <input type="hidden" name="back" value={back} />
        {id != null && <input type="hidden" name="id" value={id} />}
        {state.error && (
          <div className="alert error" role="alert" tabIndex={-1} ref={alertRef}>
            {state.error}
          </div>
        )}
        {children}
        <div className="form-actions">
          <SubmitButton op={op} confirm={confirm} disabled={disabled} />
        </div>
      </form>
    </StateContext.Provider>
  );
}
export function Field({
  name,
  label,
  value = '',
  type = 'text',
  required = true,
  min,
  max,
  hint,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const state = useContext(StateContext);
  const val = state.values?.[name] ?? value;
  return (
    <label className="field">
      {label}
      {!required && <span className="optional"> · необязательно</span>}
      {type === 'textarea' ? (
        <textarea
          name={name}
          key={state.error ? val : 'initial'}
          defaultValue={val}
          required={required}
          maxLength={100000}
        />
      ) : (
        <input
          name={name}
          key={state.error ? val : 'initial'}
          type={type}
          defaultValue={type === 'password' ? '' : val}
          required={required}
          min={min}
          max={max}
          step={type === 'number' ? 'any' : undefined}
          autoComplete={
            name === 'login' ? 'username' : type === 'password' ? 'current-password' : undefined
          }
        />
      )}
      {hint && <small className="field-help">{hint}</small>}
    </label>
  );
}
export function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string | number;
  options: Row[];
}) {
  const state = useContext(StateContext);
  const val = state.values?.[name] ?? value ?? '';
  return (
    <label className="field">
      {label}
      <select name={name} key={state.error ? val : 'initial'} defaultValue={val}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title ?? o.full_name ?? o.id}
          </option>
        ))}
      </select>
    </label>
  );
}
export function DraftEditor({
  assignmentId,
  userId,
  versionCount,
}: {
  assignmentId: number;
  userId: number;
  versionCount: number;
}) {
  const key = `studytrack:draft:${userId}:${assignmentId}:${versionCount}`;
  const [body, setBody] = useState('');
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const { values } = useContext(StateContext);
  useEffect(() => {
    try {
      setBody(sessionStorage.getItem(key) || '');
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (values?.body) setBody(values.body);
  }, [values]);
  function change(text: string) {
    setBody(text);
    try {
      sessionStorage.setItem(key, text);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  return (
    <div>
      <label className="field">
        Текст работы
        <textarea
          name="body"
          value={body}
          onChange={(e) => change(e.target.value)}
          required
          maxLength={100000}
          disabled={!ready}
          placeholder="Опишите решение, добавьте код или ссылку на результат…"
          className="draft-editor"
        />
      </label>
      <div className="editor-meta">
        <span>
          {saved ? 'Черновик сохранён в этой вкладке' : 'Черновик доступен до закрытия вкладки'}
        </span>
        <span>{body.length.toLocaleString('ru-RU')} символов</span>
      </div>
    </div>
  );
}
