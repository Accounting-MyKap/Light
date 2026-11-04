import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRng } from '../../core/rng';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import type { GameProps } from '../types';
import { formatProblem } from '../shared/arithmetic';
import { StarShowerGame } from './Game';
import { advance as advanceEngine, createStarShower } from './engine';

// The game seeds its random numbers with randomSeed(); the comet tests make it return a seed known to bring a comet.
const seed = vi.hoisted(() => ({ value: null as number | null }));
vi.mock('../../core/rng', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../core/rng')>();
  return { ...real, randomSeed: () => seed.value ?? real.randomSeed() };
});

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  seed.value = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

/** How far down the sky a star or a burst is, in % (0 at the top, 100 on the horizon): what its rail is moved by. */
function heightOf(el: HTMLElement): number {
  const transform = el.closest<HTMLElement>('[data-rail]')?.style.transform ?? '';
  const match = /^translateY\((.+)%\)$/.exec(transform);
  if (!match) throw new Error(`Not on a rail moved down the sky: «${transform}»`);
  return Number(match[1]);
}

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function ui({ paused = false, onFinish = vi.fn() }: Partial<GameProps> = {}) {
  return (
    <FeedbackProvider>
      <StarShowerGame startLevel={1} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>
  );
}

function renderGame(props: Partial<GameProps> = {}) {
  const result = render(ui(props));
  return { ...result, setPaused: (paused: boolean) => result.rerender(ui({ ...props, paused })) };
}

/** The answer of a level 1 star: «a + b». */
function solve(text: string): number {
  const [a, op, b] = text.split(' ');
  if (op !== '+') throw new Error(`Not a level 1 sum: «${text}»`);
  return Number(a) + Number(b);
}

test('a star appears and falls', () => {
  renderGame();
  advance(50);
  const star = screen.getByTestId('star');
  const top0 = heightOf(star);
  advance(4500);
  expect(heightOf(star)).toBeGreaterThan(top0 + 40); // about 50 % of the sky at 4.5 s
});

test('typing the answer on the keyboard pops the star and scores 11', () => {
  renderGame();
  advance(50);
  for (const d of String(solve(screen.getByTestId('star').textContent!))) fireEvent.keyDown(window, { key: d });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(hud('Puntos')).toBe('11');
  expect(screen.queryAllByTestId('star')).toHaveLength(0);
});

