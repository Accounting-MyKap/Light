import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { initI18n } from '../i18n';

test('ErrorBoundary shows fallback with link home', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await initI18n('es');
  const Boom = () => {
    throw new Error('boom');
  };
  render(
    <MemoryRouter>
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
});
