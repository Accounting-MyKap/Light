import { arrowsGame } from './arrows';
import { sameDifferentGame } from './same-different';
import { sequenceLightsGame } from './sequence-lights';
import type { GameDefinition } from './types';

export const GAMES: readonly GameDefinition[] = [sequenceLightsGame, arrowsGame, sameDifferentGame];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
