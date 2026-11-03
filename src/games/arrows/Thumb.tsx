import { GameThumb } from '../shared/GameThumb';

/** Five arrows like the game's row, the center one in cyan pointing the other way. Wider canvas so they breathe. */
export function ArrowsThumb() {
  return (
    <GameThumb area="attention">
      <svg viewBox="0 0 32 24" focusable="false" style={{ width: '84%' }}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#eef1ff" strokeWidth="1.7">
            <path d="M4.7 12H.9M2.8 10.1.9 12l1.9 1.9" />
            <path d="M11.3 12H7.5M9.4 10.1 7.5 12l1.9 1.9" />
            <path d="M24.5 12h-3.8M22.6 10.1 20.7 12l1.9 1.9" />
            <path d="M31.1 12h-3.8M29.2 10.1 27.3 12l1.9 1.9" />
          </g>
          <path d="M13.9 12h4.2M16 9.9l2.1 2.1-2.1 2.1" stroke="currentColor" strokeWidth="2.2" />
        </g>
      </svg>
    </GameThumb>
  );
}
