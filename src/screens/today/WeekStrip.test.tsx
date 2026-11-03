import { render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { WeekStrip } from './WeekStrip';

beforeEach(async () => {
  await initI18n('es');
});

const states = (container: HTMLElement) =>
  [...container.querySelectorAll('li')].map((li) => li.getAttribute('data-state'));

test('marks done, missed, today and future days and summarises the week', () => {
  const { container } = render(
    <WeekStrip today="2026-10-22" completed={['2026-10-19', '2026-10-21', '2026-10-14']} />,
  );
  expect(screen.getByText('2 de 7 días entrenados esta semana')).toBeInTheDocument();
  expect(container.querySelector('ol')).toHaveAttribute('aria-hidden', 'true');
  expect(states(container)).toEqual(['done', 'missed', 'done', 'today', 'future', 'future', 'future']);
});

test('a completed today counts as done', () => {
  const { container } = render(<WeekStrip today="2026-10-22" completed={['2026-10-22']} />);
  expect(states(container)[3]).toBe('done');
  expect(screen.getByText('1 de 7 días entrenados esta semana')).toBeInTheDocument();
});
