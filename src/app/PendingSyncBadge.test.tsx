import { act, render, screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { addResult } from '../data/results';
import { initI18n } from '../i18n';
import type { SyncConfig } from '../sync/config';
import { PendingSyncBadge } from './PendingSyncBadge';

const config = vi.hoisted(() => ({ current: null as SyncConfig | null }));
vi.mock('../sync/config', () => ({
  get syncConfig() {
    return config.current;
  },
}));
// The app mounts the sync service; these tests only look at the badge, so it must not touch the network.
vi.mock('../sync');

const enabled: SyncConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test', turnstileSiteKey: null };
const play = { gameId: 'arrows', level: 1, score: 100, accuracy: 0.8, durationMs: 60000, isDaily: false };

beforeEach(async () => {
  config.current = null;
  await clearAllData();
});

async function addPending(count: number) {
  for (let i = 0; i < count; i++) await addResult(play);
}

test('PendingSyncBadge is hidden when sync is disabled', async () => {
  await addPending(2);
  await initI18n('es');
  render(<PendingSyncBadge />);
  // Long enough for a live query on the two pending results to have come back, had there been one.
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText(/por sincronizar/)).not.toBeInTheDocument();
});

test('PendingSyncBadge shows the count when sync is enabled', async () => {
  config.current = enabled;
  await addPending(2);
  await initI18n('es');
  const view = render(<PendingSyncBadge />);
  expect(await screen.findByRole('status')).toHaveTextContent('2 partidas por sincronizar');
  view.unmount();

  await db.results.clear();
  await addPending(1);
  render(<PendingSyncBadge />);
  expect(await screen.findByText('1 partida por sincronizar')).toBeInTheDocument();
});

test('PendingSyncBadge is in English when the language is English', async () => {
  config.current = enabled;
  await addPending(1);
  await initI18n('en');
  render(<PendingSyncBadge />);
  expect(await screen.findByText('1 game waiting to sync')).toBeInTheDocument();
});

test('PendingSyncBadge is hidden with nothing pending and follows the pending count', async () => {
  config.current = enabled;
  await initI18n('es');
  const [synced, refused] = [await addResult(play), await addResult(play)];
  await db.results.update(synced.id, { synced: 1 });
  await db.results.update(refused.id, { synced: 2 });
  render(<PendingSyncBadge />);
  await vi.waitFor(async () => expect(await db.results.where('synced').equals(0).count()).toBe(0));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  await addResult(play);
  expect(await screen.findByText('1 partida por sincronizar')).toBeInTheDocument();
  await db.results.toCollection().modify({ synced: 1 });
  await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});

test('the badge sits in the header, so it is hidden while playing', async () => {
  config.current = enabled;
  await addPending(1);
  const view = await renderApp('/');
  expect(await screen.findByRole('status')).toHaveTextContent('1 partida por sincronizar');
  expect(screen.getByRole('banner')).toContainElement(screen.getByRole('status'));
  view.unmount();

  await renderApp('/play/anything');
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  expect(screen.queryByText(/por sincronizar/)).not.toBeInTheDocument();
});
