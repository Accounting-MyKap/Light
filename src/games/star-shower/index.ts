import type { GameDefinition } from '../types';
import { STAR_SHOWER_MAX_SCORE, STAR_SHOWER_REFERENCE_SCORE } from './engine';
import { StarShowerThumb } from './Thumb';
import { StarShowerGame } from './Game';
import { StarShowerPractice } from './Practice';

export const starShowerGame: GameDefinition = {
  id: 'star-shower',
  area: 'math',
  referenceScore: STAR_SHOWER_REFERENCE_SCORE,
  maxScore: STAR_SHOWER_MAX_SCORE,
  Component: StarShowerGame,
  Practice: StarShowerPractice,
  Thumb: StarShowerThumb,
};
