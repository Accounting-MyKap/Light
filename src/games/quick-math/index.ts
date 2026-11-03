import type { GameDefinition } from '../types';
import { QUICK_MATH_MAX_SCORE, QUICK_MATH_REFERENCE_SCORE } from './engine';
import { QuickMathThumb } from './Thumb';
import { QuickMathGame } from './Game';
import { QuickMathPractice } from './Practice';

export const quickMathGame: GameDefinition = {
  id: 'quick-math',
  area: 'math',
  referenceScore: QUICK_MATH_REFERENCE_SCORE,
  maxScore: QUICK_MATH_MAX_SCORE,
  Component: QuickMathGame,
  Thumb: QuickMathThumb,
  Practice: QuickMathPractice,
};
