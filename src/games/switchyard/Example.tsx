import { useTranslation } from 'react-i18next';
import { Board } from './Board';
import type { Train } from './engine';
import { mapFor } from './maps';
import { chimneyOf, trainSprite } from './sprite';
import styles from './switchyard.module.css';

const MAP = mapFor(3, false);
/** The red train, about to reach the first switch, which points the wrong way. */
const TRAIN: Train = { id: 0, station: 0, route: [0], distance: 84, arrived: false };
const SWITCHES: (0 | 1)[] = [1, 0];
/** A still plume of smoke rising from the chimney. */
const CHIMNEY = chimneyOf(trainSprite(MAP, TRAIN));
const PUFFS = [
  { id: 'a', x: CHIMNEY.x - 3, y: CHIMNEY.y - 7, r: 4.5, opacity: 0.45 },
  { id: 'b', x: CHIMNEY.x - 9, y: CHIMNEY.y - 17, r: 6.5, opacity: 0.3 },
  { id: 'c', x: CHIMNEY.x - 16, y: CHIMNEY.y - 28, r: 8.5, opacity: 0.16 },
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
