import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { DEFAULT_SETTINGS, getSettings } from '../data/settings';
import { addResult } from '../data/results';
import { initI18n } from '../i18n';
import { deleteEverything, getRemote } from '../sync';
import type { SyncConfig } from '../sync/config';
import { deleteEverything as realDeleteEverything } from '../sync/deleteData';
import { syncNow } from '../sync/syncEngine';
import { createFakeRemote } from '../test/fakeRemote';
import { SettingsScreen } from './SettingsScreen';

const config = vi.hoisted(() => ({ current: null as SyncConfig | null }));
vi.mock('../sync/config', () => ({
  get syncConfig() {
    return config.current;
  },
}));
// The app mounts the sync service; here only the delete flow is looked at, so `deleteEverything` runs for real unless a test says otherwise.
vi.mock('../sync');

const enabled: SyncConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test', turnstileSiteKey: null };
const play = { gameId: 'arrows', level: 1, score: 10, accuracy: 1, durationMs: 60000, isDaily: false };
const CONFIRM = '¿Seguro? Se borrarán tu historial, tus rachas y tus ajustes de este dispositivo.';
const CONFIRM_SYNC =
  '¿Seguro? Se borrarán tu historial, tus rachas y tus ajustes de este dispositivo, y tus puntajes de nuestro servidor.';
const SUCCESS = 'Listo: borramos todos tus datos de este dispositivo.';
const SUCCESS_SYNC = 'Listo: borramos todos tus datos de este dispositivo y de nuestro servidor.';
const SERVER_ERROR = 'No pudimos borrar tus datos del servidor. Revisa tu conexión e inténtalo de nuevo.';

beforeEach(async () => {
  config.current = null;
  vi.mocked(getRemote).mockReturnValue(null);
  vi.mocked(deleteEverything).mockReset().mockImplementation(realDeleteEverything);
  await clearAllData();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => vi.restoreAllMocks());

async function confirmDelete() {
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
}

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
  expect(screen.queryByText(/a nuestro servidor/)).not.toBeInTheDocument();
});

test('privacy note says the scores are sent when sync is enabled', async () => {
  config.current = enabled;
  await renderApp('/settings');
  expect(
    screen.getByText(
      'Tu progreso se guarda en este dispositivo. Para compararte con otros jugadores, tus puntajes también se envían de forma anónima, sin nombre ni correo, a nuestro servidor. Light no usa publicidad ni analítica.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/guarda solo en este dispositivo/)).not.toBeInTheDocument();
});

test('privacy note is honest in English too when sync is enabled', async () => {
  config.current = enabled;
  await initI18n('en');
  render(<SettingsScreen />);
  expect(
    screen.getByText(
      'Your progress is stored on this device. To compare you with other players, your scores are also sent anonymously, with no name or email, to our server. Light uses no ads or analytics.',
    ),
  ).toBeInTheDocument();
});

test('delete my data asks for confirmation', async () => {
  await addResult({ gameId: 'arrows', level: 1, score: 10, accuracy: 1, durationMs: 60000, isDaily: false });
  await renderApp('/settings');
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(CONFIRM);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(await db.results.count()).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await vi.waitFor(async () => expect(await db.results.count()).toBe(0));
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
  expect(screen.queryByText(/nuestro servidor/)).not.toBeInTheDocument();
});

test('with sync enabled the confirmation and the result mention the server', async () => {
  config.current = enabled;
  vi.mocked(deleteEverything).mockResolvedValue('ok');
  await renderApp('/settings');
  await userEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(CONFIRM_SYNC);
  expect(screen.queryByText(CONFIRM)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_SYNC);
  expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
});

test('the delete copy that mentions the server is in English when the language is English', async () => {
  config.current = enabled;
  vi.mocked(deleteEverything).mockResolvedValue('ok');
  await initI18n('en');
  render(<SettingsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    'Are you sure? Your history, streaks and settings on this device, and your scores on our server, will be deleted.',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Done: all your data on this device and on our server has been deleted.',
  );
});

test('deleting hands the remote to deleteEverything', async () => {
  const remote = createFakeRemote();
  vi.mocked(getRemote).mockReturnValue(remote);
  vi.mocked(deleteEverything).mockResolvedValue('ok');
  await renderApp('/settings');
  await confirmDelete();
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
  expect(deleteEverything).toHaveBeenCalledExactlyOnceWith(remote);
});

test('if the server cannot be reached it says so and does not claim anything was deleted', async () => {
  vi.mocked(deleteEverything).mockResolvedValue('remote-failed');
  await renderApp('/settings');
  await confirmDelete();
  expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_ERROR);
  expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('the server error is in English when the language is English', async () => {
  vi.mocked(deleteEverything).mockResolvedValue('remote-failed');
  await initI18n('en');
  render(<SettingsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We couldn’t delete your data from the server. Check your connection and try again.',
  );
});

test('after a server failure the data is kept, and trying again deletes it and hides the error', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const remote = createFakeRemote();
  vi.mocked(getRemote).mockReturnValue(remote);
  await addResult(play);
  await syncNow(remote, async () => undefined);
  const userId = remote.currentUser!;
  expect(remote.users.get(userId)!.results.size).toBe(1);
  remote.failNext('network');
  await renderApp('/settings');

  await confirmDelete();
  expect(await screen.findByRole('alert')).toHaveTextContent(SERVER_ERROR);
  expect(await db.results.count()).toBe(1);
  expect(remote.users.get(userId)!.results.size).toBe(1);

  await confirmDelete();
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(await db.results.count()).toBe(0);
  expect(remote.users.get(userId)!.results.size).toBe(0);
  expect(remote.currentUser).toBeNull();
});

test('the dialog buttons cannot be pressed while the delete is running', async () => {
  let finish!: (outcome: 'ok') => void;
  vi.mocked(deleteEverything).mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await renderApp('/settings');
  await confirmDelete();

  expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  expect(deleteEverything).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();

  await act(async () => finish('ok'));
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
});

test('if clearing the device fails there is no success message and the dialog can be used again', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(deleteEverything).mockRejectedValue(new Error('IndexedDB is gone'));
  await renderApp('/settings');
  await confirmDelete();

  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
  expect(error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'IndexedDB is gone' }));

  vi.mocked(deleteEverything).mockResolvedValue('ok');
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
});

test('a failed attempt after a successful one does not leave the old success message up', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(deleteEverything).mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('IndexedDB is gone'));
  await renderApp('/settings');
  await confirmDelete();
  expect(await screen.findByText(SUCCESS)).toBeInTheDocument();

  await confirmDelete();
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeEnabled());
  expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
});
