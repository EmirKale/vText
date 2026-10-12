import type { AppSettings } from '../../../shared/types';

type ThemePref = AppSettings['theme'];

/** Resolve a theme preference, toggle the `dark` class, and sync native caption buttons. */
export function applyTheme(pref: ThemePref): boolean {
  const isDark =
    pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
  (window as any).kalem?.window?.setTheme?.(isDark);
  return isDark;
}

export function isDarkActive(): boolean {
  return document.documentElement.classList.contains('dark');
}
