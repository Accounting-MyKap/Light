import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initI18n } from '../i18n';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { addQuizAnswers } from '../data/quizAnswers';
import { addResult } from '../data/results';
import { BANK_SIZES } from '../quiz/banks/manifest';
import type { AnswerOutcome, QuizCategory, QuizRoundDetails } from '../quiz/types';
import { makeChoice } from '../test/quizFixtures';
import { ProgressScreen } from './ProgressScreen';

const base = { level: 1, accuracy: 1, durationMs: 60000, isDaily: false };

/** The number on the stat card labelled `label` (e.g. «Días entrenados»). */
async function statValue(label: string) {
  const card = (await screen.findByText(label)).closest('li') as HTMLElement;
  return within(card).getByText(/^\d+$/).textContent;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  await clearAllData();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('empty state', async () => {
  await renderApp('/progress');
  expect(await screen.findByText('Todavía no hay partidas. ¡Juega una para ver tu progreso!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ir a Hoy' })).toHaveAttribute('href', '/');
});

test('area meters, streaks, days trained and charts', async () => {
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 18, 9) });
  await addResult({ ...base, gameId: 'arrows', score: 200, playedAt: new Date(2026, 9, 19, 9) });
  await addResult({ ...base, gameId: 'quick-math', score: 50, playedAt: new Date(2026, 9, 19, 9) });
  await db.dailyPlans.put({ day: '2026-10-19', gameIds: ['arrows', 'quick-math', 'rule-switch'], completed: ['arrows', 'quick-math', 'rule-switch'] });
  await renderApp('/progress');
  const attention = await screen.findByRole('meter', { name: 'Atención' });
  expect(attention).toHaveAttribute('aria-valuenow', '143');
  expect(screen.getByRole('meter', { name: 'Matemáticas' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.queryByRole('meter', { name: 'Memoria' })).not.toBeInTheDocument();
  const stat = (label: string) => within(screen.getByText(label).closest('li') as HTMLElement);
  expect(stat('Racha actual').getByText('1')).toBeInTheDocument();
  expect(stat('Mejor racha').getByText('1')).toBeInTheDocument();
  expect(stat('Días entrenados').getByText('2')).toBeInTheDocument();
  const labels = ['Velocidad', 'Memoria', 'Atención', 'Flexibilidad mental', 'Lógica', 'Matemáticas'];
  const areaCard = screen.getByRole('heading', { name: 'Puntaje por área' }).parentElement as HTMLElement;
  const order = within(areaCard).getAllByText((_, el) => labels.includes(el?.textContent ?? '') && el?.tagName === 'SPAN');
  expect(order.map((e) => e.textContent)).toEqual(labels);
  expect(screen.getByText('Mejor 200')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /máximo 200, último 200/ })).toBeInTheDocument();
  expect(screen.getByText('Juega al menos dos partidas para ver tu evolución.')).toBeInTheDocument();
});

/** One saved round: a question of `category` per outcome, with ids `<category>-0001…`. */
function round(category: QuizCategory, outcomes: AnswerOutcome[]): QuizRoundDetails {
  return {
    items: outcomes.map((outcome, i) => ({
      question: makeChoice(`${category}-${String(i + 1).padStart(4, '0')}`, category, 1),
      outcome,
      chosen: outcome === 'correct' ? 0 : null,
    })),
  };
}

test('days trained and per-game charts ignore quiz games', async () => {
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 19, 9) });
  await addResult({ ...base, gameId: 'trivia-history', score: 250, playedAt: new Date(2026, 9, 20, 9) });
  await renderApp('/progress');
  expect(await statValue('Días entrenados')).toBe('1');

  const byGame = screen.getByRole('heading', { level: 2, name: 'Por juego' }).closest('section')!;
  expect(within(byGame).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Flechas']);
  expect(within(byGame).queryByRole('heading', { name: 'Historia' })).not.toBeInTheDocument();
});

