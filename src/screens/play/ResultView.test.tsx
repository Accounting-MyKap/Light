import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { fakeGame, registerFakeGameTranslations } from '../../test/fakeGame';
import { fetchPercentile, getRemote, requestSync } from '../../sync';
import type { GameDefinition, GameResult } from '../../games/types';
import { ResultView, type ResultViewProps } from './ResultView';

// The percentile line asks the server through this module; one mock keeps these tests off the network.
vi.mock('../../sync');

const RESULT: GameResult = { score: 340, accuracy: 0.92, levelReached: 5, durationMs: 60_000 };

beforeEach(async () => {
  await initI18n('es');
  registerFakeGameTranslations();
  vi.mocked(requestSync).mockReset().mockResolvedValue(null);
  vi.mocked(getRemote).mockReset().mockReturnValue(null);
  vi.mocked(fetchPercentile).mockReset().mockResolvedValue(null);
});

function renderResult(props: Partial<ResultViewProps> = {}) {
  const handlers = { onPlayAgain: vi.fn(), onBack: vi.fn() };
  const view = render(
    <ResultView game={fakeGame} result={RESULT} previousBest={null} {...handlers} {...props} />,
  );
  return { ...handlers, ...view };
}

const celebration = (container: HTMLElement) => container.querySelector('[data-celebrate="true"]');

test('the final score is available to screen readers at once', () => {
  renderResult();
  const spoken = screen.getByText('Puntaje: 340');
  expect(spoken).toHaveClass('visually-hidden');
  // The number that counts up is only for the eyes: it is hidden from the accessibility tree.
  const shown = screen.getByText('340');
  expect(shown).toHaveAttribute('aria-hidden', 'true');
});

test('the score is announced in English too', async () => {
  await initI18n('en');
  renderResult();
  expect(screen.getByText('Score: 340')).toBeInTheDocument();
});

test('a new best shows the celebration', () => {
  const { container } = renderResult({ previousBest: 100 });
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(celebration(container)).not.toBeNull();
  // The rays and sparks are decoration.
  expect(celebration(container)).toHaveAttribute('aria-hidden', 'true');
});

test('the first game ever is a new best', () => {
  const { container } = renderResult({ previousBest: null });
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(celebration(container)).not.toBeNull();
});

test('a first game with a score of 0 is no new best, and the best card shows a dash', () => {
  const { container } = renderResult({ previousBest: null, result: { ...RESULT, score: 0 } });
  expect(screen.queryByText('¡Nueva mejor marca!')).not.toBeInTheDocument();
  expect(celebration(container)).toBeNull();
  expect(screen.getByText('Mejor marca').parentElement).toHaveTextContent('—');
  expect(screen.getByText('Mejor marca').parentElement).not.toHaveTextContent('null');
});

test('a first game with a score of 20 is a new best', () => {
  const { container } = renderResult({ previousBest: null, result: { ...RESULT, score: 20 } });
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(celebration(container)).not.toBeNull();
});

test('a 0 after a best of 30 is no new best and keeps the best', () => {
  const { container } = renderResult({ previousBest: 30, result: { ...RESULT, score: 0 } });
  expect(screen.queryByText('¡Nueva mejor marca!')).not.toBeInTheDocument();
  expect(celebration(container)).toBeNull();
  expect(screen.getByText('Mejor marca').parentElement).toHaveTextContent('30');
});

test('accuracy and level are shown in cards', () => {
  renderResult({ previousBest: 100 });
  expect(screen.getByText('Precisión').parentElement).toHaveTextContent('92 %');
  expect(screen.getByText('Nivel alcanzado').parentElement).toHaveTextContent('5');
  // After a record the best mark is the score itself, so there is no card for it.
  expect(screen.queryByText('Mejor marca')).not.toBeInTheDocument();
});

test('the accuracy never breaks between the number and its % sign', () => {
  renderResult({ result: { ...RESULT, accuracy: 1 } });
  expect(screen.getByText('Precisión').nextElementSibling?.textContent).toBe('100\u00a0%');
});

