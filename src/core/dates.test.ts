import { addDays, daysBetween, localDay } from './dates';

test('localDay uses local time', () => {
  expect(localDay(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
  expect(localDay(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
});

test.each([
  ['2026-12-31', 1, '2027-01-01'],
  ['2026-03-01', -1, '2026-02-28'],
  ['2024-03-01', -1, '2024-02-29'],
  ['2026-03-08', 1, '2026-03-09'],
  ['2026-11-01', 1, '2026-11-02'],
  ['2026-10-18', -6, '2026-10-12'],
])('addDays(%s, %d) = %s', (d, n, e) => {
  expect(addDays(d, n)).toBe(e);
});

test('daysBetween', () => {
  expect(daysBetween('2026-10-18', '2026-10-20')).toBe(2);
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  expect(daysBetween('2026-10-20', '2026-10-18')).toBe(-2);
});
