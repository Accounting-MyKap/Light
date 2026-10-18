import type { GameDefinition } from '../types';
import { QUICK_MATH_MAX_SCORE, QUICK_MATH_REFERENCE_SCORE } from './engine';
import { QuickMathExample } from './Example';
import { QuickMathGame } from './Game';

export const quickMathGame: GameDefinition = {
  id: 'quick-math',
  area: 'math',
  referenceScore: QUICK_MATH_REFERENCE_SCORE,
  maxScore: QUICK_MATH_MAX_SCORE,
  Component: QuickMathGame,
  Example: QuickMathExample,
};
