import { GameThumb } from '../shared/GameThumb';

export function StarShowerThumb() {
  return (
    <GameThumb area="math">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M8 2 L8 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".35" />
        <circle cx="8" cy="13" r="4.2" fill="currentColor" />
        <path d="M18 9 L16 15" stroke="#ffd34d" strokeWidth="1.6" strokeLinecap="round" opacity=".45" />
        <circle cx="15.6" cy="17.5" r="2.4" fill="#ffd34d" />
      </svg>
    </GameThumb>
  );
}
