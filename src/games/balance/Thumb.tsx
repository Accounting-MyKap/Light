import { GameThumb } from '../shared/GameThumb';

/** A balance tipped to the left: a heavy circle down, a light square up, in teal on the night. */
export function BalanceThumb() {
  return (
    <GameThumb area="logic">
      <svg viewBox="0 0 32 26" focusable="false" style={{ width: '84%' }}>
        <path d="M12 24.5h8l-1.4-1.8h-5.2z" fill="#eef1ff" opacity="0.5" />
        <rect x="15.2" y="7" width="1.6" height="16" rx="0.8" fill="#eef1ff" opacity="0.5" />
        <g transform="rotate(-12 16 7)" fill="currentColor">
          <rect x="3.5" y="6.1" width="25" height="1.8" rx="0.9" />
        </g>
        <g fill="none" stroke="#eef1ff" strokeWidth="0.6" opacity="0.7">
          <path d="M4 9.6v2.2M0.8 18.6v-6.8h6.4v6.8" />
          <path d="M28 4.4v2.2M24.8 13.4v-6.8h6.4v6.8" />
        </g>
        <path d="M0.2 18.6h7.6l-1 1.4H1.2z" fill="currentColor" />
        <path d="M24.2 13.4h7.6l-1 1.4h-5.6z" fill="currentColor" />
        <circle cx="4" cy="16.3" r="2.3" fill="#ffb52e" />
        <rect x="26.4" y="9.8" width="3.2" height="3.2" fill="#3fd4ff" />
        <circle cx="16" cy="7" r="1.5" fill="#090b19" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </GameThumb>
  );
}
