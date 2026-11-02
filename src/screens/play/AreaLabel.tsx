import { useTranslation } from 'react-i18next';
import type { Area } from '../../games/types';
import styles from './Play.module.css';

/** The area of a game as a label outlined in the game color, with a dot. */
export function AreaLabel({ area }: { area: Area }) {
  const { t } = useTranslation();
  return <span className={styles.areaLabel}>{t(`areas.${area}`)}</span>;
}
