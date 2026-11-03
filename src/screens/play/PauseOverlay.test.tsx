import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { PauseOverlay } from './PauseOverlay';

beforeEach(async () => {
  await initI18n('es');
});

function renderSheet(hud = { score: 120, remainingMs: 34_200 as number | null }) {
  const onContinue = vi.fn();
  const onExit = vi.fn();
  const onHowToPlay = vi.fn();
  render(<PauseOverlay hud={hud} onContinue={onContinue} onHowToPlay={onHowToPlay} onExit={onExit} />);
  return { onContinue, onExit, onHowToPlay, sheet: screen.getByRole('dialog', { name: 'Pausado' }) };
}

test('shows the seconds left, rounded up like the time bar, and the points', () => {
  const { sheet } = renderSheet();
  expect(within(sheet).getByText('quedan').parentElement).toHaveTextContent('35 s');
  expect(within(sheet).getByText('puntos').parentElement).toHaveTextContent('120');
});

test('a game without a clock shows only the points', () => {
  const { sheet } = renderSheet({ score: 0, remainingMs: null });
  expect(within(sheet).queryByText('quedan')).not.toBeInTheDocument();
  expect(within(sheet).getByText('puntos').parentElement).toHaveTextContent('0');
});

test('is a modal dialog that starts on «Continuar»', async () => {
  const { onContinue, onExit, sheet } = renderSheet();
  expect(sheet).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('has three buttons in order: Continuar, ¿Cómo se juega?, Salir', async () => {
  const { onHowToPlay, sheet } = renderSheet();
  expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual([
    'Continuar',
    '¿Cómo se juega?',
    'Salir',
  ]);
  await userEvent.click(within(sheet).getByRole('button', { name: '¿Cómo se juega?' }));
  expect(onHowToPlay).toHaveBeenCalledTimes(1);
});
