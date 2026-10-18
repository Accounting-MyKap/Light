import type { GameDefinition } from '../types';
import { SAME_DIFF_MAX_SCORE, SAME_DIFF_REFERENCE_SCORE } from './engine';
import { SameDifferentExample } from './Example';
import { SameDifferentGame } from './Game';

export const sameDifferentGame: GameDefinition = {
  id: 'same-different',
  area: 'speed',
  referenceScore: SAME_DIFF_REFERENCE_SCORE,
  maxScore: SAME_DIFF_MAX_SCORE,
  Component: SameDifferentGame,
  Example: SameDifferentExample,
};
