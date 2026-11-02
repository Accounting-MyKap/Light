import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';

test('bottom navigation switches screens', async () => {
  await renderApp('/');
  const nav = screen.getByRole('navigation');
  for (const name of ['Hoy', 'Juegos', 'Preguntas', 'Progreso', 'Ajustes']) {
    expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
  }
  await userEvent.click(within(nav).getByRole('link', { name: 'Juegos' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  await userEvent.click(within(nav).getByRole('link', { name: 'Preguntas' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
});

test('play route hides bottom navigation', async () => {
  await renderApp('/play/anything');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
