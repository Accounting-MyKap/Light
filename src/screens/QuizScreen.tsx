import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { db } from '../data/db';
import { seenCounts } from '../data/quizAnswers';
import { QUIZ_GAMES } from '../games/registry';
import type { GameDefinition } from '../games/types';
import { BANK_SIZES } from '../quiz/banks/manifest';
import { CATEGORIES_BY_BANK, type QuizBank, type QuizCategory, type QuizConfig } from '../quiz/types';
import styles from './Quiz.module.css';

const BANKS: readonly QuizBank[] = ['trivia', 'accounting'];

/**
 * How many distinct questions the player has seen among a game's categories, against the size of
 * those banks. Each category is clamped to its bank size: a question retired from a bank after it
 * was answered must not push «Vistas: N de M» past M.
 */
export function seenFor(
  config: QuizConfig,
  seen: ReadonlyMap<QuizCategory, number>,
): { seen: number; total: number } {
  let seenTotal = 0;
  let total = 0;
  for (const category of config.categories) {
    seenTotal += Math.min(seen.get(category) ?? 0, BANK_SIZES[category]);
    total += BANK_SIZES[category];
  }
  return { seen: seenTotal, total };
}

/** The mix plays every category of its bank. */
const isMix = (game: GameDefinition & { quiz: QuizConfig }) =>
  game.quiz.categories.length === CATEGORIES_BY_BANK[game.quiz.bank].length;

/** A bank's games with the mix first, then the categories in registry order. */
function gamesOf(bank: QuizBank): (GameDefinition & { quiz: QuizConfig })[] {
  const games = QUIZ_GAMES.filter((g): g is GameDefinition & { quiz: QuizConfig } => g.quiz?.bank === bank);
  return [...games.filter(isMix), ...games.filter((g) => !isMix(g))];
}

/** The best score of every game played. */
async function bestScores(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  await db.results.each((r) => map.set(r.gameId, Math.max(map.get(r.gameId) ?? 0, r.score)));
  return map;
}

export function QuizScreen() {
  const { t } = useTranslation();
  // A local read that fails (IndexedDB closed or blocked) only loses the marks: the cards stay playable.
  const best = useLiveQuery(() => bestScores().catch(() => new Map<string, number>()), [], new Map<string, number>());
  const seen = useLiveQuery(
    () => seenCounts().catch(() => new Map<QuizCategory, number>()),
    [],
    new Map<QuizCategory, number>(),
  );

  return (
    <section className={styles.screen}>
      <h1>{t('quiz.title')}</h1>
      <p className={styles.muted}>{t('quiz.intro')}</p>
      {BANKS.map((bank) => (
        <section key={bank} className={styles.section} data-area={bank} aria-labelledby={`quiz-bank-${bank}`}>
          <h2 id={`quiz-bank-${bank}`}>
            <span className={styles.dot} aria-hidden="true" />
            {t(`quiz.banks.${bank}`)}
          </h2>
          <ul className={styles.list}>
            {gamesOf(bank).map((g) => {
              const progress = seenFor(g.quiz, seen);
              const featured = isMix(g);
              return (
                <li key={g.id} className={featured ? styles.featuredItem : undefined}>
                  <Link className={featured ? `${styles.card} ${styles.cardFeatured}` : styles.card} to={`/play/${g.id}`}>
                    {/* Blocks, like the catalog card: a heading may not sit inside a span. */}
                    <div className={styles.thumb}>
                      <g.Thumb />
                    </div>
                    <div className={styles.text}>
                      <h3 className={styles.name}>{t(`games.${g.id}.title`)}</h3>
                      <span className={styles.description}>{t(`games.${g.id}.description`)}</span>
                      <span className={styles.meta}>
                        <span>{t('quiz.best', { score: best.get(g.id) ?? '—' })}</span>
                        <span>{t('quiz.seen', { seen: progress.seen, total: progress.total })}</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
