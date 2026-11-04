import { fireEvent, screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { TRAINING_GAMES } from '../games/registry';

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
  expect(h2s()).toEqual(['Velocidad', 'Memoria', 'Atención', 'Flexibilidad mental', 'Lógica', 'Matemáticas']);
  const arrows = screen.getByRole('link', { name: /Flechas/ });
  expect(arrows).toHaveAttribute('href', '/play/arrows');
  expect(arrows).toHaveTextContent('Atención selectiva');
  expect(screen.queryByText(/Mejor/)).toBeNull();
  const switchyard = screen.getByRole('link', { name: /Guardagujas/ });
  expect(switchyard).toHaveAttribute('href', '/play/switchyard');
  expect(switchyard).toHaveTextContent('Atención dividida');
  const starShower = screen.getByRole('link', { name: /Lluvia de estrellas/ });
  expect(starShower).toHaveAttribute('href', '/play/star-shower');
  expect(starShower).toHaveTextContent('Cálculo bajo presión');
  const balance = screen.getByRole('link', { name: /Balanza/ });
  expect(balance).toHaveAttribute('href', '/play/balance');
  expect(balance).toHaveTextContent('Razonamiento lógico');
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
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
  expect(h2s()).toHaveLength(6);
});

test('the filter comes from the address', async () => {
  await renderApp('/games?area=memory');
  expect(h2s()).toEqual(['Memoria']);
  expect(screen.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
});

test('the Logic filter shows Balanza', async () => {
  await renderApp('/games?area=logic');
  expect(h2s()).toEqual(['Lógica']);
  expect(screen.getByRole('link', { name: /Balanza/ })).toHaveAttribute('href', '/play/balance');
});

// Lenguaje has no game yet, so its filter falls back to everything, like an unknown one.
test.each(['/games?area=language', '/games?area=', '/games?area=MEMORY', '/games?area=bogus'])(
  '%s shows everything',
  async (route) => {
    await renderApp(route);
    expect(h2s()).toHaveLength(6);
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
  expect(h2s()).toHaveLength(6);
  expect(screen.queryByText('Tus juegos de hoy')).toBeNull();
});

test('the catalog holds only the training games: the quiz games live in the Preguntas tab', async () => {
  await renderApp('/games');
  const hrefs = screen
    .getAllByRole('link')
    .map((l) => l.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/play/'));
  expect([...hrefs].sort()).toEqual(TRAINING_GAMES.map((g) => `/play/${g.id}`).sort());
  expect(hrefs.some((href) => /^\/play\/(trivia|accounting)-/.test(href))).toBe(false);
  // No filter pill for the two quiz banks either.
  const pills = within(screen.getByRole('group', { name: 'Categorías' })).getAllByRole('button');
  expect(pills.map((b) => b.textContent)).toEqual([
    'Todo',
    'Velocidad',
    'Memoria',
    'Atención',
    'Flexibilidad mental',
    'Lógica',
    'Matemáticas',
  ]);
});
