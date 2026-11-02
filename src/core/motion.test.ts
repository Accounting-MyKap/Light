import { prefersReducedMotion } from './motion';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('without matchMedia it assumes reduced motion', () => {
  vi.stubGlobal('matchMedia', undefined);
  expect(prefersReducedMotion()).toBe(true);
});

test('it follows the prefers-reduced-motion media query', () => {
  const matchMedia = vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
  vi.stubGlobal('matchMedia', matchMedia);
  expect(prefersReducedMotion()).toBe(true);
  expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  expect(prefersReducedMotion()).toBe(false);
});
