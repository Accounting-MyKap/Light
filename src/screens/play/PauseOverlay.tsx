import { useTranslation } from 'react-i18next';
import styles from './Play.module.css';

export function PauseOverlay({ onContinue, onExit }: { onContinue: () => void; onExit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">{t('play.paused')}</h2>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={onContinue} autoFocus>
            {t('common.continue')}
          </button>
          <button className={styles.secondary} onClick={onExit}>
            {t('common.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}
