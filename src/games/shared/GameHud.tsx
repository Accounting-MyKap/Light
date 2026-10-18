import { useTranslation } from 'react-i18next';
import styles from './GameHud.module.css';

export function GameHud({ remainingMs, score, level }: { remainingMs?: number; score: number; level: number }) {
  const { t } = useTranslation();
  return (
    <dl className={styles.hud}>
      {remainingMs !== undefined && (
        <div className={styles.item}>
          <dt>{t('game.hud.time')}</dt>
          <dd>{Math.ceil(remainingMs / 1000)}</dd>
        </div>
      )}
      <div className={styles.item}>
        <dt>{t('game.hud.score')}</dt>
        <dd>{score}</dd>
      </div>
      <div className={styles.item}>
        <dt>{t('game.hud.level')}</dt>
        <dd>{level}</dd>
      </div>
    </dl>
  );
}
