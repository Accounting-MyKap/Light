import type { GameDefinition } from '../types';
import { ARROWS_MAX_SCORE, ARROWS_REFERENCE_SCORE } from './engine';
import { ArrowsThumb } from './Thumb';
import { ArrowsGame } from './Game';
import { ArrowsPractice } from './Practice';

export const arrowsGame: GameDefinition = {
  id: 'arrows',
  area: 'attention',
  referenceScore: ARROWS_REFERENCE_SCORE,
  maxScore: ARROWS_MAX_SCORE,
  Component: ArrowsGame,
  Thumb: ArrowsThumb,
  Practice: ArrowsPractice,
};
