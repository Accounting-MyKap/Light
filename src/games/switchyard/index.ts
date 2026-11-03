import type { GameDefinition } from '../types';
import { SWITCHYARD_MAX_SCORE, SWITCHYARD_REFERENCE_SCORE } from './engine';
import { SwitchyardExample } from './Example';
import { SwitchyardGame } from './Game';

export const switchyardGame: GameDefinition = {
  id: 'switchyard',
  area: 'attention',
  referenceScore: SWITCHYARD_REFERENCE_SCORE,
  maxScore: SWITCHYARD_MAX_SCORE,
  Component: SwitchyardGame,
  Example: SwitchyardExample,
};
