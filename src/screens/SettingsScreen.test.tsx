import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { DEFAULT_SETTINGS, getSettings } from '../data/settings';
import { addResult } from '../data/results';

beforeEach(async () => {
  await clearAllData();
  document.documentElement.removeAttribute('data-theme');
});

test('choosing English switches the UI and is saved', async () => {
  await renderApp('/settings');
  await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'English');
  expect(await within(screen.getByRole('navigation')).findByRole('link', { name: 'Today' })).toBeInTheDocument();
  await vi.waitFor(async () => expect((await getSettings()).language).toBe('en'));
  expect(document.documentElement.lang).toBe('en');
});

test('theme radio applies and persists', async () => {
  await renderApp('/settings');
  await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
  await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  expect((await getSettings()).theme).toBe('dark');
  await userEvent.click(screen.getByRole('radio', { name: 'Automático' }));
  await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-theme')).toBe(false));
});

test('sound can be turned off', async () => {
  await renderApp('/settings');
  const toggle = screen.getByRole('switch', { name: 'Sonido' });
  expect(toggle).toBeChecked();
  await userEvent.click(toggle);
  await vi.waitFor(async () => expect((await getSettings()).sound).toBe(false));
});

test('privacy note is visible', async () => {
  await renderApp('/settings');
  expect(
    screen.getByText('Tu progreso se guarda solo en este dispositivo. Light no usa publicidad ni analítica.'),
  ).toBeInTheDocument();
});

test('delete my data asks for confirmation', async () => {
  await addResult({ gameId: 'arrows', level: 1, score: 10, accuracy: 1, durationMs: 60000, isDaily: false });
  await renderApp('/settings');
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(await db.results.count()).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await vi.waitFor(async () => expect(await db.results.count()).toBe(0));
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  expect(await screen.findByText('Listo: borramos todos tus datos de este dispositivo.')).toBeInTheDocument();
});
