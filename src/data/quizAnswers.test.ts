import { makeChoice } from '../test/quizFixtures';
import type { AnswerOutcome, QuizCategory, QuizRoundDetails } from '../quiz/types';
import { clearAllData, db } from './db';
import { addQuizAnswers, answerHistory, masteryByCategory, seenCounts } from './quizAnswers';

beforeEach(clearAllData);

function round(
  category: QuizCategory,
  outcomes: AnswerOutcome[],
  firstId = 1,
): QuizRoundDetails {
  return {
    items: outcomes.map((outcome, i) => ({
      question: makeChoice(`${category}-${String(firstId + i).padStart(4, '0')}`, category, 1),
      outcome,
      chosen: outcome === 'correct' ? 0 : outcome === 'wrong' ? 1 : null,
    })),
  };
}

const TEN: AnswerOutcome[] = Array.from({ length: 10 }, () => 'correct');

test('saving the same result twice does not duplicate answers', async () => {
  const details = round('history', TEN);
  const at = new Date('2026-11-02T10:00:00.000Z');
  await addQuizAnswers('r1', details, at);
  await addQuizAnswers('r1', details, at);
  expect(await db.quizAnswers.count()).toBe(10);
  expect(await db.quizAnswers.get(['r1', 'history-0001'])).toEqual({
    resultId: 'r1',
    questionId: 'history-0001',
    category: 'history',
    outcome: 'correct',
    answeredAt: at.toISOString(),
  });
});

test('history keeps the latest time per question', async () => {
  const older = new Date('2026-10-01T09:00:00.000Z');
  const newer = new Date('2026-10-20T09:00:00.000Z');
  await addQuizAnswers('r-new', round('history', ['correct', 'wrong']), newer);
  await addQuizAnswers('r-old', round('history', ['wrong', 'correct', 'correct']), older);
  const history = await answerHistory(['history']);
  expect(history.size).toBe(3);
  expect(history.get('history-0001')).toBe(newer.getTime());
  expect(history.get('history-0002')).toBe(newer.getTime());
  expect(history.get('history-0003')).toBe(older.getTime());
});

test('history only covers the requested categories', async () => {
  const at = new Date('2026-11-02T10:00:00.000Z');
  await addQuizAnswers('r1', round('history', ['correct', 'wrong']), at);
  await addQuizAnswers('r2', round('science', ['correct']), at);
  await addQuizAnswers('r3', round('lending', ['correct']), at);
  const history = await answerHistory(['history', 'lending']);
  expect([...history.keys()].sort()).toEqual(['history-0001', 'history-0002', 'lending-0001']);
  expect((await answerHistory([])).size).toBe(0);
});

test('seen counts distinct questions per category', async () => {
  await addQuizAnswers('r1', round('history', ['correct', 'wrong', 'skipped']), new Date('2026-10-01T09:00:00.000Z'));
  await addQuizAnswers('r2', round('history', ['correct', 'timeout'], 2), new Date('2026-10-02T09:00:00.000Z'));
  await addQuizAnswers('r3', round('math', ['correct']), new Date('2026-10-03T09:00:00.000Z'));
  const counts = await seenCounts();
  expect(counts.get('history')).toBe(3);
  expect(counts.get('math')).toBe(1);
  expect(counts.has('science')).toBe(false);
});

test('mastery counts the window only, and skips and time-outs as not correct', async () => {
  const now = new Date('2026-11-02T12:00:00.000Z');
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  await addQuizAnswers('r1', round('history', ['correct', 'skipped', 'timeout']), now);
  await addQuizAnswers('r0', round('history', ['correct'], 10), old);
  await addQuizAnswers('r2', round('math', ['wrong']), now);
  const mastery = await masteryByCategory(since);
  expect(mastery.get('history')).toEqual({ answered: 3, correct: 1 });
  expect(mastery.get('math')).toEqual({ answered: 1, correct: 0 });
  expect(mastery.has('science')).toBe(false);
});

test('clearAllData removes the answers', async () => {
  await addQuizAnswers('r1', round('history', TEN), new Date('2026-11-02T10:00:00.000Z'));
  expect(await db.quizAnswers.count()).toBe(10);
  await clearAllData();
  expect(await db.quizAnswers.count()).toBe(0);
});
