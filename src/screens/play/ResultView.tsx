import { useTranslation } from 'react-i18next';
import type { GameDefinition, GameResult } from '../../games/types';
import styles from './Play.module.css';

export interface ResultViewProps {
  game: GameDefinition;
  result: GameResult;
  previousBest: number | null;
  onPlayAgain: () => void;
  onBack: () => void;
}

export function ResultView({ game, result, previousBest, onPlayAgain, onBack }: ResultViewProps) {
  const { t } = useTranslation();
  const isNewBest = previousBest === null || result.score > previousBest;
  return (
    <section className={`${styles.screen} ${styles.center}`}>
      <h1>{t(`games.${game.id}.title`)}</h1>
      <p className="visually-hidden">{t('play.score')}</p>
      <p className={styles.score}>{result.score}</p>
      {isNewBest && <p className={styles.newBest}>{t('play.newBest')}</p>}
      <dl className={styles.stats}>
        {!isNewBest && (
          <div>
            <dt>{t('play.best')}</dt>
            <dd>{previousBest}</dd>
          </div>
        )}
        <div>
          <dt>{t('play.accuracy')}</dt>
          <dd>{Math.round(result.accuracy * 100)} %</dd>
        </div>
        <div>
          <dt>{t('play.levelReached')}</dt>
          <dd>{result.levelReached}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={onPlayAgain}>
          {t('common.playAgain')}
        </button>
        <button className={styles.secondary} onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    </section>
  );
}
