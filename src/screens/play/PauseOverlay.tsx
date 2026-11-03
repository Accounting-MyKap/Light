import { useTranslation } from 'react-i18next';
import type { PlayHud } from '../../games/shared/playChrome';
import styles from './Play.module.css';

/**
 * The pause sheet over the dimmed game: the time that is left (games with a clock) and the points so far.
 * Its exit button is «Salir», not the frame's «Salir del juego»: both are in the document while paused.
 */
export function PauseOverlay({
  onContinue,
  onHowToPlay,
  onExit,
  hud,
}: {
  onContinue: () => void;
  onHowToPlay: () => void;
  onExit: () => void;
  hud: PlayHud;
}) {
  const { t } = useTranslation();
  const secondsLeft = hud.remainingMs === null ? null : Math.ceil(hud.remainingMs / 1000);
  return (
    <div className={styles.overlay}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">{t('play.paused')}</h2>
        <dl className={styles.soFar}>
          {secondsLeft !== null && (
            <div>
              <dt>{t('play.timeLeft')}</dt>
              <dd>{secondsLeft} s</dd>
            </div>
          )}
          <div>
            <dt>{t('play.points')}</dt>
            <dd>{hud.score}</dd>
          </div>
        </dl>
        <div className={styles.sheetActions}>
          <button className={styles.primary} onClick={onContinue} autoFocus>
            {t('common.continue')}
          </button>
          <button className={styles.secondary} onClick={onHowToPlay}>
            {t('common.howToPlay')}
          </button>
          <button className={styles.secondary} onClick={onExit}>
            {t('common.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}