test('shows mastery per category including mix answers', async () => {
  await addResult({ ...base, gameId: 'trivia-mix', score: 120, playedAt: new Date(2026, 9, 20, 9) });
  // Saved from the mix, counted under History: one hit, one miss.
  await addQuizAnswers('r1', round('history', ['correct', 'wrong']), new Date(2026, 9, 20, 9));
  await renderApp('/progress');

  expect(await screen.findByRole('heading', { level: 2, name: 'Preguntas' })).toBeInTheDocument();
  const meter = await screen.findByRole('meter', { name: 'Historia' });
  expect(screen.getByText('Dominio (últimos 30 días)')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Cultura general' })).toBeInTheDocument();
  expect(meter).toHaveAttribute('aria-valuenow', '50');
  expect(meter).toHaveAttribute('aria-valuemin', '0');
  expect(meter).toHaveAttribute('aria-valuemax', '100');
  expect(meter).toHaveAttribute('aria-valuetext', '50 %');
  // The bar wears the colour of its bank, like the area bars above.
  expect(meter.closest('[data-area]')).toHaveAttribute('data-area', 'trivia');
  expect(screen.getByText('50 %')).toBeInTheDocument();
  expect(screen.getByText(`Vistas: 2 de ${BANK_SIZES.history} · Mejor marca: —`)).toBeInTheDocument();
  // Categories without answers, and the bank without answers, are left out.
  expect(screen.queryByRole('meter', { name: 'Ciencias' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 3, name: 'Contabilidad' })).not.toBeInTheDocument();
});

test('mastery counts skips and time-outs as misses and rounds to a whole percent', async () => {
  await addResult({ ...base, gameId: 'accounting-lending', score: 180, playedAt: new Date(2026, 9, 20, 9) });
  await addResult({ ...base, gameId: 'accounting-lending', score: 90, playedAt: new Date(2026, 9, 10, 9) });
  await addQuizAnswers('r1', round('lending', ['correct', 'correct', 'skipped']), new Date(2026, 9, 20, 9));
  await renderApp('/progress');

  const meter = await screen.findByRole('meter', { name: 'Cartera y préstamos' });
  expect(meter).toHaveAttribute('aria-valuenow', '67');
  expect(screen.getByText('67 %')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Contabilidad' })).toBeInTheDocument();
  expect(screen.getByText(`Vistas: 3 de ${BANK_SIZES.lending} · Mejor marca: 180`)).toBeInTheDocument();
});

test('mastery only counts the last 30 days but seen counts every answer', async () => {
  await addResult({ ...base, gameId: 'trivia-science', score: 140, playedAt: new Date(2026, 8, 1, 9) });
  // Before the window (it opens on 2026-09-20): ignored by the percentage, still seen.
  await addQuizAnswers('r1', round('science', ['wrong', 'wrong']), new Date(2026, 8, 1, 9));
  await addQuizAnswers('r2', round('history', ['correct']), new Date(2026, 9, 1, 9));
  await renderApp('/progress');

  expect(await screen.findByRole('meter', { name: 'Historia' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.queryByRole('meter', { name: 'Ciencias' })).not.toBeInTheDocument();
});

test('hides the quiz block when there are no quiz games', async () => {
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 20, 9) });
  await addQuizAnswers('r1', round('history', ['correct']), new Date(2026, 9, 20, 9));
  await renderApp('/progress');

  expect(await statValue('Días entrenados')).toBe('1');
  expect(screen.queryByRole('heading', { name: 'Preguntas' })).not.toBeInTheDocument();
  expect(screen.queryByRole('meter', { name: 'Historia' })).not.toBeInTheDocument();
});

test('a quiz-only player sees no empty training sections', async () => {
  await addResult({ ...base, gameId: 'trivia-history', score: 250, playedAt: new Date(2026, 9, 20, 9) });
  await addQuizAnswers('r1', round('history', ['correct']), new Date(2026, 9, 20, 9));
  await renderApp('/progress');

  expect(await screen.findByRole('meter', { name: 'Historia' })).toBeInTheDocument();
  expect(
    screen.getByText('Juega un juego de entrenamiento para ver tus rachas y tu puntaje por área.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Racha actual/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Días entrenados/)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Puntaje por área' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Por juego' })).not.toBeInTheDocument();
  // The same way into training as the empty state.
  expect(screen.getByRole('link', { name: 'Ir a Hoy' })).toHaveAttribute('href', '/');
});

test('says so when no question was answered in the last 30 days', async () => {
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 20, 9) });
  await addResult({ ...base, gameId: 'trivia-science', score: 140, playedAt: new Date(2026, 8, 1, 9) });
  await addQuizAnswers('r1', round('science', ['correct']), new Date(2026, 8, 1, 9));
  await renderApp('/progress');

  const block = (await screen.findByRole('heading', { level: 2, name: 'Preguntas' })).closest('section')!;
  expect(await within(block).findByText('Sin respuestas en los últimos 30 días')).toBeInTheDocument();
  expect(within(block).queryByText('Dominio (últimos 30 días)')).not.toBeInTheDocument();
  expect(within(block).queryByRole('meter')).not.toBeInTheDocument();
  // The training sections are still there.
  expect(screen.getByRole('heading', { level: 2, name: 'Puntaje por área' })).toBeInTheDocument();
});

