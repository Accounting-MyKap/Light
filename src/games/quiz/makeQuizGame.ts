import { createElement } from 'react';
import type { QuizBank, QuizCategory } from '../../quiz/types';
import type { GameDefinition, GameProps } from '../types';
import { QUIZ_MAX_SCORE, QUIZ_REFERENCE_SCORE } from './engine';
import { QuizExample } from './Example';
import { QuizGame } from './Game';

/**
 * Builds one quiz game. The component is created here, once per game, and closes over `categories`, so the
 * registry hands React the same component type on every render instead of remounting the round.
 */
export function makeQuizGame({
  id,
  bank,
  categories,
}: {
  id: string;
  bank: QuizBank;
  categories: readonly QuizCategory[];
}): GameDefinition {
  function Component(props: GameProps) {
    return createElement(QuizGame, { ...props, categories });
  }
  Component.displayName = `QuizGame(${id})`;

  return {
    id,
    area: bank,
    referenceScore: QUIZ_REFERENCE_SCORE,
    maxScore: QUIZ_MAX_SCORE,
    instructionsKey: 'quiz.instructions',
    quiz: { bank, categories },
    Component,
    Example: QuizExample,
  };
}
