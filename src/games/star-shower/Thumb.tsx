import { useId } from 'react';
import { GameThumb } from '../shared/GameThumb';

/**
 * A lime 5-point star with its trail and, lower and smaller, the round gold comet with its tail: both falling, as
 * in the game. The trails fade upward; the tile is drawn in several places at once, so each has its own gradients.
 */
export function StarShowerThumb() {
  const id = useId();
  const [starTrail, cometTail] = [`${id}-star`, `${id}-comet`];
  return (
    <GameThumb area="math">
      <svg viewBox="0 0 24 24" focusable="false">
        <defs>
          <linearGradient id={starTrail} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity=".7" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={cometTail} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffd34d" stopOpacity=".75" />
            <stop offset="1" stopColor="#ffd34d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M6.8 14 L7.6 2.6 Q9 0.6 10.4 2.6 L11.2 14 Z" fill={`url(#${starTrail})`} />
        <path
          d="M9 8.2 L10.44 12.02 L14.52 12.21 L11.33 14.76 L12.41 18.69 L9 16.45 L5.59 18.69 L6.67 14.76 L3.48 12.21 L7.56 12.02 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth=".8"
          strokeLinejoin="round"
        />
        <path d="M16 19.4 L16.7 7.8 Q18 5.8 19.3 7.8 L20 19.4 Z" fill={`url(#${cometTail})`} />
        <circle cx="18" cy="19.4" r="2.5" fill="#ffd34d" />
      </svg>
    </GameThumb>
  );
}
