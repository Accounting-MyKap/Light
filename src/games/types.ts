import type { ComponentType } from 'react';
import type { PracticeProps } from './shared/practice/types';

export type Area = 'memory' | 'attention' | 'speed' | 'flexibility' | 'math' | 'logic' | 'language';

export const V1_AREAS: readonly Area[] = ['memory', 'attention', 'speed', 'flexibility', 'math'];

export interface GameResult {
  score: number;
  accuracy: number;
  levelReached: number;
  durationMs: number;
}

export interface GameProps {
  startLevel: number;
  paused: boolean;
  onFinish: (result: GameResult) => void;
}

/**
 * A pluggable game. Texts live in i18n under `games.<id>.title|description|practice.recap`.
 */
export interface GameDefinition {
  id: string;
  area: Area;
  /** Score that maps to 1000 in the area score. */
  referenceScore: number;
  /** Theoretical upper bound; the server rejects anything above it. */
  maxScore: number;
  Component: ComponentType<GameProps>;
  /** Guided practice shown before the first play and from «¿Cómo se juega?». */
  Practice: ComponentType<PracticeProps>;
  /** Decorative square thumbnail (no props) that fills the width of its container; size it with a wrapper. */
  Thumb: ComponentType;
}
