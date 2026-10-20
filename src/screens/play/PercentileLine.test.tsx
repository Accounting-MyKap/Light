import { act, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { fetchPercentile, getRemote, requestSync, type RemoteStore, type SyncReport } from '../../sync';
import { PercentileLine } from './PercentileLine';

// UI code reaches sync only through this module, so one mock keeps these tests off the network and the database.
vi.mock('../../sync');

const remote = { tag: 'remote' } as unknown as RemoteStore;
const report: SyncReport = { status: 'ok', uploaded: 1, rejected: 0, pending: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  await initI18n('es');
  vi.mocked(requestSync).mockReset().mockResolvedValue(report);
  vi.mocked(getRemote).mockReset().mockReturnValue(remote);
  vi.mocked(fetchPercentile).mockReset().mockResolvedValue(null);
});

test('shows the sentence when there is a number', async () => {
  vi.mocked(fetchPercentile).mockResolvedValue(73);
  render(<PercentileLine gameId="arrows" />);
  expect(await screen.findByText('Estás por encima del 73 % de los jugadores')).toBeInTheDocument();
  expect(fetchPercentile).toHaveBeenCalledWith(remote, 'arrows', expect.any(Date));
});

test('0 is a number: the sentence is still shown', async () => {
  vi.mocked(fetchPercentile).mockResolvedValue(0);
  render(<PercentileLine gameId="arrows" />);
  expect(await screen.findByText('Estás por encima del 0 % de los jugadores')).toBeInTheDocument();
});

test('shows nothing when the result is null', async () => {
  const { container } = render(<PercentileLine gameId="arrows" />);
  await vi.waitFor(() => expect(fetchPercentile).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});

test('waits for the sync before asking for the percentile', async () => {
  const sync = deferred<SyncReport | null>();
  vi.mocked(requestSync).mockReturnValue(sync.promise);
  vi.mocked(fetchPercentile).mockResolvedValue(73);
  render(<PercentileLine gameId="arrows" />);
  await act(async () => {});
  expect(requestSync).toHaveBeenCalledTimes(1);
  expect(fetchPercentile).not.toHaveBeenCalled();
  await act(async () => sync.resolve(null));
  expect(await screen.findByText('Estás por encima del 73 % de los jugadores')).toBeInTheDocument();
});

test('leaving the screen before the sync ends asks for nothing', async () => {
  const sync = deferred<SyncReport | null>();
  vi.mocked(requestSync).mockReturnValue(sync.promise);
  const { unmount } = render(<PercentileLine gameId="arrows" />);
  unmount();
  sync.resolve(report);
  await act(async () => {});
  expect(fetchPercentile).not.toHaveBeenCalled();
});

test('a late answer for a previous game never replaces the current one', async () => {
  const first = deferred<number | null>();
  vi.mocked(fetchPercentile).mockImplementation(async (_remote, gameId) => (gameId === 'arrows' ? first.promise : 20));
  const { rerender } = render(<PercentileLine gameId="arrows" />);
  await vi.waitFor(() => expect(fetchPercentile).toHaveBeenCalledTimes(1));
  rerender(<PercentileLine gameId="quick-math" />);
  expect(await screen.findByText('Estás por encima del 20 % de los jugadores')).toBeInTheDocument();
  await act(async () => first.resolve(90));
  expect(screen.getByText('Estás por encima del 20 % de los jugadores')).toBeInTheDocument();
  expect(screen.queryByText(/90/)).not.toBeInTheDocument();
});

test('an answer for the previous game is not shown under the new one while it is pending', async () => {
  const second = deferred<number | null>();
  vi.mocked(fetchPercentile).mockImplementation(async (_remote, gameId) => (gameId === 'arrows' ? 90 : second.promise));
  const { rerender } = render(<PercentileLine gameId="arrows" />);
  expect(await screen.findByText('Estás por encima del 90 % de los jugadores')).toBeInTheDocument();
  rerender(<PercentileLine gameId="quick-math" />);
  expect(screen.queryByText(/90/)).not.toBeInTheDocument();
  await act(async () => second.resolve(null));
  expect(screen.queryByText(/jugadores/)).not.toBeInTheDocument();
});
