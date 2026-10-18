import type { GameDefinition } from './types';

export const GAMES: readonly GameDefinition[] = [];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
