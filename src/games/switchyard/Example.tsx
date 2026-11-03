import { useTranslation } from 'react-i18next';
import { Board } from './Board';
import type { Train } from './engine';
import { mapFor } from './maps';
import styles from './switchyard.module.css';

const MAP = mapFor(3, false);
/** The red train, about to reach the first switch, which points the wrong way. */
const TRAIN: Train = { id: 0, station: 0, route: [0], distance: 64, arrived: false };
const SWITCHES: (0 | 1)[] = [1, 0];
/** A still trail of smoke behind the chimney. */
const PUFFS = [
  { id: 'a', x: 181, y: 86, r: 3.5, opacity: 0.45 },
  { id: 'b', x: 178, y: 74, r: 6, opacity: 0.3 },
  { id: 'c', x: 182, y: 60, r: 8.5, opacity: 0.16 },
];

export function SwitchyardExample() {
  const { t } = useTranslation();
  return (
    <>
      <Board map={MAP} switches={SWITCHES} trains={[TRAIN]} puffs={PUFFS} className={styles.demo} />
      <p>{t('games.switchyard.exampleAnswer')}</p>
    </>
  );
}
