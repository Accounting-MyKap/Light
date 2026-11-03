import { createElement } from 'react';
import { CATEGORIES_BY_BANK, type QuizBank, type QuizCategory } from '../../quiz/types';
import type { GameDefinition, GameProps } from '../types';
import { QUIZ_MAX_SCORE, QUIZ_REFERENCE_SCORE } from './engine';
import { QuizExample } from './Example';
import { QuizGame } from './Game';
import { QuizReview } from './QuizReview';
import { QuizThumb, type QuizMotif } from './Thumb';

/**
 * Builds one quiz game. The component and the thumbnail are created here, once per game, and close over its
 * config, so the registry hands React the same component type on every render instead of remounting the round.
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
  // The mix plays every category of its bank and shows the mix motif; a category game shows its own.
  const motif: QuizMotif = categories.length === CATEGORIES_BY_BANK[bank].length ? 'mix' : categories[0];
  function Thumb() {
    return createElement(QuizThumb, { bank, motif });
  }
  Thumb.displayName = `QuizThumb(${id})`;

  return {
    id,
    area: bank,
    referenceScore: QUIZ_REFERENCE_SCORE,
    maxScore: QUIZ_MAX_SCORE,
    instructionsKey: 'quiz.instructions',
    quiz: { bank, categories },
    Component,
    Example: QuizExample,
    Thumb,
    ResultDetails: QuizReview,
  };
}
