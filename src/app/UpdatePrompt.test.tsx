import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { initI18n } from '../i18n';
import { UpdatePrompt } from './UpdatePrompt';

test('offers to reload when a new version is waiting', async () => {
  await initI18n('es');
  const updateServiceWorker = vi.fn(() => Promise.resolve());
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [true, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker,
  });
  render(<UpdatePrompt />);
  expect(screen.getByText('Nueva versión disponible')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Recargar' }));
  expect(updateServiceWorker).toHaveBeenCalledWith(true);
});

test('renders nothing when up to date', async () => {
  await initI18n('es');
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: vi.fn(() => Promise.resolve()),
  });
  const { container } = render(<UpdatePrompt />);
  expect(container).toBeEmptyDOMElement();
});
