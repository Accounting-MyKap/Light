import type { TFunction } from 'i18next';
import type { ComponentType } from 'react';
import type { QuizConfig, QuizRoundDetails } from '../quiz/types';
import type { PracticeProps } from './shared/practice/types';

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

/** How the trains of a Guardagujas game did, for its result screen. */
export interface SwitchyardRoundDetails {
  /** Trains that reached their own station. */
  home: number;
  /** Trains that reached a station, theirs or another. */
  arrived: number;
  /** The longest run of trains in a row sent home. */
  bestStreak: number;
  /**
   * Trains that reached another station, counted by the station they should have reached and named by its look
   * (index in STATION_STYLES), so it reads without the map. Most missed first; stations never missed are left out.
   */
  missed: { style: number; count: number }[];
}

export interface GameResult {
  score: number;
  accuracy: number;
  levelReached: number;
  durationMs: number;
  /** Solo en los juegos de preguntas: lo necesario para el repaso y el historial local. */
  quiz?: QuizRoundDetails;
  /** Only in Guardagujas: the summary of its trains, below the stats of the result. */
  switchyard?: SwitchyardRoundDetails;
}

export interface GameProps {
  startLevel: number;
  paused: boolean;
  onFinish: (result: GameResult) => void;
}

/**
 * A pluggable game. Texts live in i18n under `games.<id>.title|description|skill`, plus either
 * `games.<id>.practice.*` (with `practice.recap`) for a game with a `Practice`, or the instructions
 * (`games.<id>.instructions`, or `instructionsKey` when several games share them) for a game with an `Example`.
 * Every game has a `Practice` or an `Example`.
 */
export interface GameDefinition {
  id: string;
  area: Area;
  /** Score that maps to 1000 in the area score. */
  referenceScore: number;
  /** Theoretical upper bound; the server rejects anything above it. */
  maxScore: number;
  Component: ComponentType<GameProps>;
  /** Guided practice shown before the first play, from «¿Cómo se juega?» and from the pause. */
  Practice?: ComponentType<PracticeProps>;
  /** Static visual example shown with the instructions, for games without a `Practice`. */
  Example?: ComponentType;
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
