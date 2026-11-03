import type { GameDefinition } from '../types';
import { STAR_SHOWER_MAX_SCORE, STAR_SHOWER_REFERENCE_SCORE } from './engine';
import { StarShowerExample } from './Example';
import { StarShowerThumb } from './Thumb';
import { StarShowerGame } from './Game';

export const starShowerGame: GameDefinition = {
  id: 'star-shower',
  area: 'math',
  referenceScore: STAR_SHOWER_REFERENCE_SCORE,
  maxScore: STAR_SHOWER_MAX_SCORE,
  Component: StarShowerGame,
  Example: StarShowerExample,
  Thumb: StarShowerThumb,
};
