import { createContext } from 'react';

/** What the game screen needs to know about a running game, to show it while the game is paused. */
export interface PlayHud {
  score: number;
  /** Null for a game without a clock. */
  remainingMs: number | null;
}

/**
 * What the game screen offers a running game: its title and pause button live in the frame, and the frame
 * reports the score and time back, so the pause overlay can show them. Without a provider (the games'
 * own tests) the frame draws no title and no pause button.
 */
export interface PlayChrome {
  title: string;
  onPause: () => void;
  reportHud: (hud: PlayHud) => void;
}

export const PlayChromeContext = createContext<PlayChrome | null>(null);
