export type ThemeSetting = 'auto' | 'light' | 'dark';

export function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
}
