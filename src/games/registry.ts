import { sequenceLightsGame } from './sequence-lights';
import type { GameDefinition } from './types';

export const GAMES: readonly GameDefinition[] = [sequenceLightsGame];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
