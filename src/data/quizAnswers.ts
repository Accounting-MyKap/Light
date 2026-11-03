import type { QuizCategory, QuizRoundDetails } from '../quiz/types';
import { db, type QuizAnswer } from './db';

/** Stores the answers of one saved round. The `[resultId+questionId]` key makes a retry overwrite, not duplicate. */
export async function addQuizAnswers(resultId: string, details: QuizRoundDetails, answeredAt: Date): Promise<void> {
  const when = answeredAt.toISOString();
  const rows: QuizAnswer[] = details.items.map((item) => ({
    resultId,
    questionId: item.question.id,
    category: item.question.category,
    outcome: item.outcome,
    answeredAt: when,
  }));
  await db.quizAnswers.bulkPut(rows);
}

/** Last time (ms since epoch) each question of the given categories was answered. */
export async function answerHistory(categories: readonly QuizCategory[]): Promise<Map<string, number>> {
  const rows = await db.quizAnswers.where('category').anyOf([...categories]).toArray();
  const history = new Map<string, number>();
  for (const row of rows) {
    const at = Date.parse(row.answeredAt);
    const known = history.get(row.questionId);
    if (known === undefined || at > known) history.set(row.questionId, at);
  }
  return history;
}

/** Distinct questions ever answered, per category. */
export async function seenCounts(): Promise<Map<QuizCategory, number>> {
  const seen = new Map<QuizCategory, Set<string>>();
  await db.quizAnswers.each((row) => {
    const ids = seen.get(row.category) ?? new Set<string>();
    ids.add(row.questionId);
    seen.set(row.category, ids);
  });
  return new Map([...seen].map(([category, ids]) => [category, ids.size]));
}

/** Answers given since the date, per category; a skip or a time-out counts as answered, not correct. */
export async function masteryByCategory(
  since: Date,
): Promise<Map<QuizCategory, { answered: number; correct: number }>> {
  const rows = await db.quizAnswers.where('answeredAt').aboveOrEqual(since.toISOString()).toArray();
  const mastery = new Map<QuizCategory, { answered: number; correct: number }>();
  for (const row of rows) {
    const entry = mastery.get(row.category) ?? { answered: 0, correct: 0 };
    entry.answered += 1;
    if (row.outcome === 'correct') entry.correct += 1;
    mastery.set(row.category, entry);
  }
  return mastery;
}
