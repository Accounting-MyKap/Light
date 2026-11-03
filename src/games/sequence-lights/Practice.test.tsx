import { act, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { GAP_MS, SHOW_MS } from './engine';
import { HINT_MS, SequenceLightsPractice } from './Practice';

vi.mock('../../core/sound');
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: () => ({ ...actual.DEFAULT_SETTINGS, sound: false, haptics: false }) };
});

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const view = render(
    <FeedbackProvider>
      <SequenceLightsPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip, view };
}

const STEP = SHOW_MS + GAP_MS;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const showTime = (length: number) => advance(length * STEP);
const tap = (n: number) => act(() => screen.getByRole('button', { name: `Casilla ${n}` }).click());
const isLit = (n: number) => screen.getByRole('button', { name: `Casilla ${n}` }).getAttribute('data-lit') === 'true';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('round 1 shows its two cells in order, then asks for them', () => {
  setup();
  expect(screen.getByText('Mira qué casillas se encienden…')).toBeInTheDocument();
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
  advance(0);
  expect(isLit(2)).toBe(true);
  advance(SHOW_MS);
  expect(isLit(2)).toBe(false);
  advance(GAP_MS);
  expect(isLit(6)).toBe(true);
  advance(STEP);
  expect(screen.getByText('Ahora tócalas en el mismo orden')).toBeInTheDocument();
});

test('tapping cells 2 and 6 after the show gets the first round right', () => {
  setup();
  showTime(2);
  tap(2);
  tap(6);
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
  expect(isLit(2) && isLit(6)).toBe(true);
});

test('a tap during the show does not count', () => {
  setup();
  advance(STEP);
  tap(6);
  tap(2);
  showTime(1);
  expect(screen.getByText('Ahora tócalas en el mismo orden')).toBeInTheDocument();
  expect(screen.queryByText('Casi. Mira otra vez')).not.toBeInTheDocument();
  tap(2);
  tap(6);
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
});

test('three right rounds complete once, and round 3 says the sequence grows', () => {
  const { onComplete } = setup();
  showTime(2);
  tap(2);
  tap(6);
  advance(PRACTICE_NEXT_MS);
  showTime(3);
  tap(7);
  tap(5);
  tap(3);
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Si aciertas, la secuencia se alarga')).toBeInTheDocument();
  showTime(4);
  [1, 5, 9, 6].forEach(tap);
  expect(onComplete).not.toHaveBeenCalled();
  advance(PRACTICE_NEXT_MS);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('a wrong tap in round 2 shows the hint, then replays from the first cell', () => {
  const { onComplete } = setup();
  showTime(2);
  tap(2);
  tap(6);
  advance(PRACTICE_NEXT_MS);
  showTime(3);
  tap(7);
  tap(1);
  expect(screen.getByText('Casi. Mira otra vez')).toBeInTheDocument();
  tap(5); // ignored while the hint shows
  advance(HINT_MS);
  expect(screen.getByText('Mira qué casillas se encienden…')).toBeInTheDocument();
  advance(0);
  expect(isLit(7)).toBe(true);
  showTime(3);
  tap(7);
  tap(5);
  tap(3);
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
});

test('skipping mid-sequence leaves no timer running', () => {
  const { onSkip, view } = setup();
  advance(STEP);
  act(() => screen.getByRole('button', { name: 'Saltar práctica' }).click());
  expect(onSkip).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
