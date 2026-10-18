import type { GameDefinition } from '../types';
import { ARROWS_MAX_SCORE, ARROWS_REFERENCE_SCORE } from './engine';
import { ArrowsExample } from './Example';
import { ArrowsGame } from './Game';

export const arrowsGame: GameDefinition = {
  id: 'arrows',
  area: 'attention',
  referenceScore: ARROWS_REFERENCE_SCORE,
  maxScore: ARROWS_MAX_SCORE,
  Component: ArrowsGame,
  Example: ArrowsExample,
};
