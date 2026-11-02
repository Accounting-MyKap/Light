import { createRng } from '../../core/rng';
import { makePool, makeTrueFalse } from '../../test/quizFixtures';
import { correctIndex, type Question } from '../../quiz/types';
import { MIN_RT_MS } from '../shared/constants';
import { speedBonus } from '../shared/scoring';
import {
  QUIZ_CORRECT_POINTS,
  QUIZ_MAX_SCORE,
  QUIZ_QUESTION_MS,
  QUIZ_ROUND_LENGTH,
  QUIZ_WRONG_PENALTY,
  answerQuestion,
  createQuizRound,
  dontKnow,
  lastItem,
  nextQuestion,
  quizResult,
  timeOutQuestion,
  type QuizRoundState,
} from './engine';

const pool = makePool('history', { 1: 20, 2: 20, 3: 20 });
const trueFalsePool: Question[] = Array.from({ length: 30 }, (_, i) =>
  makeTrueFalse(`history-${String(i + 1).padStart(4, '0')}`, 'history', 1, i % 2 === 0),
);

const shownOf = (state: QuizRoundState, canonical: number) => state.current.order.indexOf(canonical);
const correctShown = (state: QuizRoundState) => shownOf(state, correctIndex(state.current.question));
const wrongShown = (state: QuizRoundState) => shownOf(state, correctIndex(state.current.question) === 0 ? 1 : 0);

/** Answers the current question, then moves on to the next one at `now + 1000`. */
function play(state: QuizRoundState, right: boolean, rng = createRng(99), at = 1000): QuizRoundState {
  const answered = answerQuestion(state, right ? correctShown(state) : wrongShown(state), state.current.askedAt + at);
  return nextQuestion(answered, rng, state.current.askedAt + at + 1);
}

test('constants', () => {
  expect(QUIZ_ROUND_LENGTH).toBe(10);
  expect(QUIZ_QUESTION_MS).toBe(20_000);
  expect(QUIZ_CORRECT_POINTS).toBe(20);
  expect(QUIZ_MAX_SCORE).toBe(300);
  expect(QUIZ_WRONG_PENALTY).toEqual({ choice: 10, truefalse: 30 });
});

test('a new round starts asking with an empty score', () => {
  const s = createQuizRound(pool, new Map(), 1, createRng(7), 500);
  expect(s.phase).toBe('asking');
  expect(s.score).toBe(0);
  expect(s.correct).toBe(0);
  expect(s.items).toEqual([]);
  expect(s.current.askedAt).toBe(500);
  expect(s.staircase.level).toBe(1);
  expect(lastItem(s)).toBeUndefined();
});

test('a correct answer scores 20 plus the speed bonus', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  s = answerQuestion(s, shownOf(s, 0), 2000);
  expect(s.score).toBe(20 + speedBonus(2000, 20_000)); // 29
  expect(s.score).toBe(29);
  expect(s.correct).toBe(1);
  expect(s.phase).toBe('feedback');
  expect(lastItem(s)).toMatchObject({ outcome: 'correct', chosen: 0 });
});

test('a wrong choice costs 10 and never goes below 0', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  s = answerQuestion(s, wrongShown(s), 2000);
  expect(s.score).toBe(0);
  expect(lastItem(s)).toMatchObject({ outcome: 'wrong' });
  expect(s.correct).toBe(0);

  let t = createQuizRound(pool, new Map(), 1, createRng(7), 0);
  t = answerQuestion(t, correctShown(t), 2000);
  expect(t.score).toBe(29);
  t = nextQuestion(t, rng, 3000);
  t = answerQuestion(t, wrongShown(t), 5000);
  expect(t.score).toBe(19);
});

test('a wrong true/false costs 30', () => {
  const rng = createRng(7);
  let s = createQuizRound(trueFalsePool, new Map(), 1, rng, 0);
  s = answerQuestion(s, correctShown(s), 2000);
  expect(s.score).toBe(29);
  s = nextQuestion(s, rng, 3000);
  s = answerQuestion(s, wrongShown(s), 5000);
  expect(s.score).toBe(0);

  let t = createQuizRound(trueFalsePool, new Map(), 1, rng, 0);
  t = answerQuestion(t, correctShown(t), 2000);
  t = nextQuestion(t, rng, 3000);
  t = answerQuestion(t, correctShown(t), 5000);
  expect(t.score).toBe(58);
  t = nextQuestion(t, rng, 6000);
  t = answerQuestion(t, wrongShown(t), 8000);
  expect(t.score).toBe(28);
});

