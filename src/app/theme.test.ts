import { applyTheme } from './theme';

test('applyTheme', () => {
  applyTheme('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  applyTheme('auto');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});
