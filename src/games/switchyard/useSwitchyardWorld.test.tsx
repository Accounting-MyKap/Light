import { act, render, screen } from '@testing-library/react';
import { createRng } from '../../core/rng';
import { initI18n } from '../../i18n';
import { createSwitchyardGame } from './engine';
import { WorldBoard, type World } from './useSwitchyardWorld';

beforeEach(async () => {
  await initI18n('es');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const still = (): World => ({
  game: createSwitchyardGame(1, createRng(1), 0),
  smoke: { puffs: [], lastEmit: new Map() },
  arrivals: [],
});

/** A ResizeObserver that reports only when a test says so, like a browser that has not laid out yet. */
function stubResizeObserver() {
  const observers: Array<{ report: (width: number, height: number) => void }> = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          report: (width, height) =>
            callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver),
        });
      }
      observe() {}
      disconnect() {}
    },
  );
  return observers;
}

function boxOf(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  });
}

test('the board has its fitted width from the first render, before the ResizeObserver reports', () => {
  const observers = stubResizeObserver();
  // A wide, short game zone (a computer, a phone on its side): the height limits the board.
  boxOf(600, 400);
  render(<WorldBoard world={still()} onToggle={() => {}} reducedMotion />);
  const board = screen.getByRole('group', { name: 'Mapa de vías' });
  expect(board.style.width).toBe(`${Math.floor((400 * 360) / 600)}px`);

  // Later sizes still come from the observer.
  act(() => observers[0].report(200, 1000));
  expect(board.style.width).toBe('200px');
});

test('without a size yet, the board takes the width of its box until the observer reports one', () => {
  const observers = stubResizeObserver();
  boxOf(0, 0);
  render(<WorldBoard world={still()} onToggle={() => {}} reducedMotion />);
  const board = screen.getByRole('group', { name: 'Mapa de vías' });
  expect(board.style.width).toBe('');
  act(() => observers[0].report(300, 600));
  expect(board.style.width).toBe('300px');
});
