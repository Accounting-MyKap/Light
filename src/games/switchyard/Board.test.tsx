import { render } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { Board } from './Board';
import { mapFor } from './maps';

const MAP = mapFor(3, false);
const PUFFS = [{ id: 'a', x: 180, y: 80, r: 5, opacity: 0.5 }];

beforeEach(async () => {
  await initI18n('es');
  // jsdom has no 2D canvas; the board copes with a missing context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});
afterEach(() => vi.restoreAllMocks());

test('the smoke is drawn on a canvas, and not at all with reduced motion', () => {
  const board = (reducedMotion: boolean) => (
    <Board map={MAP} switches={[0, 0]} trains={[]} puffs={PUFFS} onToggle={() => undefined} reducedMotion={reducedMotion} />
  );
  const { container, rerender } = render(board(false));
  expect(container.querySelectorAll('canvas')).toHaveLength(1);
  expect(container.querySelectorAll('circle[fill$="-puff)"]')).toHaveLength(0);

  rerender(board(true));
  expect(container.querySelectorAll('canvas')).toHaveLength(0);
  expect(container.querySelectorAll('circle[fill$="-puff)"]')).toHaveLength(0);
});

test('every switch gets its button', () => {
  const { container } = render(<Board map={MAP} switches={[0, 1]} trains={[]} onToggle={() => undefined} />);
  expect([...container.querySelectorAll<HTMLButtonElement>('[data-switch]')].map((b) => b.dataset.option)).toEqual([
    '0',
    '1',
  ]);
});
