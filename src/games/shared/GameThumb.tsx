import type { ReactNode } from 'react';
import type { Area } from '../types';
import styles from './GameThumb.module.css';

/** Decorative night-scene tile in the color of the game's area. Same in light and dark mode. */
export function GameThumb({ area, children }: { area: Area; children: ReactNode }) {
  return (
    <span className={styles.thumb} data-area={area} aria-hidden="true">
      {children}
    </span>
  );
}
