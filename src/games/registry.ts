import { arrowsGame } from './arrows';
import { sequenceLightsGame } from './sequence-lights';
import type { GameDefinition } from './types';

export const GAMES: readonly GameDefinition[] = [sequenceLightsGame, arrowsGame];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
