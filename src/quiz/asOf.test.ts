import { asOfLabel } from './asOf';

test('labels a YYYY-MM month in the player language', () => {
  expect(asOfLabel('2026-11', 'es')).toBe('noviembre de 2026');
  expect(asOfLabel('2026-11', 'en')).toBe('November 2026');
  expect(asOfLabel('2025-01', 'es')).toBe('enero de 2025');
  expect(asOfLabel('2025-12', 'en')).toBe('December 2025');
});

test('returns null for anything that is not a real month', () => {
  for (const bad of ['2026-13', '2026-00', '2026-1', '11-2026', '2026-11-02', '2026/11', '', 'nov 2026']) {
    expect(asOfLabel(bad, 'es'), bad).toBeNull();
  }
});
