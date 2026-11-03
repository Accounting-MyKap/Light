import type { GameDefinition } from '../types';
import { SWITCHYARD_MAX_SCORE, SWITCHYARD_REFERENCE_SCORE } from './engine';
import { SwitchyardGame } from './Game';
import { SwitchyardPractice } from './Practice';
import { SwitchyardThumb } from './Thumb';
import { mapFeatures, mapFor, stationCountForLevel } from './maps';

export const switchyardGame: GameDefinition = {
  id: 'switchyard',
  area: 'attention',
  referenceScore: SWITCHYARD_REFERENCE_SCORE,
  maxScore: SWITCHYARD_MAX_SCORE,
  Component: SwitchyardGame,
  Practice: SwitchyardPractice,
  Thumb: SwitchyardThumb,
  describeLevel(level, t) {
    const stations = stationCountForLevel(level);
    const { sideTunnel, middleStation } = mapFeatures(mapFor(stations, false));
    return [
      t('games.switchyard.levelStations', { n: stations }),
      ...(sideTunnel ? [t('games.switchyard.levelSideTunnel')] : []),
      ...(middleStation ? [t('games.switchyard.levelMiddleStation')] : []),
    ].join(' · ');
  },
};
