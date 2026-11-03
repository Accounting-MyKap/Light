import { GameThumb } from '../shared/GameThumb';

export function ArrowsThumb() {
  return (
    <GameThumb area="attention">
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M4.6 12H1M2.4 10.6 1 12l1.4 1.4M8.9 12H5.3M6.7 10.6 5.3 12l1.4 1.4M18.6 12H15M16.4 10.6 15 12l1.4 1.4M22.9 12h-3.6M20.7 10.6 19.3 12l1.4 1.4"
            stroke="#eef1ff"
          />
          <path d="M9.9 12h4.2M12.4 10.2 14.2 12l-1.8 1.8" stroke="currentColor" strokeWidth="2" />
        </g>
      </svg>
    </GameThumb>
  );
}
