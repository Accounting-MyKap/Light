import { act, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { createRng } from '../../core/rng';
import { initI18n } from '../../i18n';
import { useGameClock } from '../shared/clock';
import { advanceSwitchyard, createSwitchyardGame } from './engine';
import { PUFF_LIFE_MS, puffLook } from './smoke';
import { WorldBoard, useSwitchyardWorld, type World } from './useSwitchyardWorld';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
  // Before the real timers come back: a stub put over a fake timer would otherwise outlive it.
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** No reduced motion asked for, so the yard lets its smoke out (jsdom has no matchMedia: no motion at all). */
function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/** A phone that draws a frame every `ms` milliseconds. */
function framesEvery(ms: number) {
  vi.stubGlobal('requestAnimationFrame', (draw: FrameRequestCallback) => setTimeout(() => draw(Date.now()), ms));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
}

/** The yard as the game runs it: a level-1 game on the game clock, which stops with the loop in the pause. */
function renderYard() {
  return renderHook(
    ({ paused }) => {
      const clock = useGameClock(paused);
      const [rng] = useState(() => createRng(3));
      return useSwitchyardWorld(() => createSwitchyardGame(1, rng, 0), {
        active: !paused,
        now: () => clock.now(),
        advance: (game, to) => advanceSwitchyard(game, to, rng),
        onArrival: () => {},
      });
    },
    { initialProps: { paused: false } },
  );
}

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

test('the smoke rises while the yard runs, and its puffs hold still in the pause', () => {
  allowMotion();
  const { result, rerender } = renderYard();
  expect(result.current.reducedMotion).toBe(false);
  advance(1600); // the first train came out at 1 s
  const look = () => result.current.world.smoke.puffs.map((p) => puffLook(p, result.current.world.game.now));
  expect(look().length).toBeGreaterThan(3);

  rerender({ paused: true });
  const held = look();
  advance(2000);
  expect(look()).toEqual(held);

  rerender({ paused: false });
  advance(100);
  expect(look()).not.toEqual(held);
});

test('with smooth frames the yard never turns lite and keeps its smoke', () => {
  allowMotion();
  const { result } = renderYard();
  advance(6000);
  expect(result.current.lite).toBe(false);
  const now = result.current.world.game.now;
  expect(result.current.world.smoke.puffs.some((p) => p.born > now - 100)).toBe(true);
});

test('on a slow phone the yard turns lite after about 2 s: no new smoke, and the puffs out fade away', () => {
  allowMotion();
  framesEvery(40);
  const { result } = renderYard();
  advance(1600);
  expect(result.current.lite).toBe(false);
  expect(result.current.world.smoke.puffs.length).toBeGreaterThan(0);

  advance(1000);
  expect(result.current.lite).toBe(true);
  const decidedBy = result.current.world.game.now;
  advance(500);
  const { puffs } = result.current.world.smoke;
  expect(puffs.length).toBeGreaterThan(0);
  expect(puffs.every((p) => p.born <= decidedBy)).toBe(true);
  advance(PUFF_LIFE_MS);
  expect(result.current.world.smoke.puffs).toEqual([]);
  expect(result.current.lite).toBe(true);
});
