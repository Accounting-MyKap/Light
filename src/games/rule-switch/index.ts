import type { GameDefinition } from '../types';
import { RULE_SWITCH_MAX_SCORE, RULE_SWITCH_REFERENCE_SCORE } from './engine';
import { RuleSwitchExample } from './Example';
import { RuleSwitchGame } from './Game';

export const ruleSwitchGame: GameDefinition = {
  id: 'rule-switch',
  area: 'flexibility',
  referenceScore: RULE_SWITCH_REFERENCE_SCORE,
  maxScore: RULE_SWITCH_MAX_SCORE,
  Component: RuleSwitchGame,
  Example: RuleSwitchExample,
};
