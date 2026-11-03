import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { answerHistory } from '../../data/quizAnswers';
import { initI18n } from '../../i18n';
import { loadQuestions } from '../../quiz/banks/load';
import type { Question } from '../../quiz/types';
import { makePool, makeTrueFalse } from '../../test/quizFixtures';
import { speedBonus } from '../shared/scoring';
import { QUIZ_QUESTION_MS } from './engine';
import { QuizGame } from './Game';
import { QuizExample } from './Example';

vi.mock('../../quiz/banks/load', () => ({ loadQuestions: vi.fn() }));
vi.mock('../../data/quizAnswers', () => ({ answerHistory: vi.fn() }));

const historyPool = () => makePool('history', { 1: 20, 2: 20, 3: 20 });

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  vi.mocked(loadQuestions).mockReset();
  vi.mocked(answerHistory).mockReset();
  vi.mocked(loadQuestions).mockImplementation(async () => historyPool());
  vi.mocked(answerHistory).mockImplementation(async () => new Map());
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const settle = () => act(async () => {});

function gameElement(props: { paused?: boolean; onFinish?: () => void } = {}) {
  return (
    <QuizGame startLevel={1} paused={props.paused ?? false} onFinish={props.onFinish ?? vi.fn()} categories={['history']} />
  );
}

async function renderGame(props: { paused?: boolean } = {}) {
  const onFinish = vi.fn();
  const view = render(
    <QuizGame startLevel={1} paused={props.paused ?? false} onFinish={onFinish} categories={['history']} />,
  );
  await settle();
  return { onFinish, ...view };
}

const correctOption = () => screen.getByRole('button', { name: /Correcta history-/ });
const wrongOption = () => screen.getByRole('button', { name: /Incorrecta A history-/ });
const options = () => screen.getAllByRole('button', { name: /^[1-4] / });

test("shows question 1 of 10 with four options and I don't know", async () => {
  await renderGame();
  expect(loadQuestions).toHaveBeenCalledWith(['history']);
  expect(answerHistory).toHaveBeenCalledWith(['history']);
  expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();
  expect(screen.getByText('Historia')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^Pregunta history-\d{4}$/);
  expect(options()).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  expect(hud('Tiempo')).toBe('20');
  expect(hud('Puntos')).toBe('0');
  expect(hud('Nivel')).toBe('1');
  const bar = screen.getByRole('progressbar');
  expect(bar).toHaveAttribute('aria-valuemin', '0');
  expect(bar).toHaveAttribute('aria-valuemax', '20');
  expect(bar).toHaveAttribute('aria-valuenow', '20');
});

test('shows a loading message until the questions arrive', async () => {
  render(gameElement());
  expect(screen.getByText('Cargando preguntas…')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'No sé' })).not.toBeInTheDocument();
  await settle();
  expect(screen.queryByText('Cargando preguntas…')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
});

test('answering correctly shows the check, the explanation and the score', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  expect(screen.getByText('✓ Correcta')).toBeInTheDocument();
  expect(screen.queryByText('✗ Tu respuesta')).not.toBeInTheDocument();
  expect(screen.getByText(/^Explicación history-\d{4}$/)).toBeInTheDocument();
  expect(screen.queryByText(/Vigente a/)).not.toBeInTheDocument();
  expect(screen.getByText('¡Correcto!')).toBeInTheDocument();
  expect(hud('Puntos')).toBe(String(20 + speedBonus(1000, QUIZ_QUESTION_MS)));
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'No sé' })).not.toBeInTheDocument();
});

test('a wrong answer marks both options', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(wrongOption());
  expect(within(correctOption()).getByText('✓ Correcta')).toBeInTheDocument();
  expect(within(wrongOption()).getByText('✗ Tu respuesta')).toBeInTheDocument();
  expect(screen.getByText(/^Incorrecto\. La respuesta era: Correcta history-\d{4}$/)).toBeInTheDocument();
  // The points never go below zero.
  expect(hud('Puntos')).toBe('0');
});

