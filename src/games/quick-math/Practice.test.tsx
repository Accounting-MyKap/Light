import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { QuickMathPractice } from './Practice';

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
      <QuickMathPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip };
}

const click = (name: string) => act(() => screen.getByRole('button', { name }).click());
const type = (digits: string) => [...digits].forEach((d) => click(d));
const next = () => act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('typing 5 + OK, 3 + Enter, then Saltar completes once', async () => {
  vi.useRealTimers();
  const { onComplete } = setup();
  expect(screen.getByTestId('problem')).toHaveTextContent('2 + 3');
  expect(screen.getByText('Escribe el resultado y toca OK')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '5' }));
  await userEvent.click(screen.getByRole('button', { name: 'OK' }));
  await new Promise((r) => setTimeout(r, PRACTICE_NEXT_MS + 100));
  expect(screen.getByTestId('problem')).toHaveTextContent('7 − 4');
  await userEvent.keyboard('3{Enter}');
  await new Promise((r) => setTimeout(r, PRACTICE_NEXT_MS + 100));
  expect(screen.getByTestId('problem')).toHaveTextContent('6 × 7');
  expect(screen.getByText('Si una se te complica, puedes tocar Saltar')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Saltar' }));
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, PRACTICE_NEXT_MS + 100));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('a wrong answer in round 1 hints and clears the answer', () => {
  setup();
  type('6');
  expect(screen.getByTestId('answer')).toHaveTextContent('6');
  click('OK');
  expect(screen.getByText('Casi: 2 + 3 = 5. Inténtalo otra vez')).toBeInTheDocument();
  expect(screen.getByTestId('answer')).toHaveTextContent('?');
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
});

test('Saltar is only offered in round 3', () => {
  setup();
  expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument();
  type('5');
  click('OK');
  next();
  expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument();
  type('3');
  click('OK');
  next();
  expect(screen.getByRole('button', { name: 'Saltar' })).toBeInTheDocument();
});

test('OK with an empty answer does nothing', () => {
  setup();
  click('OK');
  expect(screen.getByText('Escribe el resultado y toca OK')).toBeInTheDocument();
  expect(screen.queryByText('¡Bien!')).not.toBeInTheDocument();
});

test('answering 42 in round 3 also completes', () => {
  const { onComplete } = setup();
  type('5');
  click('OK');
  next();
  type('3');
  click('OK');
  next();
  type('42');
  click('OK');
  next();
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('Backspace deletes and input is capped at 4 digits', async () => {
  vi.useRealTimers();
  setup();
  await userEvent.keyboard('12345');
  expect(screen.getByTestId('answer')).toHaveTextContent('1234');
  await userEvent.keyboard('{Backspace}');
  expect(screen.getByTestId('answer')).toHaveTextContent('123');
});
