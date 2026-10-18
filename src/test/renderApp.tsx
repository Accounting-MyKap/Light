import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../app/App';
import { initI18n } from '../i18n';

export async function renderApp(route: string): Promise<RenderResult> {
  await initI18n('es');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}
