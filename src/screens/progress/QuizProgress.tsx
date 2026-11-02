import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import type { StoredResult } from '../../data/db';
import { masteryByCategory, seenCounts } from '../../data/quizAnswers';
import { QUIZ_GAMES } from '../../games/registry';
import { CATEGORIES_BY_BANK, type QuizBank, type QuizCategory } from '../../quiz/types';
import { seenFor } from '../QuizScreen';
import styles from '../Screens.module.css';

const BANKS: readonly QuizBank[] = ['trivia', 'accounting'];
const WINDOW_MS = 30 * 86_400_000;

/** The best score of the single-category game for each category, over all the results. */
function bestByCategory(results: readonly StoredResult[]): Map<QuizCategory, number> {
  const best = new Map<QuizCategory, number>();
  for (const game of QUIZ_GAMES) {
    if (game.quiz?.categories.length !== 1) continue;
    const scores = results.filter((r) => r.gameId === game.id).map((r) => r.score);
    if (scores.length > 0) best.set(game.quiz.categories[0], Math.max(...scores));
  }
  return best;
}

/**
 * The «Preguntas» block of Progress: per category with answers in the last 30 days, the mastery
 * (share of correct answers, mix rounds included), the questions seen and the best mark.
 * Shown only when the player has saved at least one quiz game.
 */
export function QuizProgress({ results, now }: { results: StoredResult[]; now: Date }) {
  const { t } = useTranslation();
  const time = now.getTime();
  const data = useLiveQuery(
    async () => ({
      mastery: await masteryByCategory(new Date(time - WINDOW_MS)),
      seen: await seenCounts(),
    }),
    [time],
  );

  const quizIds = new Set(QUIZ_GAMES.map((g) => g.id));
  if (!results.some((r) => quizIds.has(r.gameId))) return null;

  const best = bestByCategory(results);
  const banks = BANKS.map((bank) => ({
    bank,
    categories: CATEGORIES_BY_BANK[bank].filter((c) => (data?.mastery.get(c)?.answered ?? 0) > 0),
  })).filter(({ categories }) => categories.length > 0);

  return (
    <section className={styles.section}>
      <h2>{t('progress.quizTitle')}</h2>
      {data && banks.length > 0 && <p className={styles.muted}>{t('progress.mastery')}</p>}
      {data &&
        banks.map(({ bank, categories }) => (
          <section key={bank} className={styles.section} aria-labelledby={`progress-bank-${bank}`}>
            <h3 id={`progress-bank-${bank}`}>{t(`quiz.banks.${bank}`)}</h3>
            {categories.map((category) => {
              const { answered, correct } = data.mastery.get(category)!;
              const percent = Math.round((100 * correct) / answered);
              const progress = seenFor({ bank, categories: [category] }, data.seen);
              const id = `quiz-meter-${category}`;
              return (
                <div key={category} className={styles.quizCategory}>
                  <div className={styles.meterRow}>
                    <span id={id}>{t(`quiz.categories.${category}`)}</span>
                    <meter aria-labelledby={id} min={0} max={100} value={percent} />
                    <span className={styles.value}>{percent} %</span>
                  </div>
                  <p className={styles.muted}>
                    {t('progress.quizLine', {
                      seen: progress.seen,
                      total: progress.total,
                      best: best.get(category) ?? '—',
                    })}
                  </p>
                </div>
              );
            })}
          </section>
        ))}
    </section>
  );
}
