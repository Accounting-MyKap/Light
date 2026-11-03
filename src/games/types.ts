import type { TFunction } from 'i18next';
import type { ComponentType } from 'react';
import type { QuizConfig, QuizRoundDetails } from '../quiz/types';

export type Area =
  | 'memory'
  | 'attention'
  | 'speed'
  | 'flexibility'
  | 'math'
  | 'logic'
  | 'language'
  | 'trivia'
  | 'accounting';

export const V1_AREAS: readonly Area[] = ['memory', 'attention', 'speed', 'flexibility', 'math'];
/** The two areas of the quiz section; a quiz game's area is its question bank. */
export const QUIZ_AREAS: readonly Area[] = ['trivia', 'accounting'];

export interface GameResult {
  score: number;
  accuracy: number;
  levelReached: number;
  durationMs: number;
  /** Solo en los juegos de preguntas: lo necesario para el repaso y el historial local. */
  quiz?: QuizRoundDetails;
}

export interface GameProps {
  startLevel: number;
  paused: boolean;
  onFinish: (result: GameResult) => void;
}

/**
 * A pluggable game. Texts live in i18n under `games.<id>.title|description|skill|instructions`;
 * `instructionsKey` points the instructions somewhere else when several games share them.
 */
export interface GameDefinition {
  id: string;
  area: Area;
  /** Score that maps to 1000 in the area score. */
  referenceScore: number;
  /** Theoretical upper bound; the server rejects anything above it. */
  maxScore: number;
  Component: ComponentType<GameProps>;
  /** Static visual example shown with the instructions. */
  Example: ComponentType;
  /** Decorative square thumbnail (no props) that fills the width of its container; size it with a wrapper. */
  Thumb: ComponentType;
  /** Present only on the games of the quiz section. */
  quiz?: QuizConfig;
  /** i18n key of the instructions; defaults to `games.<id>.instructions`. */
  instructionsKey?: string;
  /** Optional block the result view shows below the stats. */
  ResultDetails?: ComponentType<{ result: GameResult }>;
  /** A few words on what a level brings (shown when choosing the level), for games where levels differ visibly. */
  describeLevel?: (level: number, t: TFunction) => string;
}