test("keys 1-4 answer, 0 is I don't know and Enter goes next", async () => {
  await renderGame();
  advance(1000);
  fireEvent.keyDown(window, { key: '1' });
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.getByText('Pregunta 2 de 10')).toBeInTheDocument();

  advance(1000);
  const before = hud('Puntos');
  fireEvent.keyDown(window, { key: '0' });
  expect(screen.getByText(/^La respuesta era: Correcta history-\d{4}$/)).toBeInTheDocument();
  expect(within(correctOption()).getByText('✓ Correcta')).toBeInTheDocument();
  expect(screen.queryByText('✗ Tu respuesta')).not.toBeInTheDocument();
  expect(hud('Puntos')).toBe(before);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.getByText('Pregunta 3 de 10')).toBeInTheDocument();

  advance(1000);
  fireEvent.keyDown(window, { key: '5' });
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: '4' });
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
});

test('time runs out after 20 seconds without a penalty', async () => {
  await renderGame();
  advance(19_900);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  advance(100);
  expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
  expect(screen.getByText(/^Se acabó el tiempo\. La respuesta era: Correcta history-\d{4}$/)).toBeInTheDocument();
  expect(within(correctOption()).getByText('✓ Correcta')).toBeInTheDocument();
  expect(screen.queryByText('✗ Tu respuesta')).not.toBeInTheDocument();
  expect(hud('Puntos')).toBe('0');
  expect(hud('Tiempo')).toBe('0');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
});

test('a time-out keeps the points already earned and counts as a miss for the level', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  const earned = hud('Puntos');
  expect(Number(earned)).toBeGreaterThan(0);
  fireEvent.keyDown(window, { key: 'Enter' });
  advance(QUIZ_QUESTION_MS);
  expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
  expect(hud('Puntos')).toBe(earned);
  expect(screen.getByText('Pregunta 2 de 10')).toBeInTheDocument();
});

test('the timer cannot fire after an answer', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  const score = hud('Puntos');
  advance(25_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  expect(screen.getByText(/^Explicación history-\d{4}$/)).toBeInTheDocument();
  expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();
  expect(hud('Puntos')).toBe(score);
});

test('a tap right after Next does not answer the new question', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  const score = hud('Puntos');
  advance(100);
  fireEvent.click(options()[0]);
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  expect(hud('Puntos')).toBe(score);
  advance(60);
  fireEvent.click(options()[0]);
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
});

test("a tap on I don't know right after Next does not skip the new question", async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  const score = hud('Puntos');
  advance(100);
  fireEvent.click(screen.getByRole('button', { name: 'No sé' }));
  fireEvent.keyDown(window, { key: '0' });
  // Still asking: «No sé» is there, nothing was recorded, no feedback and the same points.
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  expect(screen.queryByText(/^La respuesta era:/)).not.toBeInTheDocument();
  expect(options()).toHaveLength(4);
  expect(hud('Puntos')).toBe(score);

  advance(50);
  fireEvent.click(screen.getByRole('button', { name: 'No sé' }));
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  expect(screen.getByText(/^La respuesta era: Correcta history-\d{4}$/)).toBeInTheDocument();
});

test('the 0 key does not skip within 150 ms of a new question, then it does', async () => {
  await renderGame();
  advance(1000);
  fireEvent.keyDown(window, { key: '1' });
  fireEvent.keyDown(window, { key: 'Enter' });
  advance(149);
  fireEvent.keyDown(window, { key: '0' });
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
  advance(1);
  fireEvent.keyDown(window, { key: '0' });
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
});

