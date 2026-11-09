import { arrowsGame } from './arrows';
import { balanceGame } from './balance';
import { QUIZ_GAME_LIST } from './quiz';
import { quickMathGame } from './quick-math';
import { ruleSwitchGame } from './rule-switch';
import { sameDifferentGame } from './same-different';
import { sequenceLightsGame } from './sequence-lights';
import { starShowerGame } from './star-shower';
import { switchyardGame } from './switchyard';
import type { GameDefinition } from './types';

const TRAINING_GAME_LIST: readonly GameDefinition[] = [
  sequenceLightsGame,
  arrowsGame,
  sameDifferentGame,
  ruleSwitchGame,
  quickMathGame,
  switchyardGame,
  starShowerGame,
  balanceGame,
];

/** Every game: the 8 training games first, then the 14 quiz games. */
export const GAMES: readonly GameDefinition[] = [...TRAINING_GAME_LIST, ...QUIZ_GAME_LIST];

/** The training games (no `quiz`): what the daily plan, the Games screen and the area scores use. */
export const TRAINING_GAMES: readonly GameDefinition[] = GAMES.filter((g) => g.quiz === undefined);

/** The games of the quiz section (with `quiz`). */
export const QUIZ_GAMES: readonly GameDefinition[] = GAMES.filter((g) => g.quiz !== undefined);

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
