import { render, screen, within } from '@testing-library/react';
import { initI18n } from '../../i18n';
import type { AnswerOutcome, Question, QuizRoundItem } from '../../quiz/types';
import { makeChoice, makeTrueFalse } from '../../test/quizFixtures';
import type { GameResult } from '../types';
import { QuizReview } from './QuizReview';

function resultOf(items: QuizRoundItem[]): GameResult {
  return { score: 100, accuracy: 0.7, levelReached: 2, durationMs: 60000, quiz: { items } };
}

const item = (question: Question, outcome: AnswerOutcome, chosen: number | null): QuizRoundItem => ({
  question,
  outcome,
  chosen,
});

const correctItems = (count: number) =>
  Array.from({ length: count }, (_, i) => item(makeChoice(`ok-${i + 1}`, 'history', 1), 'correct', 0));

/** 1 wrong, 1 skipped, 1 timeout and 7 correct, the three misses in different shapes. */
function roundWithMisses(): GameResult {
  return resultOf([
    item(makeChoice('w-1', 'history', 2, { asOf: '2025-06' }), 'wrong', 2),
    ...correctItems(3),
    item(makeChoice('s-1', 'science', 1), 'skipped', null),
    ...correctItems(2),
    item(makeTrueFalse('t-1', 'geography', 1, true), 'timeout', null),
    ...correctItems(2),
  ]);
}

beforeEach(async () => {
  await initI18n('es');
});

test('lists only missed questions with your answer, the right one and the explanation', () => {
  render(<QuizReview result={roundWithMisses()} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Repasa tus errores' })).toBeInTheDocument();

  const articles = screen.getAllByRole('article');
  expect(articles).toHaveLength(3);
  expect(screen.queryByText('Pregunta ok-1')).not.toBeInTheDocument();

  // Wrong: the option the player picked, the right one, the explanation and the date the rule is current to.
  const wrong = within(articles[0]);
  expect(wrong.getByText('Pregunta w-1')).toBeInTheDocument();
  expect(wrong.getByText('Tu respuesta: Incorrecta B w-1')).toBeInTheDocument();
  expect(wrong.getByText('Respuesta correcta: Correcta w-1')).toBeInTheDocument();
  expect(wrong.getByText('Explicación w-1')).toBeInTheDocument();
  expect(wrong.getByText('Vigente a junio de 2025')).toBeInTheDocument();

  // Skipped with «No sé»: it says so, and there is no date for a question without asOf.
  const skipped = within(articles[1]);
  expect(skipped.getByText('Pregunta s-1')).toBeInTheDocument();
  expect(skipped.getByText('Tu respuesta: No sé')).toBeInTheDocument();
  expect(skipped.getByText('Respuesta correcta: Correcta s-1')).toBeInTheDocument();
  expect(skipped.getByText('Explicación s-1')).toBeInTheDocument();
  expect(skipped.queryByText(/Vigente a/)).not.toBeInTheDocument();

  // Time out: no answer, and the true/false right answer comes from the translated labels.
  const timeout = within(articles[2]);
  expect(timeout.getByText('Afirmación t-1')).toBeInTheDocument();
  expect(timeout.getByText('Sin respuesta')).toBeInTheDocument();
  expect(timeout.queryByText(/Tu respuesta/)).not.toBeInTheDocument();
  expect(timeout.getByText('Respuesta correcta: Verdadero')).toBeInTheDocument();
  expect(timeout.getByText('Explicación t-1')).toBeInTheDocument();
});

test('a wrong true/false answer shows the other label as yours', () => {
  const result = resultOf([item(makeTrueFalse('t-2', 'math', 1, true), 'wrong', 1)]);
  render(<QuizReview result={result} />);
  expect(screen.getByText('Tu respuesta: Falso')).toBeInTheDocument();
  expect(screen.getByText('Respuesta correcta: Verdadero')).toBeInTheDocument();
});

test('says there were no mistakes when every answer was right', () => {
  render(<QuizReview result={resultOf(correctItems(10))} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Repasa tus errores' })).toBeInTheDocument();
  expect(screen.getByText('¡Sin errores en esta ronda!')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

test('shows nothing when the result carries no quiz details', () => {
  const { container } = render(
    <QuizReview result={{ score: 10, accuracy: 1, levelReached: 1, durationMs: 1000 }} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test('everything is in the current language', async () => {
  await initI18n('en');
  render(<QuizReview result={roundWithMisses()} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Review your mistakes' })).toBeInTheDocument();
  const [wrong, skipped, timeout] = screen.getAllByRole('article').map((a) => within(a));
  expect(wrong.getByText('Question w-1')).toBeInTheDocument();
  expect(wrong.getByText('Your answer: Incorrect B w-1')).toBeInTheDocument();
  expect(wrong.getByText('Correct answer: Correct w-1')).toBeInTheDocument();
  expect(wrong.getByText('Explanation w-1')).toBeInTheDocument();
  expect(wrong.getByText('Current as of June 2025')).toBeInTheDocument();
  expect(skipped.getByText("Your answer: I don't know")).toBeInTheDocument();
  expect(timeout.getByText('No answer')).toBeInTheDocument();
  expect(timeout.getByText('Correct answer: True')).toBeInTheDocument();
});

test('no mistakes, in English', async () => {
  await initI18n('en');
  render(<QuizReview result={resultOf(correctItems(10))} />);
  expect(screen.getByText('No mistakes this round!')).toBeInTheDocument();
});

test('keeps numbers and percentages on one line', () => {
  const question = makeChoice('n-1', 'us', 1, {
    es: {
      question: '¿Cuánto es 19 % de 120 000?',
      options: ['22 800', '2 280', '228 000', '12 000'],
      explanation: 'El 19 % de 120 000 es 22 800.',
    },
  });
  render(<QuizReview result={resultOf([item(question, 'wrong', 3)])} />);
  const article = screen.getByRole('article');
  // U+202F is a narrow no-break space; the default text matcher would treat it as a plain space.
  expect(within(article).getByRole('heading', { level: 3 }).textContent).toBe('¿Cuánto es 19 % de 120 000?');
  expect(article.textContent).toContain('Tu respuesta: 12 000');
  expect(article.textContent).toContain('Respuesta correcta: 22 800');
  expect(article.textContent).toContain('El 19 % de 120 000 es 22 800.');
  expect(article.textContent).not.toMatch(/\d [\d%]/);
});
