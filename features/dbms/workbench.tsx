'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import type {
  Catalog,
  DbObject,
  HistoryEntry,
  ObjectDetails,
  QueryTab,
  Snippet,
  SqlResponse,
  SqlResult,
  DbColumn,
} from './types';
import { DbIcon } from './icons';
import { SqlEditor, type EditorHandle } from './editor';
import { Explorer } from './explorer';
import { ResultGrid, download, type CellEdit } from './results';
import { ObjectInspector } from './object-inspector';
import { ExplainPlan } from './plan';
import { SchemaDiagram } from './diagram';
import { EditDialog } from './edit-dialog';
import { qualified, quoteIdentifier } from '@/lib/dbms/sql';
import './workbench.css';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
type Pane = 'query' | 'properties' | 'sql' | 'diagram' | 'dashboard';
type Output = 'data' | 'messages' | 'plan' | 'history';
type EditState = {
  oid: number;
  columns: DbColumn[];
  initial: Record<string, string | null>;
  keys: Record<string, string | null>;
  operation: 'insert' | 'update';
  title: string;
};
export function Workbench({
  user,
  snippets,
}: {
  user: { id: number; full_name: string };
  snippets: Snippet[];
}) {
  const initial = snippets.find((s) => s.id === 'starter')?.sql || 'SELECT * FROM public.courses;';
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: 'initial', name: 'Query-1.sql', sql: initial },
  ]);
  const [active, setActive] = useState('initial');
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selected, setSelected] = useState<DbObject | null>(null);
  const [details, setDetails] = useState<ObjectDetails | null>(null);
  const [objectLoading, setObjectLoading] = useState(false);
  const [pane, setPane] = useState<Pane>('query');
  const [output, setOutput] = useState<Output>('data');
  const [responses, setResponses] = useState<Record<string, SqlResponse>>({});
  const [resultIndex, setResultIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const [help, setHelp] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('');
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState({ line: 1, column: 1, selected: false });
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [dataContext, setDataContext] = useState<{
    tabId: string;
    details: ObjectDetails;
    sql: string;
  } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const editor = useRef<EditorHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectionRequest = useRef(0);
  const current = tabs.find((t) => t.id === active) || tabs[0];
  const currentRef = useRef(current);
  currentRef.current = current;
  const response = responses[current.id];
  const result = response?.results[Math.min(resultIndex, (response?.results.length || 1) - 1)];
  const editable = !!(
    dataContext &&
    dataContext.tabId === current.id &&
    dataContext.sql === current.sql &&
    result?.fields.length &&
    dataContext.details.object.kind === 'table' &&
    dataContext.details.columns.some((c) => c.primary) &&
    result.fields.every((f) => f.tableID === dataContext.details.object.oid)
  );
  const storeKey = `studytrack:dbms:${user.id}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
      if (saved && Array.isArray(saved.tabs)) {
        const valid = saved.tabs
          .filter(
            (t: QueryTab) =>
              typeof t.id === 'string' &&
              typeof t.name === 'string' &&
              typeof t.sql === 'string' &&
              t.sql.length <= 300000,
          )
          .slice(0, 12);
        if (valid.length) {
          setTabs(valid);
          setActive(
            valid.some((t: QueryTab) => t.id === saved.active) ? saved.active : valid[0].id,
          );
        }
        if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 50));
      }
    } catch {}
    if (window.matchMedia('(max-width: 680px)').matches) setExplorerVisible(false);
    setReady(true);
  }, [storeKey]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storeKey, JSON.stringify({ tabs, active, history }));
      } catch {
        setError(
          'Черновики не удалось сохранить в браузере. Скачайте SQL-файл кнопкой сохранения.',
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [tabs, active, history, ready, storeKey]);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        setLibrary(false);
        setHelp(false);
      }
    };
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('keydown', key);
    };
  }, []);
  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch('/api/dbms', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось прочитать каталог');
      setCatalog(data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);
  function newTab(sql = '', name?: string) {
    if (tabs.length >= 12) {
      setError('Открыто 12 вкладок. Закройте одну, чтобы добавить новую.');
      return;
    }
    const id = uid();
    setTabs((old) => [...old, { id, name: name || `Query-${old.length + 1}.sql`, sql }]);
    setActive(id);
    setPane('query');
    setOutput('data');
    setResultIndex(0);
    setMenu(null);
    return id;
  }
  function closeTab(tab: QueryTab) {
    if (busy === tab.id) return;
    if (
      tab.sql.trim() &&
      !window.confirm(`Закрыть «${tab.name}»? Если запрос ещё нужен, сначала сохраните его в файл.`)
    )
      return;
    if (tabs.length === 1) {
      const id = uid();
      setTabs([{ id, name: 'Query-1.sql', sql: '' }]);
      setActive(id);
      return;
    }
    const rest = tabs.filter((t) => t.id !== tab.id);
    setTabs(rest);
    if (active === tab.id) setActive(rest.at(-1)!.id);
  }
  async function loadObject(object: DbObject) {
    const request = ++selectionRequest.current;
    setSelected(object);
    setObjectLoading(true);
    try {
      const response = await fetch(`/api/dbms?oid=${object.oid}&kind=${object.kind}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (request === selectionRequest.current) setDetails(data as ObjectDetails);
      return data as ObjectDetails;
    } catch (error) {
      setError((error as Error).message);
    } finally {
      if (request === selectionRequest.current) setObjectLoading(false);
    }
  }
  async function selectObject(object: DbObject) {
    setPane('properties');
    await loadObject(object);
  }
  async function run(override?: string, mode: SqlResponse['mode'] = 'execute', targetId?: string) {
    if (busy) return;
    const id = targetId || currentRef.current.id;
    const sql = override ?? (editor.current?.selection() || currentRef.current.sql);
    if (!sql.trim()) {
      setError('Введите SQL-запрос или выберите пример из библиотеки.');
      editor.current?.focus();
      return;
    }
    if (
      mode === 'analyze' &&
      !window.confirm(
        'EXPLAIN ANALYZE действительно выполняет запрос, включая изменения данных. Продолжить?',
      )
    )
      return;
    setBusy(id);
    setError('');
    setPane('query');
    setResultIndex(0);
    setOutput(mode === 'explain' || mode === 'analyze' ? 'plan' : 'data');
    try {
      const http = await fetch('/api/dbms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, mode }),
      });
      const data = await http.json();
      const result: SqlResponse = http.ok
        ? data
        : {
            results: [],
            messages: [`ERROR: ${data.error}`],
            error: { message: data.error, code: data.code, detail: data.detail, hint: data.hint },
            duration: 0,
            rolledBack: false,
            mode,
          };
      setResponses((old) => ({ ...old, [id]: result }));
      if (result.error) setOutput('messages');
      else if (
        !result.results.some((r) => r.fields.length) &&
        mode !== 'explain' &&
        mode !== 'analyze'
      )
        setOutput('messages');
      const lastData = result.results.findLastIndex((r) => r.fields.length > 0);
      if (lastData >= 0) setResultIndex(lastData);
      setHistory((old) =>
        [
          {
            id: uid(),
            sql,
            at: new Date().toISOString(),
            duration: result.duration,
            rows: result.results.reduce((n, r) => n + r.rowCount, 0),
            success: !result.error,
            mode,
          },
          ...old,
        ].slice(0, 50),
      );
      void refreshCatalog();
    } catch (error) {
      setError((error as Error).message || 'Соединение прервано.');
    } finally {
      setBusy(null);
    }
  }
  async function openObject(object: DbObject) {
    const d = await loadObject(object);
    if (!d) return;
    if (['table', 'view', 'materialized_view'].includes(object.kind)) {
      const keys = d.columns.filter((c) => c.primary);
      const sql = `SELECT * FROM ${qualified(object.schema, object.name)}${keys.length ? '\nORDER BY ' + keys.map((c) => quoteIdentifier(c.name)).join(', ') : ''}\nLIMIT 2000;`;
      const id = newTab(sql, object.name + ' · данные');
      if (!id) return;
      setDataContext({ tabId: id, details: d, sql });
      await run(sql, 'execute', id);
    } else newTab(d.definition, object.name + '.sql');
  }
  function saveFile() {
    download(
      currentRef.current.name.endsWith('.sql')
        ? currentRef.current.name
        : currentRef.current.name + '.sql',
      currentRef.current.sql,
      'application/sql;charset=utf-8',
    );
    setMenu(null);
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 600000) {
      setError('Файл слишком большой. Максимум — 600 КБ.');
      return;
    }
    const text = await file.text();
    if (text.length > 300000) {
      setError('В файле больше 300 000 символов.');
      return;
    }
    newTab(text, file.name);
    if (input.current) input.current.value = '';
  }
  function setSql(value: string) {
    setTabs((old) => old.map((t) => (t.id === active ? { ...t, sql: value } : t)));
  }
  function getKeys(row: (string | null)[]) {
    const context = dataContext!;
    return Object.fromEntries(
      context.details.columns
        .filter((c) => c.primary)
        .map((c) => [c.name, row[result!.fields.findIndex((f) => f.name === c.name)]]),
    );
  }
  function editCell(cell: CellEdit) {
    if (!dataContext || !result) return;
    const name = result.fields[cell.column].name;
    const column = dataContext.details.columns.find((c) => c.name === name)!;
    setEdit({
      oid: dataContext.details.object.oid,
      columns: [column],
      initial: { [name]: cell.row[cell.column] },
      keys: getKeys(cell.row),
      operation: 'update',
      title: `Изменить ${dataContext.details.object.name}.${name}`,
    });
  }
  async function apiEdit(payload: unknown) {
    const response = await fetch('/api/dbms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`${data.error}${data.detail ? '\n' + data.detail : ''}`);
    return data;
  }
  async function saveEdit(values: Record<string, string | null>) {
    if (!edit || !dataContext) return;
    setEditBusy(true);
    try {
      await apiEdit({
        action: 'edit',
        operation: edit.operation,
        oid: edit.oid,
        keys: edit.keys,
        values,
        original: edit.operation === 'update' ? edit.initial : undefined,
      });
      setEdit(null);
      await run(dataContext.sql);
    } finally {
      setEditBusy(false);
    }
  }
  async function deleteRow(row: (string | null)[]) {
    if (
      !dataContext ||
      busy ||
      !window.confirm(
        'Удалить выбранную строку из базы? Ограничения внешних ключей и триггеры продолжат действовать.',
      )
    )
      return;
    try {
      await apiEdit({
        action: 'edit',
        operation: 'delete',
        oid: dataContext.details.object.oid,
        keys: getKeys(row),
      });
      await run(dataContext.sql);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const actions: Record<string, { label: string; icon: string; fn: () => void }[]> = {
    Файл: [
      { label: 'Новый запрос', icon: 'add', fn: () => newTab() },
      { label: 'Открыть SQL-файл…', icon: 'open', fn: () => input.current?.click() },
      { label: 'Сохранить SQL-файл', icon: 'save', fn: saveFile },
    ],
    Правка: [
      { label: 'Отменить', icon: 'undo', fn: () => editor.current?.undo() },
      { label: 'Повторить', icon: 'redo', fn: () => editor.current?.redo() },
      { label: 'Найти / заменить', icon: 'search', fn: () => editor.current?.search() },
      { label: 'Переключить комментарий', icon: 'code', fn: () => editor.current?.comment() },
    ],
    Вид: [
      {
        label: explorerVisible ? 'Скрыть обозреватель' : 'Показать обозреватель',
        icon: 'menu',
        fn: () => setExplorerVisible((v) => !v),
      },
      { label: 'Обзор базы', icon: 'database', fn: () => setPane('dashboard') },
      { label: 'ER-диаграмма', icon: 'link', fn: () => setPane('diagram') },
      {
        label: 'Полноэкранный режим',
        icon: 'expand',
        fn: () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
        },
      },
    ],
    Инструменты: [
      { label: 'Выполнить SQL', icon: 'play', fn: () => void run() },
      { label: 'Пробный запуск с откатом', icon: 'undo', fn: () => void run(undefined, 'preview') },
      { label: 'EXPLAIN', icon: 'explain', fn: () => void run(undefined, 'explain') },
      { label: 'Библиотека запросов', icon: 'code', fn: () => setLibrary(true) },
      { label: 'Обновить каталог', icon: 'refresh', fn: () => void refreshCatalog() },
    ],
    Помощь: [{ label: 'Как пользоваться консолью', icon: 'help', fn: () => setHelp(true) }],
  };
  return (
    <div className="dbms">
      <header className="db-brandbar">
        <Link href="/" title="Вернуться в StudyTrack">
          <DbIcon name="back" size={16} />
          <strong>StudyTrack</strong>
          <span>SQL Workspace</span>
        </Link>
        <div className="db-connection">
          <span className="db-online-dot" />
          <span className="db-connection-state">{catalog ? 'Подключено' : 'Подключение…'}</span>
          <span className="db-connection-sep">/</span>
          <span className="db-engine">PGlite · PostgreSQL</span>
        </div>
        <div className="db-user">
          {user.full_name}
          <ThemeToggle />
        </div>
      </header>
      <div className="db-menubar" ref={menuRef}>
        {Object.keys(actions).map((name) => (
          <div className="db-menu" key={name}>
            <button
              aria-expanded={menu === name}
              onClick={() => setMenu(menu === name ? null : name)}
            >
              {name}
            </button>
            {menu === name && (
              <div className="db-menu-popup" role="menu">
                {actions[name].map((a) => (
                  <button
                    role="menuitem"
                    key={a.label}
                    onClick={() => {
                      setMenu(null);
                      a.fn();
                    }}
                  >
                    <DbIcon name={a.icon} />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <span className="db-menubar-context">
          <DbIcon name="database" size={12} />
          StudyTrack / {catalog?.database.name || '…'} / public
        </span>
      </div>
      {error && (
        <div className="db-top-error" role="alert">
          <DbIcon name="alert" />
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Закрыть сообщение">
            <DbIcon name="close" />
          </button>
        </div>
      )}
      <div className="db-work-area">
        {explorerVisible && (
          <Explorer
            catalog={catalog}
            details={details}
            selected={selected}
            onSelect={(o) => void selectObject(o)}
            onQuery={(o) => void openObject(o)}
            onRefresh={() => void refreshCatalog()}
            loading={catalogLoading}
          />
        )}
        <div className="db-main">
          <nav className="db-workspace-tabs" aria-label="Рабочие панели">
            <button
              className="db-explorer-toggle"
              title="Показать / скрыть обозреватель"
              onClick={() => setExplorerVisible((v) => !v)}
            >
              <DbIcon name="menu" />
            </button>
            {(
              [
                ['query', 'code', 'Query Tool'],
                ['dashboard', 'database', 'Обзор'],
                ['properties', 'table', 'Свойства'],
                ['sql', 'code', 'SQL / DDL'],
                ['diagram', 'link', 'ER-диаграмма'],
              ] as [Pane, string, string][]
            ).map(([id, icon, title]) => (
              <button className={pane === id ? 'active' : ''} key={id} onClick={() => setPane(id)}>
                <DbIcon name={icon} size={14} />
                {title}
              </button>
            ))}
          </nav>
          {pane === 'query' ? (
            <>
              <div className="db-query-tabs">
                {tabs.map((t) => (
                  <div key={t.id} className={t.id === current.id ? 'active' : ''}>
                    <button
                      onClick={() => {
                        setActive(t.id);
                        setResultIndex(0);
                      }}
                    >
                      <DbIcon name={dataContext?.tabId === t.id ? 'table' : 'code'} size={13} />
                      {t.name}
                      {busy === t.id && <span className="db-mini-spinner" />}
                    </button>
                    <button
                      aria-label={`Закрыть ${t.name}`}
                      title="Закрыть вкладку"
                      disabled={busy === t.id}
                      onClick={() => closeTab(t)}
                    >
                      <DbIcon name="close" size={12} />
                    </button>
                  </div>
                ))}
                <button
                  title="Новый SQL-запрос"
                  aria-label="Новый SQL-запрос"
                  onClick={() => newTab()}
                >
                  <DbIcon name="add" size={17} />
                </button>
              </div>
              <div className="db-query-toolbar">
                <div>
                  <button
                    title="Открыть SQL-файл"
                    aria-label="Открыть SQL-файл"
                    onClick={() => input.current?.click()}
                  >
                    <DbIcon name="open" />
                  </button>
                  <button
                    title="Сохранить SQL · Ctrl/Cmd+S"
                    aria-label="Сохранить SQL-файл"
                    onClick={saveFile}
                  >
                    <DbIcon name="save" />
                  </button>
                </div>
                <div>
                  <button
                    title="Отменить · Ctrl/Cmd+Z"
                    aria-label="Отменить правку"
                    onClick={() => editor.current?.undo()}
                  >
                    <DbIcon name="undo" />
                  </button>
                  <button
                    title="Повторить"
                    aria-label="Повторить правку"
                    onClick={() => editor.current?.redo()}
                  >
                    <DbIcon name="redo" />
                  </button>
                  <button
                    title="Найти / заменить · Ctrl/Cmd+F"
                    aria-label="Поиск в SQL"
                    onClick={() => editor.current?.search()}
                  >
                    <DbIcon name="search" />
                  </button>
                </div>
                <div>
                  <button
                    className="db-execute"
                    disabled={!!busy || !ready}
                    onClick={() => void run()}
                    title="Выполнить выделение или весь скрипт · Ctrl/Cmd+Enter / F5"
                  >
                    {busy ? <span className="db-mini-spinner" /> : <DbIcon name="play" size={14} />}
                    Выполнить<kbd>⌘ ↵</kbd>
                  </button>
                  <button
                    title="Выполнить SQL в транзакции и откатить изменения"
                    disabled={!!busy}
                    onClick={() => void run(undefined, 'preview')}
                  >
                    <DbIcon name="undo" size={14} />С откатом
                  </button>
                </div>
                <div>
                  <button
                    disabled={!!busy}
                    onClick={() => void run(undefined, 'explain')}
                    title="План без выполнения запроса"
                  >
                    <DbIcon name="explain" size={14} />
                    EXPLAIN
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() => void run(undefined, 'analyze')}
                    title="План с фактическим выполнением запроса"
                  >
                    ANALYZE
                  </button>
                </div>
                <button className="db-library-button" onClick={() => setLibrary(true)}>
                  <DbIcon name="code" size={14} />
                  Примеры SQL<span>{snippets.length}</span>
                </button>
              </div>
              <div className="db-editor-panel">
                <div className="db-editor-label">
                  <span>
                    <DbIcon name="code" size={13} />
                    {cursor.selected ? 'Выполнится выделенный фрагмент' : 'SQL Editor'}
                  </span>
                  <span>UTF-8 · PostgreSQL · черновик в браузере</span>
                </div>
                <SqlEditor
                  ref={editor}
                  value={current.sql}
                  catalog={catalog}
                  onChange={setSql}
                  onExecute={() => void run()}
                  onSave={saveFile}
                  onCursor={(line, column, selected) => setCursor({ line, column, selected })}
                />
              </div>
              <div className="db-result-panel">
                <nav className="db-output-tabs" aria-label="Вывод SQL">
                  {(
                    [
                      ['data', 'table', 'Данные'],
                      ['messages', 'code', 'Сообщения'],
                      ['plan', 'explain', 'План выполнения'],
                      ['history', 'history', 'История'],
                    ] as [Output, string, string][]
                  ).map(([id, icon, title]) => (
                    <button
                      className={output === id ? 'active' : ''}
                      key={id}
                      onClick={() => setOutput(id)}
                    >
                      <DbIcon name={icon} size={13} />
                      {title}
                      {id === 'messages' && response?.error && <span className="db-error-dot" />}
                      {id === 'history' && <small>{history.length}</small>}
                    </button>
                  ))}
                  <span className="db-execution-duration">
                    {busy
                      ? 'Выполняется…'
                      : response
                        ? `${response.error ? 'Ошибка' : 'Готово'} · ${response.duration} ms`
                        : ''}
                  </span>
                </nav>
                {output === 'data' ? (
                  response?.results.some((r) => r.fields.length) ? (
                    <>
                      {response.results.length > 1 && (
                        <div className="db-result-picker">
                          <label>
                            Результат
                            <select
                              value={resultIndex}
                              onChange={(e) => setResultIndex(Number(e.target.value))}
                            >
                              {response.results.map((r, i) => (
                                <option key={i} value={i}>
                                  {i + 1}. {r.command}{' '}
                                  {r.fields.length ? `· ${r.fields.length} столбцов` : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          {response.rolledBack && <span>Изменения откачены</span>}
                        </div>
                      )}
                      {result?.fields.length ? (
                        <ResultGrid
                          result={result}
                          catalog={catalog}
                          details={editable ? dataContext!.details : null}
                          editable={editable && !busy && !editBusy}
                          onEdit={editCell}
                          onInsert={() => {
                            if (dataContext)
                              setEdit({
                                oid: dataContext.details.object.oid,
                                columns: dataContext.details.columns.filter(
                                  (c) => !c.primary && !c.identity && !c.generated,
                                ),
                                initial: {},
                                keys: {},
                                operation: 'insert',
                                title: `Добавить строку в ${dataContext.details.object.name}`,
                              });
                          }}
                          onDelete={(row) => void deleteRow(row)}
                        />
                      ) : (
                        <div className="db-empty-panel">
                          <DbIcon name="check" size={28} />
                          <h3>{result?.command || 'Команда выполнена'}</h3>
                          <p>Эта команда не возвращает таблицу данных.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="db-empty-panel">
                      <span className="db-empty-symbol">
                        <DbIcon name="play" size={28} />
                      </span>
                      <h3>{busy ? 'Выполняем запрос…' : 'Готово к вашему первому запросу'}</h3>
                      <p>
                        Напишите SQL выше и нажмите <kbd>Ctrl / ⌘ + Enter</kbd>.<br />
                        Результаты появятся здесь. Изменения выполняются в базе StudyTrack.
                      </p>
                      <button onClick={() => setLibrary(true)}>
                        Выбрать учебный пример
                        <DbIcon name="chevron" size={13} />
                      </button>
                    </div>
                  )
                ) : output === 'messages' ? (
                  <div className="db-messages" role="log">
                    {response ? (
                      <>
                        {response.messages.map((m, i) => (
                          <div
                            className={
                              m.startsWith('ERROR')
                                ? 'db-message-error'
                                : m.startsWith('ROLLBACK')
                                  ? 'db-message-notice'
                                  : ''
                            }
                            key={i}
                          >
                            {m}
                          </div>
                        ))}
                        {response.error && (
                          <div className="db-error-details">
                            <strong>{response.error.message}</strong>
                            {response.error.code && <p>SQLSTATE: {response.error.code}</p>}
                            {response.error.detail && <p>DETAIL: {response.error.detail}</p>}
                            {response.error.hint && <p>HINT: {response.error.hint}</p>}
                            {response.error.line && (
                              <button
                                onClick={() =>
                                  editor.current?.selectError(response.error!.position!)
                                }
                              >
                                Строка {response.error.line}, столбец {response.error.column} ·
                                перейти к ошибке
                              </button>
                            )}
                          </div>
                        )}
                        <p className="db-message-time">
                          Query complete · {response.duration} ms
                          {response.rolledBack ? ' · ROLLBACK' : ''}
                        </p>
                      </>
                    ) : (
                      <p>Здесь появятся команды, уведомления PostgreSQL и подробности ошибок.</p>
                    )}
                  </div>
                ) : output === 'plan' ? (
                  <ExplainPlan response={response} />
                ) : (
                  <div className="db-history">
                    {history.length ? (
                      <>
                        <div className="db-history-heading">
                          <span>Последние 50 запусков · хранятся только в этом браузере</span>
                          <button
                            onClick={() =>
                              download(
                                'studytrack-history.sql',
                                history
                                  .map(
                                    (h) =>
                                      `-- ${h.at} | ${h.success ? 'OK' : 'ERROR'} | ${h.duration} ms\n${h.sql}`,
                                  )
                                  .join('\n\n'),
                                'application/sql;charset=utf-8',
                              )
                            }
                          >
                            <DbIcon name="download" size={14} />
                            Экспорт
                          </button>
                        </div>
                        {history.map((h) => (
                          <article key={h.id}>
                            <div>
                              <span className={h.success ? 'db-history-ok' : 'db-history-error'}>
                                {h.success ? 'OK' : 'ERROR'}
                              </span>
                              <time>{new Date(h.at).toLocaleString('ru-RU')}</time>
                              <span>
                                {h.duration} ms · {h.rows} строк · {h.mode}
                              </span>
                              <button
                                title="Открыть запрос из истории"
                                onClick={() => newTab(h.sql)}
                              >
                                <DbIcon name="open" size={14} />В редактор
                              </button>
                            </div>
                            <pre>{h.sql}</pre>
                          </article>
                        ))}
                      </>
                    ) : (
                      <div className="db-empty-panel">
                        <DbIcon name="history" size={30} />
                        <h3>История пока пуста</h3>
                        <p>После выполнения запросы сохранятся здесь.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : pane === 'properties' ? (
            <ObjectInspector
              details={details}
              loading={objectLoading}
              onQuery={(o) => void openObject(o)}
              onSql={(sql, name) => newTab(sql, name)}
            />
          ) : pane === 'sql' ? (
            <div className="db-sql-definition">
              <div className="db-panel-heading">
                <span>{selected ? `${selected.schema}.${selected.name}` : 'SQL / DDL'}</span>
                {details && (
                  <button onClick={() => newTab(details.definition, details.object.name + '.sql')}>
                    <DbIcon name="code" size={14} />
                    Открыть в редакторе
                  </button>
                )}
              </div>
              {details ? (
                <pre className="db-source">{details.definition}</pre>
              ) : (
                <div className="db-empty-panel">
                  <DbIcon name="code" size={34} />
                  <h3>Определение объекта</h3>
                  <p>
                    Выберите объект слева. Его структура будет прочитана из каталога PostgreSQL.
                  </p>
                </div>
              )}
            </div>
          ) : pane === 'diagram' ? (
            <SchemaDiagram catalog={catalog} onSelect={(o) => void selectObject(o)} />
          ) : (
            <div className="db-dashboard">
              <div className="db-dashboard-intro">
                <div className="db-dashboard-logo">
                  <DbIcon name="database" size={35} />
                </div>
                <div>
                  <span>Database dashboard</span>
                  <h1>StudyTrack</h1>
                  <p>Одна база. Настоящий PostgreSQL. Ваши SQL-запросы.</p>
                </div>
              </div>
              <div className="db-dashboard-stats">
                {[
                  ['Таблицы', catalog?.database.tables],
                  ['Представления', catalog?.database.views],
                  ['Функции и процедуры', catalog?.database.functions],
                  ['Размер базы', catalog?.database.size],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <strong>{value ?? '—'}</strong>
                  </div>
                ))}
              </div>
              <section>
                <h2>Подключение</h2>
                <dl>
                  <div>
                    <dt>База PostgreSQL</dt>
                    <dd>{catalog?.database.name}</dd>
                  </div>
                  <div>
                    <dt>Пользователь PostgreSQL</dt>
                    <dd>{catalog?.database.user}</dd>
                  </div>
                  <div>
                    <dt>Движок</dt>
                    <dd>PGlite · встроенный, без TCP-порта</dd>
                  </div>
                  <div>
                    <dt>Версия</dt>
                    <dd>{catalog?.database.version}</dd>
                  </div>
                  <div>
                    <dt>Режим</dt>
                    <dd>Рабочая база приложения · изменения сохраняются</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>Начните с запроса</h2>
                <div className="db-dashboard-links">
                  <button
                    onClick={() => {
                      setPane('query');
                      editor.current?.focus();
                    }}
                  >
                    <DbIcon name="play" />
                    Открыть SQL-редактор
                  </button>
                  <button onClick={() => setLibrary(true)}>
                    <DbIcon name="code" />
                    Учебные запросы Q01–Q16
                  </button>
                  <button onClick={() => setPane('diagram')}>
                    <DbIcon name="link" />
                    Схема и связи таблиц
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
      <footer className="db-statusbar">
        <span>
          <i className="db-online-dot" />
          {catalog ? `${catalog.database.name} @ PGlite` : 'Подключаемся…'}
        </span>
        <span>SQL: {catalog?.database.user || '…'}</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span>{response?.rolledBack ? 'ROLLBACK' : busy ? 'RUNNING' : 'READY'}</span>
        <span className="db-status-note">Одна сессия · 2 000 строк на результат</span>
      </footer>
      <input
        type="file"
        accept=".sql,text/plain,application/sql"
        ref={input}
        hidden
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      {library && (
        <div className="db-modal-backdrop">
          <section
            className="db-modal db-library-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-library-title"
          >
            <header>
              <div>
                <span>StudyTrack / учебная коллекция</span>
                <h2 id="db-library-title">Библиотека SQL-запросов</h2>
              </div>
              <button aria-label="Закрыть библиотеку" onClick={() => setLibrary(false)}>
                <DbIcon name="close" />
              </button>
            </header>
            <div className="db-library-search">
              <DbIcon name="search" />
              <input
                autoFocus
                placeholder="Поиск по теме: JOIN, JSONB, транзакции…"
                aria-label="Поиск учебного запроса"
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
              />
            </div>
            <div className="db-library-list">
              {snippets
                .filter((s) =>
                  (s.title + s.category + s.description)
                    .toLowerCase()
                    .includes(libraryFilter.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      newTab(s.sql, s.id + '.sql');
                      setLibrary(false);
                    }}
                  >
                    <span className="db-snippet-id">{s.id}</span>
                    <span>
                      <small>{s.category}</small>
                      <strong>{s.title}</strong>
                      <p>{s.description}</p>
                    </span>
                    <DbIcon name="chevron" size={16} />
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="db-modal-backdrop">
          <section
            className="db-modal db-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-help-title"
          >
            <header>
              <h2 id="db-help-title">SQL Workspace</h2>
              <button aria-label="Закрыть помощь" onClick={() => setHelp(false)}>
                <DbIcon name="close" />
              </button>
            </header>
            <div className="db-help-content">
              <p>
                Полноценная SQL-консоль для базы StudyTrack. Интерфейс вдохновлён pgAdmin 4; запросы
                исполняет серверная PGlite приложения.
              </p>
              <h3>Редактор</h3>
              <dl>
                <div>
                  <dt>Ctrl / ⌘ + Enter · F5</dt>
                  <dd>Выполнить выделение или весь скрипт</dd>
                </div>
                <div>
                  <dt>Ctrl / ⌘ + S</dt>
                  <dd>Сохранить SQL-файл</dd>
                </div>
                <div>
                  <dt>Ctrl + Space</dt>
                  <dd>Автодополнение SQL и объектов базы</dd>
                </div>
                <div>
                  <dt>Ctrl / ⌘ + F</dt>
                  <dd>Поиск и замена</dd>
                </div>
              </dl>
              <h3>Транзакции и изменения</h3>
              <p>
                Обычное выполнение сохраняет изменения. Для транзакционного сценария пишите BEGIN и
                COMMIT/ROLLBACK в одном запуске. Незавершённая транзакция автоматически
                откатывается, потому что соединение общее для приложения. «С откатом» выполняет
                скрипт в транзакции без сохранения изменений. EXPLAIN не выполняет запрос; ANALYZE
                выполняет.
              </p>
              <h3>Объекты и данные</h3>
              <p>
                Двойной щелчок по таблице открывает её данные. В этой вкладке можно добавлять
                строки, удалять их и менять обычные поля двойным щелчком. Таблицы без первичного
                ключа, ключевые и вычисляемые поля редактируйте через SQL.
              </p>
              <h3>Границы PGlite</h3>
              <p>
                Здесь один встроенный PostgreSQL, без отдельного сервера и нескольких соединений.
                dblink, демонстрации deadlock между сеансами, интерактивные команды psql и COPY
                STDIN/STDOUT не поддерживаются. На результат передаётся максимум 2 000 строк.
                Таймаут SQL установлен в 15 секунд; работа движка занимает общее соединение.
                Параметры сессии восстанавливаются после запуска.
              </p>
              <p>
                DDL таблиц собирается из каталога; отдельные триггеры и функции доступны как
                самостоятельные объекты. Черновики и история сохраняются только в браузере.
              </p>
              <a
                href="https://www.pgadmin.org/docs/pgadmin4/latest/query_tool.html"
                target="_blank"
                rel="noreferrer"
              >
                Референс: pgAdmin 4 Query Tool ↗
              </a>
            </div>
          </section>
        </div>
      )}
      {edit && (
        <EditDialog
          title={edit.title}
          columns={edit.columns}
          initial={edit.initial}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
          busy={editBusy}
        />
      )}
    </div>
  );
}
