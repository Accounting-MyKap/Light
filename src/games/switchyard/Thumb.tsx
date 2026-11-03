import { GameThumb } from '../shared/GameThumb';

/** A little steam locomotive from the side, in cyan, puffing smoke on its track. */
export function SwitchyardThumb() {
  return (
    <GameThumb area="attention">
      <svg viewBox="0 0 32 24" focusable="false" style={{ width: '84%' }}>
        <g fill="#eef1ff" opacity="0.55">
          <circle cx="13.5" cy="4.2" r="1.6" />
          <circle cx="10.6" cy="2.4" r="2.1" />
        </g>
        <path d="M2 20.5h28" stroke="#eef1ff" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <g fill="currentColor">
          <rect x="5" y="8" width="7" height="9" rx="1" />
          <rect x="11" y="11" width="11" height="6" rx="3" />
          <path d="M14.6 11V7.6l-.9-1.6h4.4l-.9 1.6V11z" />
          <path d="M22 16.5h3.2L22 13.6z" />
        </g>
        <rect x="6.4" y="9.6" width="3.6" height="3" rx=".6" fill="#090b19" opacity="0.65" />
        <g fill="#090b19" stroke="currentColor" strokeWidth="1">
          <circle cx="9" cy="18.4" r="2" />
          <circle cx="15.2" cy="18.4" r="2" />
          <circle cx="20.2" cy="18.9" r="1.4" />
        </g>
        <circle cx="22.4" cy="12.6" r="0.9" fill="#fff6c8" />
      </svg>
    </GameThumb>
  );
}
