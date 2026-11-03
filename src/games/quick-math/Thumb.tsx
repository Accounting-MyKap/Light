import { GameThumb } from '../shared/GameThumb';

export function QuickMathThumb() {
  return (
    <GameThumb area="math">
      <svg viewBox="0 0 24 24" focusable="false">
        <text
          x="12"
          y="14.5"
          textAnchor="middle"
          fontFamily="'Sora Variable', system-ui, sans-serif"
          fontSize="8.5"
          fontWeight="800"
          fill="currentColor"
        >
          7×3
        </text>
        <rect x="7" y="17.2" width="10" height="1.3" rx=".65" fill="currentColor" />
      </svg>
    </GameThumb>
  );
}