test('dont know and time out score 0 and count as misses', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  s = answerQuestion(s, correctShown(s), 2000);
  s = nextQuestion(s, rng, 3000);

  const skipped = dontKnow(s);
  expect(skipped.phase).toBe('feedback');
  expect(skipped.score).toBe(29);
  expect(skipped.correct).toBe(1);
  expect(lastItem(skipped)).toMatchObject({ outcome: 'skipped', chosen: null });
  expect(skipped.staircase.wrongStreak).toBe(1);

  const timedOut = timeOutQuestion(s);
  expect(timedOut.phase).toBe('feedback');
  expect(timedOut.score).toBe(29);
  expect(timedOut.correct).toBe(1);
  expect(lastItem(timedOut)).toMatchObject({ outcome: 'timeout', chosen: null });
  expect(timedOut.staircase.wrongStreak).toBe(1);
});

test('ignores answers faster than MIN_RT_MS', () => {
  const s = createQuizRound(pool, new Map(), 1, createRng(7), 1000);
  expect(answerQuestion(s, correctShown(s), 1000 + MIN_RT_MS - 1)).toBe(s);
  const answered = answerQuestion(s, correctShown(s), 1000 + MIN_RT_MS);
  expect(answered).not.toBe(s);
  expect(answered.phase).toBe('feedback');
});

test('ignores answers outside the options', () => {
  const s = createQuizRound(pool, new Map(), 1, createRng(7), 0);
  expect(answerQuestion(s, -1, 2000)).toBe(s);
  expect(answerQuestion(s, 4, 2000)).toBe(s);
  expect(answerQuestion(s, 1.5, 2000)).toBe(s);

  const tf = createQuizRound(trueFalsePool, new Map(), 1, createRng(7), 0);
  expect(answerQuestion(tf, 2, 2000)).toBe(tf);
});

test('ignores answers outside asking', () => {
  const rng = createRng(7);
  const asking = createQuizRound(pool, new Map(), 1, rng, 0);
  const feedback = answerQuestion(asking, correctShown(asking), 2000);
  expect(answerQuestion(feedback, correctShown(feedback), 4000)).toBe(feedback);
  expect(dontKnow(feedback)).toBe(feedback);
  expect(timeOutQuestion(feedback)).toBe(feedback);

  let finished = asking;
  for (let i = 0; i < QUIZ_ROUND_LENGTH; i++) finished = play(finished, true, rng);
  expect(finished.phase).toBe('finished');
  expect(answerQuestion(finished, correctShown(finished), finished.current.askedAt + 2000)).toBe(finished);
  expect(dontKnow(finished)).toBe(finished);
  expect(timeOutQuestion(finished)).toBe(finished);
});

test('nextQuestion only acts in feedback', () => {
  const rng = createRng(7);
  const asking = createQuizRound(pool, new Map(), 1, rng, 0);
  expect(nextQuestion(asking, rng, 1000)).toBe(asking);
  const feedback = answerQuestion(asking, correctShown(asking), 2000);
  const next = nextQuestion(feedback, rng, 3000);
  expect(next.phase).toBe('asking');
  expect(next.current.askedAt).toBe(3000);
  expect(next.current.question.id).not.toBe(asking.current.question.id);
  expect(next.items).toHaveLength(1);
});

test('ten fast correct answers score the maximum 300', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  for (let i = 0; i < QUIZ_ROUND_LENGTH; i++) s = play(s, true, rng, MIN_RT_MS);
  expect(s.score).toBe(300);
  expect(s.score).toBe(QUIZ_MAX_SCORE);
  expect(s.correct).toBe(10);
  expect(s.phase).toBe('finished');
});

test('finishes after 10 questions', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  for (let i = 0; i < QUIZ_ROUND_LENGTH - 1; i++) {
    s = play(s, i % 2 === 0, rng);
    expect(s.phase).toBe('asking');
  }
  s = answerQuestion(s, correctShown(s), s.current.askedAt + 2000);
  expect(s.phase).toBe('feedback');
  expect(s.items).toHaveLength(10);
  s = nextQuestion(s, rng, 99_000);
  expect(s.phase).toBe('finished');
  expect(nextQuestion(s, rng, 100_000)).toBe(s);
  expect(new Set(s.items.map((i) => i.question.id)).size).toBe(10);
});

