import { useTranslation } from 'react-i18next';
import { Board } from './Board';
import type { Train } from './engine';
import { mapFor } from './maps';
import styles from './switchyard.module.css';

const MAP = mapFor(3, false);
/** The red train, about to reach the first switch, which points the wrong way. */
const TRAIN: Train = { id: 0, station: 0, route: [0], distance: 84, arrived: false };
const SWITCHES: (0 | 1)[] = [1, 0];
/** A still trail of smoke behind the chimney. */
const PUFFS = [
  { id: 'a', x: 194, y: 98, r: 4.5, opacity: 0.42 },
  { id: 'b', x: 167, y: 82, r: 6.5, opacity: 0.28 },
  { id: 'c', x: 196, y: 64, r: 8.5, opacity: 0.16 },
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
