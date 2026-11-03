import { GameThumb } from '../shared/GameThumb';

/** The rule (a pill) over a circle and a triangle that share the same baseline and height. */
export function RuleSwitchThumb() {
  return (
    <GameThumb area="flexibility">
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="5" y="3.5" width="14" height="4.5" rx="2.25" fill="currentColor" />
        <circle cx="7" cy="16.2" r="3.8" fill="#3d7bff" stroke="#eef1ff" strokeWidth="1" />
        <path d="M17 12.4 21.3 20h-8.6z" fill="#ffa42e" stroke="#eef1ff" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </GameThumb>
  );
}