test('the quiz-only and no-recent-answers lines are in English too', async () => {
  await addResult({ ...base, gameId: 'trivia-science', score: 140, playedAt: new Date(2026, 8, 1, 9) });
  await addQuizAnswers('r1', round('science', ['correct']), new Date(2026, 8, 1, 9));
  await initI18n('en');
  render(
    <MemoryRouter>
      <ProgressScreen />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText('Play a training game to see your streaks and your score by area.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to Today' })).toBeInTheDocument();
  expect(await screen.findByText('No answers in the last 30 days')).toBeInTheDocument();
});

/** The local quiz answers cannot be read (IndexedDB closed or blocked). */
function failQuizAnswerReads() {
  vi.spyOn(db.quizAnswers, 'each').mockRejectedValue(new Error('IndexedDB closed'));
  vi.spyOn(db.quizAnswers, 'where').mockImplementation(() => {
    throw new Error('IndexedDB closed');
  });
}

test('the progress screen stays usable when the quiz answers cannot be read, and says so', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 20, 9) });
  await addResult({ ...base, gameId: 'trivia-history', score: 250, playedAt: new Date(2026, 9, 20, 9) });
  failQuizAnswerReads();
  await renderApp('/progress');
  expect(await statValue('Días entrenados')).toBe('1');
  const block = (await screen.findByRole('heading', { level: 2, name: 'Preguntas' })).closest('section')!;
  // Not «no answers»: the answers may well be there, this device just could not read them.
  expect(await within(block).findByText('No pudimos leer tus respuestas en este dispositivo.')).toBeInTheDocument();
  expect(within(block).queryByText('Sin respuestas en los últimos 30 días')).not.toBeInTheDocument();
  expect(within(block).queryByText('Dominio (últimos 30 días)')).not.toBeInTheDocument();
  expect(within(block).queryByRole('meter')).not.toBeInTheDocument();
  expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
});

test('the unreadable-answers line is in English too', async () => {
  await addResult({ ...base, gameId: 'trivia-history', score: 250, playedAt: new Date(2026, 9, 20, 9) });
  failQuizAnswerReads();
  await initI18n('en');
  render(
    <MemoryRouter>
      <ProgressScreen />
    </MemoryRouter>,
  );
  expect(await screen.findByText("We couldn't read your answers on this device.")).toBeInTheDocument();
  expect(screen.queryByText('No answers in the last 30 days')).not.toBeInTheDocument();
});
