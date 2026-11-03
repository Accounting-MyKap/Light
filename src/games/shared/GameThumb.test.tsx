import { render } from '@testing-library/react';
import { GAMES } from '../registry';

test.each(GAMES.map((g) => [g.id, g] as const))('%s thumbnail is decorative', (_id, g) => {
  const { container } = render(<g.Thumb />);
  const root = container.firstElementChild!;
  expect(root.getAttribute('aria-hidden')).toBe('true');
  expect(root.getAttribute('data-area')).toBe(g.area);
  expect(root.querySelector('svg')).not.toBeNull();
});
