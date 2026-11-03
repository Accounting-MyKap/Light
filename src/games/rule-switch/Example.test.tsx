import { act, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { DEMO_RULE_MS, RuleSwitchExample } from './Example';

function setReducedMotion(reduce: boolean | null) {
  if (reduce === null) {
    Reflect.deleteProperty(window, 'matchMedia');
  } else {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({ matches: reduce })),
      configurable: true,
    });
  }
}

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  setReducedMotion(null);
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const banner = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-rule]');

test('the banner turns over between COLOR and FORMA in a loop, and the answer follows the rule', () => {
  const { container } = render(<RuleSwitchExample />);
  expect(banner(container)).toHaveTextContent('COLOR');
  expect(screen.getByText('Regla COLOR: la respuesta es el cuadrado azul.')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'cuadrado azul' }).className).toMatch(/chosen/);

  const first = banner(container);
  expect(first?.className).not.toMatch(/switched/);

  advance(DEMO_RULE_MS);
  expect(banner(container)).toHaveTextContent('FORMA');
  expect(banner(container)).not.toBe(first);
  expect(banner(container)?.className).toMatch(/switched/);
  expect(screen.getByText('Regla FORMA: la respuesta es el círculo naranja.')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'círculo naranja' }).className).toMatch(/chosen/);
  expect(screen.getByRole('img', { name: 'cuadrado azul' }).className).not.toMatch(/chosen/);

  advance(DEMO_RULE_MS);
  expect(banner(container)).toHaveTextContent('COLOR');
  expect(container.querySelectorAll('[data-rule]')).toHaveLength(1);
});

test('with reduced motion the banner stays on the first rule', () => {
  setReducedMotion(true);
  const { container } = render(<RuleSwitchExample />);
  advance(DEMO_RULE_MS * 3);
  expect(banner(container)).toHaveTextContent('COLOR');
  expect(banner(container)?.className).not.toMatch(/switched/);
});

test('when the browser cannot tell about motion preferences nothing turns either', () => {
  setReducedMotion(null);
  const { container } = render(<RuleSwitchExample />);
  advance(DEMO_RULE_MS * 3);
  expect(banner(container)).toHaveTextContent('COLOR');
});

test('the loop stops when the example goes away', () => {
  const { unmount } = render(<RuleSwitchExample />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
