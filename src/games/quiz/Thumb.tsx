import type { QuizBank } from '../../quiz/types';
import { GameThumb } from '../shared/GameThumb';

/** The thumbnail of a quiz game: a question mark in the colour of its bank. */
export function QuizThumb({ bank }: { bank: QuizBank }) {
  return (
    <GameThumb area={bank}>
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.2v.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="12" cy="18.6" r="1.5" fill="currentColor" />
      </svg>
    </GameThumb>
  );
}
