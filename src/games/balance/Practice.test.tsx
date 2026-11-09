import { act, render, screen } from '@testing-library/react';
import { playTone } from '../../core/sound';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { BalancePractice } from './Practice';

vi.mock('../../core/sound');

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  render(
    <FeedbackProvider>
      <BalancePractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip };
}

const click = (name: string | RegExp) => act(() => screen.getByRole('button', { name }).click());
const next = () => act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
const bubble = () => document.querySelector('[data-tone]');

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  vi.mocked(playTone).mockClear();
});
afterEach(() => vi.useRealTimers());

test('round 1: one balance, the side that goes down is heavier', () => {
  setup();
  expect(screen.getByText('Práctica 1 de 4')).toBeInTheDocument();
  expect(bubble()).toHaveTextContent('El lado que baja pesa más. ¿Cuál pesa más?');
  expect(screen.getAllByRole('img', { name: /frente a/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'círculo ámbar' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'cuadrado cian' })).toBeInTheDocument();
});

test('a wrong answer gives the hint and keeps the round open', () => {
  setup();
  click('cuadrado cian');
  expect(bubble()).toHaveAttribute('data-tone', 'hint');
  expect(bubble()).toHaveTextContent('El platillo del círculo está más abajo: el círculo pesa más');
  expect(screen.getByText('Práctica 1 de 4')).toBeInTheDocument();
  click('círculo ámbar');
  expect(bubble()).toHaveTextContent('¡Bien!');
});

test('the four rounds, answered right, complete once; the new balance tips with a clonk in rounds 3 and 4', () => {
  const { onComplete } = setup();
  click('círculo ámbar');
  next();
  expect(bubble()).toHaveTextContent('Junta las dos balanzas: ¿cuál pesa más de todas?');
  expect(screen.getAllByRole('img', { name: /frente a/ })).toHaveLength(2);
  click('círculo ámbar');
  next();
  expect(bubble()).toHaveTextContent('Una balanza recta pesa igual a los dos lados. ¿Hacia dónde se inclina la nueva?');
  expect(document.querySelector('[data-question="true"]')).toHaveAttribute('data-outcome', 'unknown');
  click(/Derecha/);
  expect(playTone).toHaveBeenCalledWith('tilt');
  expect(document.querySelector('[data-question="true"]')).toHaveAttribute('data-outcome', 'right');
  next();
  expect(bubble()).toHaveTextContent('¿Y esta?');
  click(/Igual/);
  expect(document.querySelector('[data-question="true"]')).toHaveAttribute('data-outcome', 'level');
  next();
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('the hints of rounds 2 to 4', () => {
  setup();
  click('círculo ámbar');
  next();
  click('triángulo magenta');
  expect(bubble()).toHaveTextContent('El círculo pesa más que el cuadrado, y el cuadrado más que el triángulo');
  click('círculo ámbar');
  next();
  click(/Izquierda/);
  expect(bubble()).toHaveTextContent('Un círculo pesa como dos cuadrados; tres cuadrados pesan más: baja la derecha');
  expect(document.querySelector('[data-question="true"]')).toHaveAttribute('data-outcome', 'unknown');
  click(/Derecha/);
  next();
  click(/Derecha/);
  expect(bubble()).toHaveTextContent('Dos círculos pesan como cuatro cuadrados: queda recta');
});

test('keys answer too: 1–2 for the figures, ← = → for the new balance', () => {
  setup();
  act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })));
  expect(bubble()).toHaveTextContent('¡Bien!');
  next();
  act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })));
  next();
  act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
  expect(bubble()).toHaveTextContent('¡Bien!');
});

test('skip leaves the practice', () => {
  const { onSkip } = setup();
  click('Saltar práctica');
  expect(onSkip).toHaveBeenCalledTimes(1);
});
