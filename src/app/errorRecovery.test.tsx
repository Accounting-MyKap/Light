import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { clearAllData } from '../data/db';

vi.mock('../screens/ProgressScreen', () => ({
  ProgressScreen: () => {
    throw new Error('boom');
  },
}));

beforeEach(async () => {
  await clearAllData();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('navigating away from a crashed screen shows the next screen', async () => {
  await renderApp('/progress');
  expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Juegos' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
});

test('"Volver al inicio" really goes back home', async () => {
  await renderApp('/progress');
  await userEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Entrenamiento de hoy' })).toBeInTheDocument();
});