test('the on-screen keypad answers too', () => {
  renderGame();
  advance(50);
  for (const d of String(solve(screen.getByTestId('star').textContent!))) {
    fireEvent.click(screen.getByRole('button', { name: d }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(hud('Puntos')).toBe('11');
  expect(screen.queryAllByTestId('star')).toHaveLength(0);
});

test('a wrong number keeps the score, empties the slot and marks it wrong', () => {
  renderGame();
  advance(50);
  const before = screen.getByTestId('answer').dataset.wrong;
  for (const d of String(solve(screen.getByTestId('star').textContent!) + 1)) fireEvent.keyDown(window, { key: d });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(hud('Puntos')).toBe('0');
  expect(screen.getByTestId('answer').textContent).toBe('?');
  expect(screen.getByTestId('answer').dataset.wrong).not.toBe(before);
  expect(screen.queryAllByTestId('star')).toHaveLength(1);
});

test('paused: stars stop and no new ones are born', () => {
  const { setPaused } = renderGame();
  advance(1000);
  setPaused(true);
  const star = screen.getByTestId('star');
  const top = heightOf(star);
  const count = screen.getAllByTestId('star').length;

  advance(10_000);
  expect(heightOf(star)).toBe(top);
  expect(screen.getAllByTestId('star')).toHaveLength(count);

  setPaused(false);
  advance(1000);
  expect(star).toBeInTheDocument();
  const moved = heightOf(star);
  expect(moved).toBeGreaterThan(top);
  expect(moved).toBeLessThan(top + 15); // about 11 % of the sky in a second, from where it stopped
});

test('three lost stars end the game once, one second after the third', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(9100);
  expect(screen.getByRole('list', { name: 'Vidas: 2 de 3' })).toBeInTheDocument();
  advance(60_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 0, accuracy: 0, levelReached: 1 });
  expect(onFinish.mock.calls[0][0].durationMs).toBeCloseTo(29_463.6, 0);
});

// Review Focus #4
test('pausing during the last second delays the end until resumed', () => {
  const onFinish = vi.fn();
  const { setPaused } = renderGame({ onFinish });
  // The third star lands at 29 464 ms of game time; the end is due one second later.
  advance(29_600);
  expect(screen.getByRole('list', { name: 'Vidas: 0 de 3' })).toBeInTheDocument();
  expect(onFinish).not.toHaveBeenCalled();

  setPaused(true);
  advance(5000);
  expect(onFinish).not.toHaveBeenCalled();

  setPaused(false);
  advance(1100);
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('the sky is hidden from screen readers, the answer slot is not', () => {
  renderGame();
  advance(50);
  expect(screen.getByTestId('star').closest('[aria-hidden="true"]')).not.toBeNull();
  expect(screen.getByTestId('horizon').closest('[aria-hidden="true"]')).not.toBeNull();
  expect(screen.getByTestId('answer').closest('[aria-hidden="true"]')).toBeNull();
});

test('a lost star fades out where it touched the horizon, even with reduced motion', () => {
  renderGame(); // jsdom has no matchMedia, so this is reduced motion: no flash on the horizon
  advance(50);
  const lane = screen.getByTestId('star').dataset.lane;
  advance(9000);
  expect(screen.getByTestId('horizon').querySelector('[data-sky-flash]')).toBeNull();
  // A burst resting on the horizon (height 1) in its lane; the cleared stars fade higher up.
  const fading = Array.from(document.querySelectorAll<HTMLElement>('[data-kind="clear"]'));
  expect(fading.some((burst) => burst.dataset.lane === lane && heightOf(burst) === 100)).toBe(true);
  expect(screen.queryAllByTestId('star')).toHaveLength(0);
});

test('with full motion, a lost star lights the horizon in its lane for a moment', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  renderGame();
  advance(50);
  const lane = screen.getByTestId('star').dataset.lane;
  advance(9000);
  const flash = screen.getByTestId('horizon').querySelector<HTMLElement>('[data-sky-flash="loss"]');
  expect(flash?.dataset.lane).toBe(lane);
  // The other stars on screen fade out as bursts, which are not live stars.
  expect(screen.queryAllByTestId('star')).toHaveLength(0);
  advance(600);
  expect(screen.getByTestId('horizon').querySelector('[data-sky-flash]')).toBeNull();
});

/**
 * Finds, with the pure engine, a seed whose second star is a comet while the first one (born at 0, falling for 9 s)
 * is still on screen, and the game time to look at it: the first moment, in steps of 100 ms, when both are there.
 * About 10 % of seeds qualify, so the search is short; the bound only guards against the engine changing.
 */
function findCometSeed(): { seed: number; at: number } {
  for (let candidate = 1; candidate <= 2000; candidate++) {
    const rng = createRng(candidate);
    let state = createStarShower(1, rng);
    for (let at = 0; at <= 8000; at += 100) {
      state = advanceEngine(state, at, rng).state;
      if (state.stars.length >= 2 && state.stars.some((star) => star.comet)) return { seed: candidate, at };
    }
  }
  throw new Error('No seed in 1..2000 brings a comet with another star on screen: has the engine changed?');
}

/** Starts a game with a comet and another star on screen, and plays it up to that moment. */
function renderCometGame() {
  const found = findCometSeed();
  seed.value = found.seed;
  const result = renderGame();
  advance(found.at + 50);
  const comet = screen.getAllByTestId('star').find((el) => el.dataset.comet === 'true') as HTMLElement;
  return { ...result, comet };
}

const typeAnswer = (text: string) => {
  for (const d of String(solve(text))) fireEvent.keyDown(window, { key: d });
};

describe('the comet', () => {
  test('solving the comet pops every star and scores each one', () => {
    const { comet } = renderCometGame();
    const live = screen.getAllByTestId('star').length;
    expect(live).toBeGreaterThanOrEqual(2);

    typeAnswer(comet.textContent!);
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.queryAllByTestId('star')).toHaveLength(0);
    // Level 1: each popped star is worth 10 + 1.
    expect(hud('Puntos')).toBe(String(live * 11));
    expect(document.querySelectorAll('[data-kind="pop"]')).toHaveLength(live);
  });

  test('the comet shows a gold flash over the sky', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { comet } = renderCometGame();
    expect(document.querySelector('[data-sky-flash]')).toBeNull();
    typeAnswer(comet.textContent!);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(document.querySelector('[data-sky-flash="comet"]')).not.toBeNull();
    advance(700);
    expect(document.querySelector('[data-sky-flash]')).toBeNull();
  });

  test('with reduced motion the comet pops the sky with no flash', () => {
    const { comet } = renderCometGame(); // jsdom has no matchMedia: reduced motion
    typeAnswer(comet.textContent!);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryAllByTestId('star')).toHaveLength(0);
    expect(document.querySelector('[data-sky-flash]')).toBeNull();
  });

  test("a comet's text is exactly its operation", () => {
    const { comet } = renderCometGame();
    expect(comet.textContent).toMatch(/^\d+ [+−×÷] \d+$/);
    // Same operation as the engine drew for it (formatProblem), with nothing else in the star.
    const rng = createRng(seed.value!);
    const state = advanceEngine(createStarShower(1, rng), 8000, rng).state;
    const star = state.stars.find((s) => s.comet);
    expect(star).toBeDefined();
    expect(comet.textContent).toBe(formatProblem(star!.problem));
  });
});

test('answers report their feedback kinds', () => {
  renderGame();
  advance(50);
  const flash = () => document.querySelector('[data-flash]')?.getAttribute('data-flash');
  const text = screen.getByTestId('star').textContent!;
  for (const d of String(solve(text) + 1)) fireEvent.keyDown(window, { key: d });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(flash()).toBe('wrong');

  typeAnswer(text);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(flash()).toBe('correct');
});
