import { useTranslation } from 'react-i18next';
import type { Area } from '../../games/types';
import { AreaLabel } from './AreaLabel';
import styles from './Play.module.css';

/** Top row of a game's intro: a ✕ to leave before playing, and the area label. */
export function IntroHeader({ area, onExit }: { area: Area; onExit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.introHeader}>
      <button type="button" className={styles.close} aria-label={t('play.exit')} onClick={onExit}>
        ✕
      </button>
      <AreaLabel area={area} />
    </div>
  );
}
