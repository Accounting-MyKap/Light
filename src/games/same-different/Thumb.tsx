import { GameThumb } from '../shared/GameThumb';

export function SameDifferentThumb() {
  return (
    <GameThumb area="speed">
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 3.5l2.3 5.1 5.6.6-4.2 3.8 1.2 5.5L12 15.6l-4.9 2.9 1.2-5.5-4.2-3.8 5.6-.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </GameThumb>
  );
}