test('the timer stops while paused and keeps the time that was left', async () => {
  const onFinish = vi.fn();
  const view = render(gameElement({ onFinish }));
  await settle();
  advance(5000);
  expect(hud('Tiempo')).toBe('15');

  view.rerender(gameElement({ paused: true, onFinish }));
  advance(30_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  expect(hud('Tiempo')).toBe('15');
  // Answers are blocked while paused.
  fireEvent.keyDown(window, { key: '1' });
  fireEvent.keyDown(window, { key: '0' });

  view.rerender(gameElement({ paused: false, onFinish }));
  expect(screen.getByRole('button', { name: 'No sé' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  advance(14_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  advance(1000);
  expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
});

test('the question is hidden while paused, so a pause gives no extra time to think', async () => {
  const view = render(gameElement());
  await settle();
  const prompt = screen.getByRole('heading', { level: 2 }).textContent ?? '';
  view.rerender(gameElement({ paused: true }));
  expect(screen.getByText(prompt)).not.toBeVisible();
  expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  expect(screen.queryAllByRole('button', { name: /^[1-4] / })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'No sé' })).not.toBeInTheDocument();
  // The HUD and the counter stay, with the clock stopped.
  expect(hud('Tiempo')).toBe('20');
  expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();

  view.rerender(gameElement({ paused: false }));
  expect(screen.getByText(prompt)).toBeVisible();
  expect(options()).toHaveLength(4);
});

test('paused has no effect while the questions are loading', async () => {
  const view = render(gameElement({ paused: true }));
  expect(screen.getByText('Cargando preguntas…')).toBeInTheDocument();
  await settle();
  // Loaded, but hidden until the pause ends.
  expect(screen.getByText('No sé')).not.toBeVisible();
  advance(30_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  view.rerender(gameElement({ paused: false }));
  advance(19_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  advance(1000);
  expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
});

test('the question clock starts when the first question appears, not while it loads', async () => {
  let release: (questions: Question[]) => void = () => {};
  vi.mocked(loadQuestions).mockImplementation(
    () =>
      new Promise<Question[]>((resolve) => {
        release = resolve;
      }),
  );
  render(gameElement());
  advance(5000);
  await act(async () => release(historyPool()));
  expect(hud('Tiempo')).toBe('20');
  advance(19_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  advance(1000);
  expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
});

test('shows the as-of line when a question has asOf', async () => {
  vi.mocked(loadQuestions).mockImplementation(async () => historyPool().map((q) => ({ ...q, asOf: '2026-11' })));
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  expect(screen.getByText('Vigente a noviembre de 2026')).toBeInTheDocument();
});

test('keeps numbers and percentages on one line in the question, the options and the explanation', async () => {
  vi.mocked(loadQuestions).mockImplementation(async () =>
    historyPool().map((q) =>
      q.type === 'choice'
        ? {
            ...q,
            es: {
              question: '¿Cuánto es 19 % de 120 000?',
              options: ['22 800', '2 280', '228 000', '1 200 000'],
              explanation: 'El 19 % de 120 000 es 22 800.',
            },
          }
        : q,
    ),
  );
  const { container } = await renderGame();
  expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('¿Cuánto es 19\u202F% de 120\u202F000?');
  expect(options().map((o) => o.textContent?.replace(/^\d /, ''))).toEqual(
    expect.arrayContaining(['22\u202F800', '2\u202F280', '228\u202F000', '1\u202F200\u202F000']),
  );
  advance(1000);
  fireEvent.keyDown(window, { key: '1' });
  expect(container.textContent).toContain('El 19\u202F% de 120\u202F000 es 22\u202F800.');
});

test('shows an error and retries when questions cannot load', async () => {
  vi.mocked(loadQuestions).mockRejectedValueOnce(new Error('offline'));
  render(gameElement());
  await settle();
  expect(screen.getByText('No pudimos cargar las preguntas.')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(screen.getByText('Cargando preguntas…')).toBeInTheDocument();
  await settle();
  expect(loadQuestions).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();
});

test('plays with an empty history when it cannot be read', async () => {
  vi.mocked(answerHistory).mockRejectedValueOnce(new Error('db closed'));
  await renderGame();
  expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();
  expect(options()).toHaveLength(4);
});

test('reports one result with 10 items after the last question', async () => {
  const { onFinish } = await renderGame();
  for (let n = 1; n <= 10; n++) {
    expect(screen.getByText(`Pregunta ${n} de 10`)).toBeInTheDocument();
    advance(1000);
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByRole('button', { name: n === 10 ? 'Ver resultado' : 'Siguiente' })).toBeInTheDocument();
    if (n < 10) fireEvent.keyDown(window, { key: 'Enter' });
  }
  expect(onFinish).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
  const result = onFinish.mock.calls[0][0];
  expect(result.quiz.items).toHaveLength(10);
  expect(result.durationMs).toBe(10_000);
  expect(result.accuracy).toBeGreaterThanOrEqual(0);
});

test('moves focus to Next after answering so Enter from the keyboard continues', async () => {
  await renderGame();
  advance(1000);
  fireEvent.click(correctOption());
  expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
});

describe('a new question on a small screen', () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockReset();
    // jsdom has neither scrollIntoView nor matchMedia.
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.unstubAllGlobals();
  });

  test('after Next, focus moves to the new question and the game scrolls back into view', async () => {
    await renderGame();
    advance(1000);
    fireEvent.click(correctOption());
    const first = screen.getByRole('heading', { level: 2 }).textContent;
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).not.toBe(first);
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toContainElement(screen.getByRole('progressbar'));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  test('the first question also gets the focus', async () => {
    await renderGame();
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  test('scrolls without animation when the player prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    await renderGame();
    advance(1000);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
  });
});

test('true/false questions have two options in fixed order and ignore other keys', async () => {
  vi.mocked(loadQuestions).mockImplementation(async () =>
    Array.from({ length: 30 }, (_, i): Question => makeTrueFalse(`history-${String(i + 1).padStart(4, '0')}`, 'history', 1, true)),
  );
  await renderGame();
  const [first, second] = options();
  expect(first).toHaveAccessibleName(/^1 Verdadero$/);
  expect(second).toHaveAccessibleName(/^2 Falso$/);
  expect(options()).toHaveLength(2);
  advance(1000);
  fireEvent.keyDown(window, { key: '3' });
  expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: '2' });
  expect(within(screen.getByRole('button', { name: /Verdadero/ })).getByText('✓ Correcta')).toBeInTheDocument();
  expect(within(screen.getByRole('button', { name: /Falso/ })).getByText('✗ Tu respuesta')).toBeInTheDocument();
  expect(hud('Puntos')).toBe('0');
});

test('uses the English texts when the language is English', async () => {
  await initI18n('en');
  await renderGame();
  expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: "I don't know" })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^Question history-\d{4}$/);
  advance(1000);
  fireEvent.click(screen.getByRole('button', { name: /Correct history-/ }));
  expect(screen.getByText('✓ Correct')).toBeInTheDocument();
  expect(screen.getByText('Correct!')).toBeInTheDocument();
  expect(screen.getByText(/^Explanation history-\d{4}$/)).toBeInTheDocument();
});

describe('QuizExample', () => {
  test('shows a solved question with the correct option marked and no controls to act on', () => {
    render(<QuizExample />);
    expect(screen.getByText('¿Cuál es el planeta más grande del sistema solar?')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^[1-4] / })).toHaveLength(4);
    expect(within(screen.getByRole('button', { name: /Júpiter/ })).getByText('✓ Correcta')).toBeInTheDocument();
    expect(screen.queryByText('✗ Tu respuesta')).not.toBeInTheDocument();
    expect(screen.getByText(/más del doble de masa/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No sé' })).not.toBeInTheDocument();
  });

  test('is available in English', async () => {
    await initI18n('en');
    render(<QuizExample />);
    expect(screen.getByText('Which is the largest planet in the Solar System?')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Jupiter/ })).getByText('✓ Correct')).toBeInTheDocument();
  });
});