test('finishes early when the pool runs out', () => {
  const rng = createRng(7);
  const small = makePool('history', { 1: 3, 2: 0, 3: 0 });
  let s = createQuizRound(small, new Map(), 1, rng, 0);
  s = play(s, true, rng);
  s = play(s, true, rng);
  expect(s.phase).toBe('asking');
  s = play(s, true, rng);
  expect(s.phase).toBe('finished');
  expect(s.items).toHaveLength(3);
});

test('the staircase moves the level within the round', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  for (let i = 0; i < 4; i++) s = play(s, true, rng);
  expect(s.staircase.level).toBe(2);
  s = play(s, false, rng);
  s = play(s, false, rng);
  expect(s.staircase.level).toBe(1);
  expect(s.staircase.maxLevel).toBe(2);
});

test('the staircase steps once per resolved question, including skips and timeouts', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 5, rng, 0);
  s = nextQuestion(dontKnow(s), rng, 1000);
  expect(s.staircase.level).toBe(5);
  s = timeOutQuestion(s);
  expect(s.staircase.level).toBe(4);
});

test('choice options are shuffled and true/false keeps True, False', () => {
  const orders = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const s = createQuizRound(pool, new Map(), 1, createRng(seed), 0);
    expect([...s.current.order].sort()).toEqual([0, 1, 2, 3]);
    orders.add(s.current.order.join(','));
  }
  expect(orders.size).toBeGreaterThan(1);

  const tf = createQuizRound(trueFalsePool, new Map(), 1, createRng(7), 0);
  expect(tf.current.order).toEqual([0, 1]);
});

test('uses the history to prefer questions never answered', () => {
  const small = makePool('history', { 1: 10, 2: 0, 3: 0 });
  const seen = new Map(small.slice(1).map((q) => [q.id, 1] as const));
  const s = createQuizRound(small, seen, 1, createRng(7), 0);
  expect(s.current.question.id).toBe(small[0].id);
});

test('quizResult reports accuracy, level reached and canonical choices', () => {
  const rng = createRng(7);
  let s = createQuizRound(pool, new Map(), 1, rng, 0);
  for (let i = 0; i < 4; i++) s = play(s, true, rng); // sube a nivel 2
  s = nextQuestion(dontKnow(s), rng, 50_000);
  s = nextQuestion(timeOutQuestion(s), rng, 60_000);
  const wrong = wrongShown(s);
  const wrongCanonical = s.current.order[wrong];
  s = nextQuestion(answerQuestion(s, wrong, s.current.askedAt + 3000), rng, 70_000);
  for (let i = 0; i < 3; i++) s = play(s, true, rng);
  expect(s.phase).toBe('finished');

  const result = quizResult(s, 123_456);
  expect(result.score).toBe(s.score);
  expect(result.accuracy).toBe(0.7);
  expect(result.levelReached).toBe(s.staircase.maxLevel);
  expect(result.levelReached).toBe(2);
  expect(result.durationMs).toBe(123_456);
  expect(result.quiz?.items).toHaveLength(10);
  expect(result.quiz?.items.map((i) => i.outcome)).toEqual([
    'correct',
    'correct',
    'correct',
    'correct',
    'skipped',
    'timeout',
    'wrong',
    'correct',
    'correct',
    'correct',
  ]);
  expect(result.quiz?.items[4].chosen).toBeNull();
  expect(result.quiz?.items[6].chosen).toBe(wrongCanonical);
  expect(result.quiz?.items[0].chosen).toBe(0);
});

test('canonical choices of true/false map through the shown order', () => {
  const rng = createRng(7);
  const s0 = createQuizRound(trueFalsePool, new Map(), 1, rng, 0);
  const wrong = answerQuestion(s0, wrongShown(s0), 2000);
  expect(lastItem(wrong)?.chosen).toBe(correctIndex(s0.current.question) === 0 ? 1 : 0);
  expect(lastItem(wrong)?.outcome).toBe('wrong');
});

test('does not mutate the previous state', () => {
  const rng = createRng(7);
  const s = createQuizRound(pool, new Map(), 1, rng, 0);
  const before = JSON.stringify({ ...s, history: [...s.history] });
  answerQuestion(s, correctShown(s), 2000);
  dontKnow(s);
  timeOutQuestion(s);
  expect(JSON.stringify({ ...s, history: [...s.history] })).toBe(before);
});
