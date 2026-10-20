import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { startSyncService } from '../sync';
import { SyncManager } from './SyncManager';

vi.mock('../sync');

const stop = vi.fn();
beforeEach(() => {
  vi.mocked(startSyncService).mockReset().mockReturnValue(stop);
  stop.mockReset();
});

test('starts the sync service on mount, draws nothing and stops it on unmount', () => {
  const { container, unmount } = render(<SyncManager />);
  expect(container).toBeEmptyDOMElement();
  expect(startSyncService).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
  unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

test('a StrictMode remount stops the first service before starting the second', () => {
  const { unmount } = render(
    <StrictMode>
      <SyncManager />
    </StrictMode>,
  );
  expect(startSyncService).toHaveBeenCalledTimes(2);
  expect(stop).toHaveBeenCalledTimes(1);
  unmount();
  expect(stop).toHaveBeenCalledTimes(2);
});

test('the app keeps one sync service across navigation', async () => {
  await renderApp('/');
  expect(startSyncService).toHaveBeenCalledTimes(1);
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Juegos' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect(startSyncService).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
});
