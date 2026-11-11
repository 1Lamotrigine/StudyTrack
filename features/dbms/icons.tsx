const paths: Record<string, string> = {
  database:
    'M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Z M4 6v12c0 2.2 3.6 4 8 4s8-1.8 8-4V6 M4 12c0 2.2 3.6 4 8 4s8-1.8 8-4',
  table: 'M3 3h18v18H3z M3 9h18 M9 9v12 M3 15h18',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  function: 'M8 21l5-18h5 M7 10h10',
  procedure: 'M8 3h8v18H8z M4 7h4 M16 7h4 M4 17h4 M16 17h4',
  index: 'M4 4h16v16H4z M9 4v16 M13 8h4 M13 12h4 M13 16h4',
  trigger: 'M13 2L3 14h8l-1 8 11-13h-9z',
  sequence: 'M4 7h5 M4 12h5 M4 17h5 M14 7h6 M17 4v6 M14 17h6',
  schema: 'M3 5h7l2 3h9v13H3z',
  chevron: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  play: 'M7 3l14 9-14 9z',
  add: 'M12 4v16 M4 12h16',
  close: 'M6 6l12 12 M6 18L18 6',
  save: 'M4 3h14l3 3v15H3V3z M7 3v7h10V3 M7 21v-7h10v7',
  open: 'M3 7V4h7l3 3h8v13H3z M3 11h18',
  refresh: 'M20 7a9 9 0 1 0 1 9 M20 3v5h-5',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  undo: 'M3 10h11a6 6 0 0 1 0 12 M8 5l-5 5 5 5',
  redo: 'M21 10H10a6 6 0 0 0 0 12 M16 5l5 5-5 5',
  explain: 'M5 4h14v4H5z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
  history: 'M3 3v6h6 M3 9a9 9 0 1 1 0 6 M12 7v5l4 2',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  copy: 'M8 8h13v13H8z M16 8V3H3v13h5',
  key: 'M15 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M13 12l8 8 M17 16l3-3 M19 18l3-3',
  column: 'M7 3h10v18H7z M7 8h10 M7 13h10 M7 18h10',
  back: 'M20 12H4 M10 6l-6 6 6 6',
  help: 'M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3 M12 18v1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  expand: 'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5',
  code: 'M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 2l-4 20',
  check: 'M4 12l5 5L20 5',
  alert: 'M12 3L2 21h20z M12 9v5 M12 17v1',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  edit: 'M14 4l6 6 M3 21l5-1L21 7l-5-5L3 15z',
  link: 'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2',
  menu: 'M3 5h18 M3 12h18 M3 19h18',
};
export function DbIcon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.table} />
    </svg>
  );
}
