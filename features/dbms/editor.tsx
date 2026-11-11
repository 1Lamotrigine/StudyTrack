'use client';
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  toggleComment,
  undo,
  redo,
} from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import {
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Catalog } from './types';
export type EditorHandle = {
  selection: () => string;
  focus: () => void;
  search: () => void;
  undo: () => void;
  redo: () => void;
  comment: () => void;
  selectError: (position: number) => void;
};
export const SqlEditor = forwardRef<
  EditorHandle,
  {
    value: string;
    catalog: Catalog | null;
    onChange: (value: string) => void;
    onExecute: () => void;
    onSave: () => void;
    onCursor: (line: number, column: number, selected: boolean) => void;
  }
>(function SqlEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const theme = useRef(new Compartment());
  const language = useRef(new Compartment());
  useImperativeHandle(
    ref,
    () => ({
      selection: () => {
        const v = view.current;
        return v?.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to) || '';
      },
      focus: () => view.current?.focus(),
      search: () => {
        if (view.current) openSearchPanel(view.current);
      },
      undo: () => {
        if (view.current) undo(view.current);
      },
      redo: () => {
        if (view.current) redo(view.current);
      },
      comment: () => {
        if (view.current) toggleComment(view.current);
      },
      selectError: (position) => {
        const v = view.current;
        if (v) {
          const pos = Math.min(
            v.state.doc.length,
            Array.from(v.state.doc.toString())
              .slice(0, position - 1)
              .join('').length,
          );
          v.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
          v.focus();
        }
      },
    }),
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    const dark = () => document.documentElement.dataset.theme === 'dark';
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: callbacks.current.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          language.current.of(sql({ dialect: PostgreSQL })),
          theme.current.of(dark() ? oneDark : []),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                callbacks.current.onExecute();
                return true;
              },
            },
            {
              key: 'F5',
              run: () => {
                callbacks.current.onExecute();
                return true;
              },
            },
            {
              key: 'Mod-s',
              run: () => {
                callbacks.current.onSave();
                return true;
              },
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...closeBracketsKeymap,
          ]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'SQL-редактор', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const selection = update.state.selection.main;
              const line = update.state.doc.lineAt(selection.head);
              callbacks.current.onCursor(
                line.number,
                selection.head - line.from + 1,
                !selection.empty,
              );
            }
          }),
        ],
      }),
    });
    view.current = editor;
    const observer = new MutationObserver(() =>
      editor.dispatch({ effects: theme.current.reconfigure(dark() ? oneDark : []) }),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
      editor.destroy();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== props.value)
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: props.value } });
  }, [props.value]);
  useEffect(() => {
    if (!view.current || !props.catalog) return;
    const schema: Record<string, Record<string, readonly string[]>> = {};
    for (const o of props.catalog.objects)
      if (['table', 'view', 'materialized_view'].includes(o.kind)) {
        schema[o.schema] ??= {};
        schema[o.schema][o.name] = props.catalog.columns
          .filter((c) => c.oid === o.oid)
          .map((c) => c.name);
      }
    view.current.dispatch({
      effects: language.current.reconfigure(
        sql({ dialect: PostgreSQL, schema, defaultSchema: 'public', upperCaseKeywords: true }),
      ),
    });
  }, [props.catalog]);
  return <div className="db-editor" ref={host} />;
});
