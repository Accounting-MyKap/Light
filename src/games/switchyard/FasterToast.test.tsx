import { act, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FASTER_SHOW_MS, FasterToast } from './FasterToast';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const toast = () => screen.queryByText(/^¡Más rápido!/);

test('each level up shows its own toast for a moment; the start and a level down show none', () => {
  const view = render(<FasterToast level={4} />);
  expect(toast()).toBeNull();
  // The live region is there before anything is said in it, so the screen reader hears the toast.
  const region = screen.getByRole('status');
  expect(region).toBeEmptyDOMElement();

  view.rerender(<FasterToast level={5} />);
  expect(toast()).toHaveTextContent('¡Más rápido! · Nivel 5');
  expect(region).toContainElement(toast());
  act(() => void vi.advanceTimersByTime(FASTER_SHOW_MS - 1));
  expect(toast()).not.toBeNull();
  act(() => void vi.advanceTimersByTime(1));
  expect(toast()).toBeNull();

  view.rerender(<FasterToast level={4} />);
  expect(toast()).toBeNull();
  view.rerender(<FasterToast level={5} />);
  expect(toast()).toHaveTextContent('¡Más rápido! · Nivel 5');
  // A new level up while one shows starts it over, with the new level.
  act(() => void vi.advanceTimersByTime(FASTER_SHOW_MS / 2));
  view.rerender(<FasterToast level={6} />);
  expect(toast()).toHaveTextContent('¡Más rápido! · Nivel 6');
  act(() => void vi.advanceTimersByTime(FASTER_SHOW_MS - 1));
  expect(toast()).not.toBeNull();
  act(() => void vi.advanceTimersByTime(1));
  expect(toast()).toBeNull();
});
