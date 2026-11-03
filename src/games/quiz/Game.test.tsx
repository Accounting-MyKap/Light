import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { answerHistory } from '../../data/quizAnswers';
import { initI18n } from '../../i18n';
import { loadQuestions } from '../../quiz/banks/load';
import type { Question } from '../../quiz/types';
import { makePool, makeTrueFalse } from '../../test/quizFixtures';
import { FeedbackProvider } from '../shared/feedback';
import { PlayChromeContext, type PlayChrome } from '../shared/playChrome';
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
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
/** The whole seconds left on the time bar of the frame. */
const secondsLeft = () => screen.getByRole('progressbar', { name: 'Tiempo' }).getAttribute('aria-valuenow');
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
const options = () => screen.getAllByRole('button', { name: /^Opción [1-4]: / });

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
  expect(secondsLeft()).toBe('20');
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
  expect(secondsLeft()).toBe('0');
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
  expect(secondsLeft()).toBe('15');

  view.rerender(gameElement({ paused: true, onFinish }));
  advance(30_000);
  expect(screen.queryByText('Se acabó el tiempo')).not.toBeInTheDocument();
  expect(secondsLeft()).toBe('15');
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
  expect(screen.queryAllByRole('button', { name: /^Opción [1-4]: / })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'No sé' })).not.toBeInTheDocument();
  // The HUD and the counter stay, with the clock stopped.
  expect(secondsLeft()).toBe('20');
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
  expect(secondsLeft()).toBe('20');
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
  expect(options().map((o) => o.textContent?.replace(/^\dOpción \d: /, ''))).toEqual(
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

test('after a second failure in a row it also offers to reload the page', async () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  vi.mocked(loadQuestions).mockRejectedValueOnce(new Error('stale chunk')).mockRejectedValueOnce(new Error('stale chunk'));
  render(gameElement());
  await settle();
  expect(screen.queryByRole('button', { name: 'Recargar la página' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await settle();
  expect(screen.getByText('No pudimos cargar las preguntas.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Recargar la página' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('the reload button is in English too', async () => {
  await initI18n('en');
  vi.mocked(loadQuestions).mockRejectedValue(new Error('offline'));
  render(gameElement());
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await settle();
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
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

describe('the focus around a pause and a failed load (keyboard and screen readers)', () => {
  /** The pause sheet's button, outside the game: while the game is paused it holds the focus. */
  const withSheet = (game: ReturnType<typeof gameElement>) => (
    <>
      <button type="button">Continuar</button>
      {game}
    </>
  );
  const sheetButton = () => screen.getByRole('button', { name: 'Continuar' });

  test('after a pause while asking, the focus goes back to the question', async () => {
    const view = render(withSheet(gameElement()));
    await settle();
    view.rerender(withSheet(gameElement({ paused: true })));
    sheetButton().focus();
    view.rerender(withSheet(gameElement({ paused: false })));
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  test('after a pause on an answered question, the focus goes back to «Siguiente»', async () => {
    const view = render(withSheet(gameElement()));
    await settle();
    advance(1000);
    fireEvent.click(correctOption());
    view.rerender(withSheet(gameElement({ paused: true })));
    sheetButton().focus();
    view.rerender(withSheet(gameElement({ paused: false })));
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus();
  });

  test('a first question that loads while paused leaves the focus on the sheet, and takes it when play resumes', async () => {
    const view = render(withSheet(gameElement({ paused: true })));
    sheetButton().focus();
    await settle();
    expect(screen.getByText('Pregunta 1 de 10')).toBeInTheDocument();
    expect(sheetButton()).toHaveFocus();
    view.rerender(withSheet(gameElement({ paused: false })));
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  test('after «Reintentar» the focus goes to the loading line, then to the first question', async () => {
    let release: (questions: Question[]) => void = () => {};
    vi.mocked(loadQuestions)
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(
        () =>
          new Promise<Question[]>((resolve) => {
            release = resolve;
          }),
      );
    render(gameElement());
    await settle();
    const retry = screen.getByRole('button', { name: 'Reintentar' });
    retry.focus();
    fireEvent.click(retry);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando preguntas…');
    expect(screen.getByRole('status')).toHaveFocus();
    await act(async () => release(historyPool()));
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  test('when «Reintentar» fails again, the focus comes back to it', async () => {
    vi.mocked(loadQuestions).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    render(gameElement());
    await settle();
    const retry = screen.getByRole('button', { name: 'Reintentar' });
    retry.focus();
    fireEvent.click(retry);
    await settle();
    expect(screen.getByText('No pudimos cargar las preguntas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  });
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
  });

  test('after Next, focus moves to the new question and the game scrolls back into view', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
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

  test('scrolls without animation when the browser cannot tell the motion preference', async () => {
    // Like every Luz animation: without matchMedia (jsdom) nothing should move.
    await renderGame();
    advance(1000);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
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

test('each option is announced as «Opción N:» while the number stays on screen', async () => {
  await renderGame();
  const [first, second] = options();
  expect(first).toHaveAccessibleName(/^Opción 1: (Correcta|Incorrecta [ABC]) history-\d{4}$/);
  expect(second).toHaveAccessibleName(/^Opción 2: /);
  // The visible number is decoration for sighted players; the label reads it out once.
  expect(within(first).getByText('1')).toHaveAttribute('aria-hidden', 'true');
  expect(within(first).getByText('Opción 1:')).toHaveClass('visually-hidden');
});

test('options are announced as "Option N:" in English', async () => {
  await initI18n('en');
  await renderGame();
  expect(screen.getAllByRole('button', { name: /^Option [1-4]: / })).toHaveLength(4);
});

test('true/false questions have two options in fixed order and ignore other keys', async () => {
  vi.mocked(loadQuestions).mockImplementation(async () =>
    Array.from({ length: 30 }, (_, i): Question => makeTrueFalse(`history-${String(i + 1).padStart(4, '0')}`, 'history', 1, true)),
  );
  await renderGame();
  const [first, second] = options();
  expect(first).toHaveAccessibleName('Opción 1: Verdadero');
  expect(second).toHaveAccessibleName('Opción 2: Falso');
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
    expect(screen.getAllByRole('button', { name: /^Opción [1-4]: / })).toHaveLength(4);
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

describe('in the Luz frame', () => {
  const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);
  const zone = (name: 'stage' | 'controls') => document.querySelector<HTMLElement>(`[data-zone="${name}"]`);
  const chrome = (): PlayChrome => ({ title: 'Historia', onPause: vi.fn(), reportHud: vi.fn() });

  /** The game as the play screen mounts it: inside the feedback provider and, when given, the play chrome. */
  function framed(playChrome: PlayChrome | null = null) {
    return (
      <FeedbackProvider>
        <PlayChromeContext.Provider value={playChrome}>{gameElement()}</PlayChromeContext.Provider>
      </FeedbackProvider>
    );
  }

  test('a right answer flashes as correct and a wrong one as wrong', async () => {
    render(framed());
    await settle();
    expect(flashes()).toEqual([]);
    advance(1000);
    fireEvent.click(correctOption());
    expect(flashes()).toEqual(['correct']);
    fireEvent.keyDown(window, { key: 'Enter' });
    advance(1000);
    fireEvent.click(wrongOption());
    expect(flashes()).toEqual(['wrong']);
  });

  test('a time-out and «No sé» cost nothing, so they flash as a timeout', async () => {
    render(framed());
    await settle();
    advance(QUIZ_QUESTION_MS);
    expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
    expect(flashes()).toEqual(['timeout']);
    fireEvent.keyDown(window, { key: 'Enter' });
    advance(1000);
    fireEvent.click(screen.getByRole('button', { name: 'No sé' }));
    expect(flashes()).toEqual(['timeout']);
    // Going on to the next question is not an answer: no new reaction.
    const flash = document.querySelector('[data-flash]');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(document.querySelector('[data-flash]')).toBe(flash);
  });

  test('the question is the game zone; the options, «No sé» and «Siguiente» are the controls below it', async () => {
    render(framed());
    await settle();
    const stage = zone('stage');
    const controls = zone('controls');
    expect(stage).toContainElement(screen.getByText('Pregunta 1 de 10'));
    expect(stage).toContainElement(screen.getByText('Historia'));
    expect(stage).toContainElement(screen.getByRole('heading', { level: 2 }));
    for (const option of options()) {
      expect(controls).toContainElement(option);
      expect(stage).not.toContainElement(option);
    }
    expect(controls).toContainElement(screen.getByRole('button', { name: 'No sé' }));

    advance(1000);
    fireEvent.click(correctOption());
    expect(controls).toContainElement(screen.getByText(/^Explicación history-\d{4}$/));
    expect(controls).toContainElement(screen.getByRole('button', { name: 'Siguiente' }));
    // Read in the same order as before: the options, then the explanation, then «Siguiente».
    const explanation = screen.getByText(/^Explicación history-\d{4}$/);
    expect(options()[3].compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('once answered, the stopped time bar is no longer urgent', async () => {
    render(framed());
    await settle();
    advance(16_000);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'true');
    fireEvent.click(correctOption());
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'false');
    expect(secondsLeft()).toBe('4');
  });

  test('the time bar is urgent only in the last 5 seconds', async () => {
    render(framed());
    await settle();
    advance(12_000);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'false');
    advance(4_000);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'true');
  });

  test('the frame tells the play screen the time left on the question, for its pause sheet', async () => {
    const playChrome = chrome();
    render(framed(playChrome));
    await settle();
    expect(playChrome.reportHud).toHaveBeenLastCalledWith({ score: 0, remainingMs: QUIZ_QUESTION_MS });
    advance(5000);
    expect(playChrome.reportHud).toHaveBeenLastCalledWith({ score: 0, remainingMs: 15_000 });
  });

  test('while the questions load, and after they fail to, the frame keeps its title and ✕', async () => {
    vi.mocked(loadQuestions).mockRejectedValueOnce(new Error('offline'));
    const playChrome = chrome();
    render(framed(playChrome));
    expect(screen.getByText('Cargando preguntas…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir del juego' })).toBeInTheDocument();
    await settle();
    expect(screen.getByText('No pudimos cargar las preguntas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(playChrome.onPause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  test('options with the same text in both languages still get keys of their own', async () => {
    // A question whose options read the same in Spanish and in English, and two that read the same in one language.
    vi.mocked(loadQuestions).mockImplementation(async () =>
      historyPool().map((q) =>
        q.type === 'choice' ? { ...q, en: { ...q.en, options: ['42', '42', '7', '7'] }, es: { ...q.es, options: ['42', '24', '7', '70'] } } : q,
      ),
    );
    await initI18n('en');
    render(framed());
    await settle();
    expect(screen.getAllByRole('button', { name: /^Option [1-4]: / })).toHaveLength(4);
    // setupTests fails the test if React saw two siblings with the same key.
  });
});

test('a quiz round never shows the level-up badge, even after four right answers in a row', async () => {
  await renderGame();
  for (let i = 0; i < 4; i++) {
    advance(1000);
    fireEvent.click(correctOption());
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  }
  expect(hud('Nivel')).toBe('2');
  expect(screen.queryByTestId('level-up')).not.toBeInTheDocument();
});
