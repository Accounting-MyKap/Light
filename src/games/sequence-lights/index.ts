import type { GameDefinition } from '../types';
import { SEQUENCE_MAX_SCORE, SEQUENCE_REFERENCE_SCORE } from './engine';
import { SequenceLightsExample } from './Example';
import { SequenceLightsGame } from './Game';

export const sequenceLightsGame: GameDefinition = {
  id: 'sequence-lights',
  area: 'memory',
  referenceScore: SEQUENCE_REFERENCE_SCORE,
  maxScore: SEQUENCE_MAX_SCORE,
  Component: SequenceLightsGame,
  Example: SequenceLightsExample,
};
