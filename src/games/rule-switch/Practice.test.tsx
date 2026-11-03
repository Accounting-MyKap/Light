import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { RuleSwitchPractice } from './Practice';

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
      <RuleSwitchPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip };
}

const pick = (side: 'left' | 'right') => act(() => screen.getByTestId(`target-${side}`).click());
const next = () => act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test('choosing left, right, left, right completes once', () => {
  const { onComplete } = setup();
  (['left', 'right', 'left', 'right'] as const).forEach((side, i) => {
    expect(screen.getByText(`Práctica ${i + 1} de 4`)).toBeInTheDocument();
    pick(side);
    expect(screen.getByText('¡Bien!')).toBeInTheDocument();
    next();
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('round 1 shows the guide and a wrong answer hints at the color', () => {
  setup();
  expect(screen.getByText('La regla dice COLOR: busca la carta del mismo color')).toBeInTheDocument();
  expect(screen.getByTestId('stimulus')).toHaveAttribute('data-shape', 'circle');
  pick('right');
  expect(screen.getByText('La regla es COLOR y el centro es azul')).toBeInTheDocument();
  expect(screen.getByText('Práctica 1 de 4')).toBeInTheDocument();
});

test('the banner changes to shape from round 3, with the switched class', () => {
  setup();
  expect(screen.getByTestId('rule-banner')).toHaveAttribute('data-rule', 'color');
  pick('left');
  next();
  expect(screen.getByText('Sigue siendo COLOR: no te fijes en la forma')).toBeInTheDocument();
  expect(screen.getByTestId('rule-banner')).toHaveAttribute('data-rule', 'color');
  pick('right');
  next();
  const banner = screen.getByTestId('rule-banner');
  expect(banner).toHaveAttribute('data-rule', 'shape');
  expect(banner.className).toMatch(/switched/);
  expect(screen.getByText('¡Cambió la regla! Ahora busca la misma FORMA')).toBeInTheDocument();
  pick('right');
  expect(screen.getByText('La regla es FORMA y el centro es un círculo')).toBeInTheDocument();
  pick('left');
  next();
  expect(screen.getByText('Fíjate siempre en el cartel de arriba')).toBeInTheDocument();
  expect(screen.getByTestId('rule-banner')).toHaveAttribute('data-rule', 'shape');
});

test('the arrow keys choose the left or the right card', async () => {
  vi.useRealTimers();
  setup();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByText('La regla es COLOR y el centro es azul')).toBeInTheDocument();
  await userEvent.keyboard('{ArrowLeft}');
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
});

test('skip calls onSkip', () => {
  const { onSkip } = setup();
  act(() => screen.getByRole('button', { name: 'Saltar práctica' }).click());
  expect(onSkip).toHaveBeenCalledTimes(1);
});
