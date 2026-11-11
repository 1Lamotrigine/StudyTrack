'use client';
import { Icon } from './icon';

export const THEME_STORAGE_KEY = 'studytrack:theme';

export function ThemeToggle() {
  function toggle() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      <span className="theme-to-dark">
        <Icon name="moon" size={17} />
        Тёмная тема
      </span>
      <span className="theme-to-light">
        <Icon name="sun" size={17} />
        Светлая тема
      </span>
    </button>
  );
}
