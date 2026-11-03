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

test('no app header: the brand banner is gone', async () => {
  await renderApp('/games');
  expect(screen.queryByRole('banner')).toBeNull();
  expect(screen.queryByText('Ilumina tu cerebro')).toBeNull();
});

test('each tab has a hidden icon and the current one is marked', async () => {
  await renderApp('/progress');
  const nav = screen.getByRole('navigation');
  for (const name of ['Hoy', 'Juegos', 'Preguntas', 'Progreso', 'Ajustes']) {
    const link = within(nav).getByRole('link', { name });
    expect(link.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
  }
  expect(within(nav).getByRole('link', { name: 'Progreso' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  // Five different icons: the Preguntas tab has its own.
  const drawings = within(nav).getAllByRole('link').map((a) => a.querySelector('svg')!.innerHTML);
  expect(new Set(drawings).size).toBe(5);
});
