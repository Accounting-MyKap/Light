import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import type { GameProps } from '../types';
import { StarShowerGame } from './Game';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
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
