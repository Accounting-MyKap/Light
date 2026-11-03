import { GameThumb } from '../shared/GameThumb';

export function SequenceLightsThumb() {
  return (
    <GameThumb area="memory">
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="currentColor">
          <rect x="3" y="3" width="5" height="5" rx="1.3" opacity=".25" />
          <rect x="9.5" y="3" width="5" height="5" rx="1.3" />
          <rect x="16" y="3" width="5" height="5" rx="1.3" opacity=".25" />
          <rect x="3" y="9.5" width="5" height="5" rx="1.3" opacity=".25" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1.3" opacity=".25" />
          <rect x="16" y="9.5" width="5" height="5" rx="1.3" />
          <rect x="3" y="16" width="5" height="5" rx="1.3" />
          <rect x="9.5" y="16" width="5" height="5" rx="1.3" opacity=".25" />
          <rect x="16" y="16" width="5" height="5" rx="1.3" opacity=".25" />
        </g>
      </svg>
    </GameThumb>
  );
}
