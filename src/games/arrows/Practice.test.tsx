import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { ArrowsPractice } from './Practice';

vi.mock('../../core/sound');
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: () => ({ ...actual.DEFAULT_SETTINGS, sound: false, haptics: false }) };
});

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  render(
    <FeedbackProvider>
      <ArrowsPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip };
}

const click = (name: string) => act(() => screen.getByRole('button', { name }).click());
// Keys and time go through act() on the fake clock: React has drawn the new round and moved the key handler on to it
// before the next line runs. Waiting on the real clock instead races React, and loses when the machine is busy.
const key = (k: string) => fireEvent.keyDown(window, { key: k });
const next = () => act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('answering the four rounds right completes once', () => {
  const { onComplete } = setup();
  const answers = ['Derecha', 'Izquierda', 'Derecha', 'Izquierda'];
  answers.forEach((name, i) => {
    expect(screen.getByText(`Práctica ${i + 1} de 4`)).toBeInTheDocument();
    click(name);
    expect(screen.getByText('¡Bien!')).toBeInTheDocument();
    next();
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('the guide explains the center, then the trick', () => {
  setup();
  expect(screen.getByText('Toca hacia dónde apunta la flecha del centro')).toBeInTheDocument();
  click('Derecha');
  next();
  click('Izquierda');
  next();
  expect(screen.getByText(/las de los lados quieren engañarte/)).toBeInTheDocument();
});

test('a wrong answer in round 3 hints the center and keeps the round', () => {
  setup();
  click('Derecha');
  next();
  click('Izquierda');
  next();
  click('Izquierda');
  expect(screen.getByText('La del centro apunta a la derecha')).toBeInTheDocument();
  expect(screen.getByTestId('arrows-row')).toHaveAttribute('data-direction', 'right');
  expect(screen.getByText('Práctica 3 de 4')).toBeInTheDocument();
});

test('the arrow keys answer like the buttons', () => {
  const { onComplete } = setup();
  key('ArrowRight');
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
  next();
  key('ArrowRight');
  expect(screen.getByText('La del centro apunta a la izquierda')).toBeInTheDocument();
});

test('skip calls onSkip', () => {
  const { onSkip } = setup();
  click('Saltar práctica');
  expect(onSkip).toHaveBeenCalledTimes(1);
});

test('the guide bubble is normal at first, hint after a wrong answer and ok after a right one', () => {
  setup();
  const tone = () => document.querySelector('[data-tone]')?.getAttribute('data-tone');
  expect(tone()).toBe('normal');
  click('Izquierda');
  expect(tone()).toBe('hint');
  click('Derecha');
  expect(tone()).toBe('ok');
});