test('without a record there is no celebration, and the best mark is a card too', () => {
  const { container } = renderResult({ previousBest: 400 });
  expect(screen.queryByText('¡Nueva mejor marca!')).not.toBeInTheDocument();
  expect(celebration(container)).toBeNull();
  expect(screen.getByText('Mejor marca').parentElement).toHaveTextContent('400');
});

test('a score equal to the best is not a new best', () => {
  const { container } = renderResult({ previousBest: 340 });
  expect(screen.queryByText('¡Nueva mejor marca!')).not.toBeInTheDocument();
  expect(celebration(container)).toBeNull();
});

test('the percentile line stays, once the server answers', async () => {
  vi.mocked(fetchPercentile).mockResolvedValue(73);
  renderResult({ previousBest: 100 });
  expect(await screen.findByText('Estás por encima del 73 % de los jugadores')).toBeInTheDocument();
});

test('free play offers to play again, and to go back', async () => {
  const { onPlayAgain, onBack } = renderResult();
  expect(screen.queryByText(/Entrenamiento de hoy:/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Jugar de nuevo' }));
  expect(onPlayAgain).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Siguiente juego' })).not.toBeInTheDocument();
});

function dailyProps(over: Partial<NonNullable<ResultViewProps['daily']>> = {}): NonNullable<ResultViewProps['daily']> {
  return { nextGameId: 'fake2', progress: { done: 2, total: 3 }, onNext: vi.fn(), onSummary: vi.fn(), ...over };
}

test('daily mode shows today’s progress', () => {
  renderResult({ daily: dailyProps() });
  expect(screen.getByText('Entrenamiento de hoy: 2 de 3')).toBeInTheDocument();
});

test('the progress bars light up one for each finished game', () => {
  const { container } = renderResult({ daily: dailyProps() });
  const bars = container.querySelectorAll('[data-done]');
  expect([...bars].map((bar) => bar.getAttribute('data-done'))).toEqual(['true', 'true', 'false']);
  // The words carry the progress; the bars are decoration.
  expect(bars[0]?.parentElement).toHaveAttribute('aria-hidden', 'true');
});

test('daily mode has no free-play buttons: the next game, or the summary on the last one', async () => {
  const next = dailyProps();
  const { unmount } = renderResult({ daily: next });
  expect(screen.queryByRole('button', { name: 'Jugar de nuevo' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente juego' }));
  expect(next.onNext).toHaveBeenCalledTimes(1);
  unmount();

  const last = dailyProps({ nextGameId: null, progress: { done: 3, total: 3 } });
  renderResult({ daily: last });
  expect(screen.getByText('Entrenamiento de hoy: 3 de 3')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente juego' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Ver resumen' }));
  expect(last.onSummary).toHaveBeenCalledTimes(1);
});

test('a daily game without a plan to count has no progress line', () => {
  renderResult({ daily: dailyProps({ progress: { done: 0, total: 0 } }) });
  expect(screen.queryByText(/Entrenamiento de hoy:/)).not.toBeInTheDocument();
});

test('a game ResultDetails block sits below the stats and above the buttons', () => {
  const game: GameDefinition = {
    ...fakeGame,
    ResultDetails: ({ result: shown }) => <p>detalles de {shown.score} puntos</p>,
  };
  renderResult({ game, previousBest: 400 });
  const details = screen.getByText('detalles de 340 puntos');
  const stats = screen.getByText('Precisión').closest('dl')!;
  const again = screen.getByRole('button', { name: 'Jugar de nuevo' });
  expect(stats.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(details.compareDocumentPosition(again) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('in daily mode the ResultDetails block comes before today’s progress and the next game', () => {
  const game: GameDefinition = { ...fakeGame, ResultDetails: () => <p>detalles</p> };
  renderResult({ game, daily: dailyProps() });
  const details = screen.getByText('detalles');
  const progress = screen.getByText('Entrenamiento de hoy: 2 de 3');
  expect(details.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('a game without ResultDetails shows just the usual result', () => {
  renderResult({ previousBest: 400 });
  expect(screen.getByTestId('result-score')).toHaveTextContent('340');
  expect(screen.queryByText(/detalles/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
});
