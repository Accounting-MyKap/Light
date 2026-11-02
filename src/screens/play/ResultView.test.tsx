import { render, screen } from '@testing-library/react';
import type { GameDefinition, GameResult } from '../../games/types';
import { initI18n } from '../../i18n';
import { fakeGame, registerFakeGameTranslations } from '../../test/fakeGame';
import { fetchPercentile, getRemote, requestSync } from '../../sync';
import { ResultView } from './ResultView';

// The percentile line reaches sync only through this module, so one mock keeps these tests off the network.
vi.mock('../../sync');

const result: GameResult = { score: 120, accuracy: 0.9, levelReached: 2, durationMs: 60000 };

function renderResult(game: GameDefinition, daily?: boolean) {
  return render(
    <ResultView
      game={game}
      result={result}
      previousBest={200}
      onPlayAgain={vi.fn()}
      onBack={vi.fn()}
      daily={daily ? { nextGameId: null, onNext: vi.fn(), onSummary: vi.fn() } : undefined}
    />,
  );
}

beforeEach(async () => {
  await initI18n('es');
  registerFakeGameTranslations();
  vi.mocked(requestSync).mockReset().mockResolvedValue(null);
  vi.mocked(getRemote).mockReset().mockReturnValue(null);
  vi.mocked(fetchPercentile).mockReset().mockResolvedValue(null);
});

test('ResultView renders a game ResultDetails block', () => {
  const game: GameDefinition = {
    ...fakeGame,
    ResultDetails: ({ result: shown }) => <p>detalles de {shown.score} puntos</p>,
  };
  renderResult(game);
  expect(screen.getByText('detalles de 120 puntos')).toBeInTheDocument();
  // It sits below the stats and above the buttons.
  const stats = screen.getByText('Precisión').closest('dl')!;
  const details = screen.getByText('detalles de 120 puntos');
  const again = screen.getByRole('button', { name: 'Jugar de nuevo' });
  expect(stats.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(details.compareDocumentPosition(again) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('a game without ResultDetails shows just the usual result', () => {
  renderResult(fakeGame);
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
});
