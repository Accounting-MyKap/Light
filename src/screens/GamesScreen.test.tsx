import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData } from '../data/db';
import { addResult } from '../data/results';

beforeEach(clearAllData);

test('games are grouped by area with links and best marks', async () => {
  await addResult({ gameId: 'arrows', level: 1, score: 77, accuracy: 1, durationMs: 60000, isDaily: false });
  await renderApp('/games');
  expect(screen.getByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  const areas = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  expect(areas).toEqual(['Memoria', 'Atención', 'Velocidad', 'Flexibilidad mental', 'Matemáticas']);
  expect(screen.getByRole('link', { name: /Flechas/ })).toHaveAttribute('href', '/play/arrows');
  expect(screen.getByRole('link', { name: /Cálculo relámpago/ })).toHaveAttribute('href', '/play/quick-math');
  expect(await screen.findByText('Mejor marca: 77')).toBeInTheDocument();
  expect(screen.getAllByText('Mejor marca: —')).toHaveLength(4);
});
