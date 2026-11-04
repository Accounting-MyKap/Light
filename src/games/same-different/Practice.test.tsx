import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { INTRO_MS } from './Game';
import { SameDifferentPractice } from './Practice';

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
      <SameDifferentPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip };
}

const click = (name: string) => act(() => screen.getByRole('button', { name }).click());
// Keys and time go through act() on the fake clock: React has drawn the new round and moved the key handler on to it
// before the next line runs. Waiting on the real clock instead races React, and loses when the machine is busy.
const key = (k: string) => fireEvent.keyDown(window, { key: k });
const next = () => act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
const intro = () => act(() => void vi.advanceTimersByTime(INTRO_MS));

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('step 0 shows the star with the buttons off, then asks the first question', () => {
  setup();
  expect(screen.getByText('Recuérdala')).toBeInTheDocument();
  expect(screen.getByTestId('symbol')).toHaveAttribute('data-symbol', 'star');
  expect(screen.getByRole('button', { name: 'Sí' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
  intro();
  expect(screen.getByText('¿Es igual a la anterior?')).toBeInTheDocument();
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sí' })).toBeEnabled();
});

test('answering yes, no, yes completes once', () => {
  const { onComplete } = setup();
  intro();
  ['Sí', 'No', 'Sí'].forEach((name, i) => {
    expect(screen.getByText(`Práctica ${i + 1} de 3`)).toBeInTheDocument();
    click(name);
    expect(screen.getByText('¡Bien!')).toBeInTheDocument();
    next();
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('the guide walks through the three questions', () => {
  setup();
  intro();
  click('Sí');
  next();
  expect(screen.getByText('¿Y esta?')).toBeInTheDocument();
  expect(screen.getByTestId('symbol')).toHaveAttribute('data-symbol', 'heart');
  click('No');
  next();
  expect(screen.getByText('Compara siempre con la que vino justo antes')).toBeInTheDocument();
  expect(screen.getByTestId('symbol')).toHaveAttribute('data-symbol', 'heart');
});

test('a wrong answer in round 2 hints and keeps the round', () => {
  setup();
  intro();
  click('Sí');
  next();
  click('Sí');
  expect(screen.getByText('Antes había una estrella y ahora un corazón: es distinto')).toBeInTheDocument();
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  expect(screen.getByTestId('symbol')).toHaveAttribute('data-symbol', 'heart');
});

test('the arrow keys do nothing in step 0, then ← is No and → is Yes', () => {
  setup();
  key('ArrowRight');
  expect(screen.queryByText('¡Bien!')).not.toBeInTheDocument();
  intro();
  key('ArrowRight');
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
  next();
  // Round 2 is up, so the «¡Bien!» below can only come from ←.
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  key('ArrowLeft');
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
});

test('skip works during step 0', () => {
  const { onSkip } = setup();
  click('Saltar práctica');
  expect(onSkip).toHaveBeenCalledTimes(1);
});
