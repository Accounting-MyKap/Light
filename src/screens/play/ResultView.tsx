import { useTranslation } from 'react-i18next';
import type { GameDefinition, GameResult } from '../../games/types';
import { PercentileLine } from './PercentileLine';
import { useCountUp } from './useCountUp';
import styles from './Play.module.css';

export interface ResultViewProps {
  game: GameDefinition;
  result: GameResult;
  previousBest: number | null;
  onPlayAgain: () => void;
  onBack: () => void;
  /**
   * Daily mode: the next unfinished game of the plan (null when the plan is done) and how many of the plan's
   * games are done, this one included.
   */
  daily?: {
    nextGameId: string | null;
    progress: { done: number; total: number };
    onNext: () => void;
    onSummary: () => void;
  };
}

/** The sparks that fly out of a new best; where each one goes is set in the CSS. */
const SPARKS = 6;

export function ResultView({ game, result, previousBest, onPlayAgain, onBack, daily }: ResultViewProps) {
  const { t } = useTranslation();
  const isNewBest = previousBest === null || result.score > previousBest;
  const shownScore = useCountUp(result.score);
  const progress = daily?.progress;
  return (
    <section className={`${styles.screen} ${styles.result}`}>
      <h1 className={styles.resultTitle}>{t(`games.${game.id}.title`)}</h1>
      <div className={styles.hero}>
        {/* Rays and sparks behind the score: decoration that the CSS drops when the person asked for less motion. */}
        {isNewBest && (
          <div className={styles.celebration} data-celebrate="true" aria-hidden="true">
            <span className={styles.rays} />
            {Array.from({ length: SPARKS }, (_, i) => (
              <span key={i} className={styles.spark} />
            ))}
          </div>
        )}
        {/* Screen readers get the final score at once; the counting number is only for the eyes. */}
        <p className="visually-hidden">{t('play.scoreValue', { score: result.score })}</p>
        <p className={styles.heroScore} aria-hidden="true">
          {shownScore}
        </p>
      </div>
      {isNewBest && <p className={styles.newBest}>{t('play.newBest')}</p>}
      <PercentileLine gameId={game.id} />
      <dl className={styles.statCards}>
        <div>
          <dt>{t('play.accuracy')}</dt>
          <dd>{Math.round(result.accuracy * 100)} %</dd>
        </div>
        <div>
          <dt>{t('play.levelReached')}</dt>
          <dd>{result.levelReached}</dd>
        </div>
        {!isNewBest && (
          <div>
            <dt>{t('play.best')}</dt>
            <dd>{previousBest}</dd>
          </div>
        )}
      </dl>
      {progress && progress.total > 0 && (
        <p className={styles.dailyProgress}>
          <span className={styles.progressBars} aria-hidden="true">
            {Array.from({ length: progress.total }, (_, i) => (
              <span key={i} data-done={i < progress.done} />
            ))}
          </span>
          {t('play.dailyProgress', { done: progress.done, total: progress.total })}
        </p>
      )}
      {daily ? (
        <div className={styles.resultActions}>
          {daily.nextGameId ? (
            <button className={styles.primary} onClick={daily.onNext}>
              {t('play.nextGame')}
            </button>
          ) : (
            <button className={styles.primary} onClick={daily.onSummary}>
              {t('play.seeSummary')}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.resultActions}>
          <button className={styles.primary} onClick={onPlayAgain}>
            {t('common.playAgain')}
          </button>
          <button className={styles.secondary} onClick={onBack}>
            {t('common.back')}
          </button>
        </div>
      )}
    </section>
  );
}
