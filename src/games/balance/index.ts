import type { GameDefinition } from '../types';
import { BALANCE_MAX_SCORE, BALANCE_REFERENCE_SCORE } from './engine';
import { BalanceGame } from './Game';
import { challengeKind, figureCountForLevel } from './generator';
import { BalancePractice } from './Practice';
import { BalanceThumb } from './Thumb';

export const balanceGame: GameDefinition = {
  id: 'balance',
  area: 'logic',
  referenceScore: BALANCE_REFERENCE_SCORE,
  maxScore: BALANCE_MAX_SCORE,
  Component: BalanceGame,
  Practice: BalancePractice,
  Thumb: BalanceThumb,
  describeLevel(level, t) {
    const key = challengeKind(level) === 'heaviest' ? 'games.balance.levelHeaviest' : 'games.balance.levelTilt';
    return t(key, { n: figureCountForLevel(level) });
  },
};
