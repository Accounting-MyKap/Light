import { formatProblem } from '../shared/arithmetic';
import { starHeight, type Star } from './engine';
import styles from './star-shower.module.css';

/** A star that just left the sky: popped by an answer, or cleared when another one reached the horizon. */
export interface Burst {
  key: number;
  star: Star;
  /** Its height when it left (0 at the top, 1 on the horizon). */
  height: number;
  kind: 'pop' | 'clear';
}

/** A short light over the sky: gold for a solved comet, red on the horizon where a star was lost. */
export interface SkyFlash {
  key: number;
  kind: 'comet' | 'loss';
  lane?: number;
}

export interface SkyProps {
  stars: readonly Star[];
  /** Game time the stars are drawn at when they render; the animation loop moves them from there. */
  now: number;
  bursts: readonly Burst[];
  flash: SkyFlash | null;
  input: string;
  /** Changes with every wrong number (restarts the shake). */
  wrongKey: number;
  registerStar: (id: number, el: HTMLElement | null) => void;
}

/** Where a star hangs: its bottom edge at `height` of the sky, so at 1 it touches the horizon. */
export const topOf = (height: number) => `${height * 100}%`;

/**
 * The night sky with its stars and horizon, and the answer slot over the horizon. The sky is not announced to
 * screen readers (spec §4.3); the slot is outside the hidden part, so what is typed can still be read.
 */
export function Sky({ stars, now, bursts, flash, input, wrongKey, registerStar }: SkyProps) {
  return (
    <div className={styles.sky}>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.field}>
          <div className={styles.dots} />
          {flash?.kind === 'comet' && <div key={flash.key} className={styles.cometFlash} data-sky-flash="comet" />}
          {stars.map((star) => (
            <div
              key={star.id}
              ref={(el) => registerStar(star.id, el)}
              className={styles.star}
              data-testid="star"
              data-comet={star.comet}
              data-lane={star.lane}
              style={{ top: topOf(starHeight(star, now)) }}
            >
              {star.comet && <Sparkle />}
              {formatProblem(star.problem)}
            </div>
          ))}
          {bursts.map((burst) => (
            <div
              key={burst.key}
              className={styles.burst}
              data-kind={burst.kind}
              data-comet={burst.star.comet}
              data-lane={burst.star.lane}
              style={{ top: topOf(burst.height) }}
            >
              {formatProblem(burst.star.problem)}
            </div>
          ))}
        </div>
        <div className={styles.horizon} data-testid="horizon">
          {flash?.kind === 'loss' && (
            <span key={flash.key} className={styles.lossFlash} data-sky-flash="loss" data-lane={flash.lane} />
          )}
        </div>
      </div>
      <div className={styles.slot}>
        {/* Keyed by the wrong count, so every wrong number starts the shake over. */}
        <span
          key={wrongKey}
          className={styles.answer}
          data-testid="answer"
          data-empty={input === ''}
          data-wrong={wrongKey}
        >
          {input || '?'}
        </span>
      </div>
    </div>
  );
}

/** The comet's ✦, drawn rather than typed, so the star's text stays exactly its operation. Also in the example. */
export function Sparkle() {
  return (
    <svg className={styles.sparkle} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" />
    </svg>
  );
}
