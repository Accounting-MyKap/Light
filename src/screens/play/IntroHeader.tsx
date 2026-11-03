import { useTranslation } from 'react-i18next';
import type { Area } from '../../games/types';
import { AreaLabel } from './AreaLabel';
import styles from './Play.module.css';

/**
 * Top row of a game's intro: a ✕ to leave before playing, and the area label. `exitLabel` names the ✕ when it does
 * not leave the game: on the instructions opened from the pause, it goes back to the sheet.
 */
export function IntroHeader({ area, onExit, exitLabel }: { area: Area; onExit: () => void; exitLabel?: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.introHeader}>
      <button type="button" className={styles.close} aria-label={exitLabel ?? t('play.exit')} onClick={onExit}>
        ✕
      </button>
      <AreaLabel area={area} />
    </div>
  );
}
