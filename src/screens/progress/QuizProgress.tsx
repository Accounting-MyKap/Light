import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import type { StoredResult } from '../../data/db';
import { masteryByCategory, seenCounts } from '../../data/quizAnswers';
import { QUIZ_GAMES } from '../../games/registry';
import { CATEGORIES_BY_BANK, type QuizBank, type QuizCategory } from '../../quiz/types';
import { seenFor } from '../QuizScreen';
import styles from '../Progress.module.css';

const BANKS: readonly QuizBank[] = ['trivia', 'accounting'];
const WINDOW_MS = 30 * 86_400_000;

type Mastery = { answered: number; correct: number };
type ReadAnswers = { mastery: ReadonlyMap<QuizCategory, Mastery>; seen: ReadonlyMap<QuizCategory, number> };
/** What the block shows: the answers read from this device, or that they could not be read. */
type Answers = ReadAnswers | 'unreadable';
const NO_ANSWERS: ReadAnswers = { mastery: new Map(), seen: new Map() };

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
  // A local read that fails (IndexedDB closed or blocked) says so in the block rather than breaking the screen, and
  // never passes for «no answers».
  const data = useLiveQuery(async (): Promise<Answers> => {
    try {
      return { mastery: await masteryByCategory(new Date(time - WINDOW_MS)), seen: await seenCounts() };
    } catch {
      return 'unreadable';
    }
  }, [time]);

  const quizIds = new Set(QUIZ_GAMES.map((g) => g.id));
  // Nothing until the answers are read, so the heading never shows on its own.
  if (!data || !results.some((r) => quizIds.has(r.gameId))) return null;

  const best = bestByCategory(results);
  // Unreadable answers draw no bars.
  const { mastery, seen } = data === 'unreadable' ? NO_ANSWERS : data;
  const banks = BANKS.map((bank) => ({
    bank,
    categories: CATEGORIES_BY_BANK[bank].filter((c) => (mastery.get(c)?.answered ?? 0) > 0),
  })).filter(({ categories }) => categories.length > 0);
  const line =
    data === 'unreadable' ? 'progress.quizUnreadable' : banks.length > 0 ? 'progress.mastery' : 'progress.quizNone';

  return (
    <section className={styles.block} aria-labelledby="progress-quiz">
      <h2 id="progress-quiz">{t('progress.quizTitle')}</h2>
      <p className={styles.muted}>{t(line)}</p>
      {banks.map(({ bank, categories }) => (
        <section
          key={bank}
          className={`${styles.card} ${styles.quizBank}`}
          data-area={bank}
          aria-labelledby={`progress-bank-${bank}`}
        >
          <h3 id={`progress-bank-${bank}`}>
            <span className={styles.dot} aria-hidden="true" />
            {t(`quiz.banks.${bank}`)}
          </h3>
          {categories.map((category) => {
            const { answered, correct } = mastery.get(category)!;
            const percent = Math.round((100 * correct) / answered);
            const progress = seenFor({ bank, categories: [category] }, seen);
            const id = `quiz-meter-${category}`;
            return (
              <div key={category} className={styles.quizCategory}>
                <div className={styles.bar} data-area={bank}>
                  <span id={id}>{t(`quiz.categories.${category}`)}</span>
                  <div
                    role="meter"
                    aria-labelledby={id}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-valuetext={`${percent} %`}
                    className={styles.track}
                  >
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <span className={styles.value} aria-hidden="true">
                    {percent} %
                  </span>
                </div>
                <p className={styles.quizLine}>
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
