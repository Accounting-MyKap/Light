import { render, screen } from '@testing-library/react';
import { StarShowerExample } from './Example';

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

afterEach(() => setReducedMotion(null));

const scene = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-animated]');

test('the example moves, and stays still with reduced motion', () => {
  setReducedMotion(false);
  const moving = render(<StarShowerExample />);
  expect(scene(moving.container)).toHaveAttribute('data-animated', 'true');
  expect(moving.container.querySelectorAll('[data-comet="false"]')).toHaveLength(2);
  expect(moving.container.querySelectorAll('[data-comet="true"]')).toHaveLength(1);
  expect(screen.getByText('7 + 5')).toBeInTheDocument();
  expect(screen.getByText('4 + 3')).toBeInTheDocument();
  expect(screen.getByText('6 + 2')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  moving.unmount();

  setReducedMotion(true);
  const still = render(<StarShowerExample />);
  expect(scene(still.container)).toHaveAttribute('data-animated', 'false');
});

test('when the browser cannot tell about motion preferences nothing moves either', () => {
  const { container } = render(<StarShowerExample />);
  expect(scene(container)).toHaveAttribute('data-animated', 'false');
});
