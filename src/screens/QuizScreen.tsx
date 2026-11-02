import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { db } from '../data/db';
import { seenCounts } from '../data/quizAnswers';
import { QUIZ_GAMES } from '../games/registry';
import type { GameDefinition } from '../games/types';
import { BANK_SIZES } from '../quiz/banks/manifest';
import { CATEGORIES_BY_BANK, type QuizBank, type QuizCategory, type QuizConfig } from '../quiz/types';
import styles from './Screens.module.css';

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

export function QuizScreen() {
  const { t } = useTranslation();
  const best = useLiveQuery(
    async () => {
      const map = new Map<string, number>();
      await db.results.each((r) => map.set(r.gameId, Math.max(map.get(r.gameId) ?? 0, r.score)));
      return map;
    },
    [],
    new Map<string, number>(),
  );
  const seen = useLiveQuery(seenCounts, [], new Map<QuizCategory, number>());

  return (
    <section className={styles.screen}>
      <h1>{t('quiz.title')}</h1>
      <p className={styles.muted}>{t('quiz.intro')}</p>
      {BANKS.map((bank) => (
        <section key={bank} className={styles.section} aria-labelledby={`quiz-bank-${bank}`}>
          <h2 id={`quiz-bank-${bank}`}>{t(`quiz.banks.${bank}`)}</h2>
          <ul className={styles.cards}>
            {gamesOf(bank).map((g) => {
              const progress = seenFor(g.quiz, seen);
              return (
                <li key={g.id}>
                  <Link
                    className={isMix(g) ? `${styles.card} ${styles.cardFeatured}` : styles.card}
                    to={`/play/${g.id}`}
                  >
                    <h3>{t(`games.${g.id}.title`)}</h3>
                    <p className={styles.muted}>{t(`games.${g.id}.description`)}</p>
                    <p>{t('gamesScreen.best', { score: best.get(g.id) ?? '—' })}</p>
                    <p className={styles.muted}>{t('quiz.seen', { seen: progress.seen, total: progress.total })}</p>
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
