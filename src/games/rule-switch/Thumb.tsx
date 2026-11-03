import { GameThumb } from '../shared/GameThumb';

export function RuleSwitchThumb() {
  return (
    <GameThumb area="flexibility">
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="5" y="2.5" width="14" height="4.5" rx="2.25" fill="currentColor" />
        <circle cx="7.5" cy="15" r="4" fill="#3d7bff" stroke="#eef1ff" strokeWidth="1" />
        <path d="M16.5 10.5l4 7.5h-8z" fill="#ffa42e" stroke="#eef1ff" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </GameThumb>
  );
}
