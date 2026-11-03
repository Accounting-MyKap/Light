import { fireEvent, screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';

const DAY = '2026-10-20';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  await clearAllData();
});
afterEach(() => {
  vi.useRealTimers();
});

const h2s = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

test('sections follow the catalog order, cards show name and skill, no best mark', async () => {
  await renderApp('/games');
  expect(h2s()).toEqual(['Velocidad', 'Memoria', 'Atención', 'Flexibilidad mental', 'Matemáticas']);
  const arrows = screen.getByRole('link', { name: /Flechas/ });
  expect(arrows).toHaveAttribute('href', '/play/arrows');
  expect(arrows).toHaveTextContent('Atención selectiva');
  expect(screen.queryByText(/Mejor/)).toBeNull();
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
});

test('a filter shows one category and is announced as pressed', async () => {
  await renderApp('/games');
  fireEvent.click(screen.getByRole('button', { name: 'Memoria' }));
  expect(screen.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'false');
  expect(h2s()).toEqual(['Memoria']);
  expect(screen.getAllByRole('link', { name: /Secuencia de luces/ })).toHaveLength(1);
  expect(
    screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/play/')),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
  expect(h2s()).toHaveLength(5);
});

test('the filter comes from the address', async () => {
  await renderApp('/games?area=memory');
  expect(h2s()).toEqual(['Memoria']);
  expect(screen.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
});

test.each(['/games?area=logic', '/games?area=', '/games?area=MEMORY', '/games?area=bogus'])(
  '%s shows everything',
  async (route) => {
    await renderApp(route);
    expect(h2s()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true');
  },
);

test('today’s games: daily links and a played mark', async () => {
  await db.dailyPlans.put({ day: DAY, gameIds: ['arrows', 'quick-math', 'rule-switch'], completed: ['arrows'] });
  await renderApp('/games');
  const heading = await screen.findByRole('heading', { level: 2, name: 'Tus juegos de hoy' });
  const section = heading.closest('section')!;
  const links = within(section).getAllByRole('link');
  expect(links.map((l) => l.getAttribute('href'))).toEqual([
    `/play/arrows?daily=${DAY}`,
    `/play/quick-math?daily=${DAY}`,
    `/play/rule-switch?daily=${DAY}`,
  ]);
  expect(links[0]).toHaveTextContent(/Flechas\s*Jugado/);
  expect(links[1]).not.toHaveTextContent('Jugado');
  expect(links[2]).not.toHaveTextContent('Jugado');
});

test('the today row hides while a filter is on', async () => {
  await db.dailyPlans.put({ day: DAY, gameIds: ['arrows', 'quick-math', 'rule-switch'], completed: [] });
  await renderApp('/games?area=memory');
  expect(screen.queryByText('Tus juegos de hoy')).toBeNull();
});

test('no plan: no today row and the catalog does not create one', async () => {
  await renderApp('/games');
  expect(screen.queryByText('Tus juegos de hoy')).toBeNull();
  expect(await db.dailyPlans.count()).toBe(0);
});

test('a stale plan id is skipped', async () => {
  await db.dailyPlans.put({ day: DAY, gameIds: ['old-game', 'arrows', 'quick-math'], completed: [] });
  await renderApp('/games');
  const heading = await screen.findByRole('heading', { level: 2, name: 'Tus juegos de hoy' });
  expect(within(heading.closest('section')!).getAllByRole('link')).toHaveLength(2);
});

test('a failing plan read hides only the today row', async () => {
  const get = vi.spyOn(db.dailyPlans, 'get').mockRejectedValue(new Error('boom'));
  await renderApp('/games');
  await vi.waitFor(() => expect(get).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 100)); // a rejected live query rethrows on a later render
  expect(h2s()).toHaveLength(5);
  expect(screen.queryByText('Tus juegos de hoy')).toBeNull();
});
