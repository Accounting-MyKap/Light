import { useId, type ReactNode, type Ref } from 'react';
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
  /** Gets the element the animation loop moves for each star (its rail), and null once the star is gone. */
  registerStar: (id: number, el: HTMLElement | null) => void;
}

/**
 * How far down its rail a star is moved: `height` of the rail, which is as tall as the sky. The star hangs from the
 * rail's top by its bottom edge, so at 1 it touches the horizon.
 */
export const railAt = (height: number) => `translateY(${height * 100}%)`;

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
            <Rail
              key={star.id}
              ref={(el) => registerStar(star.id, el)}
              lane={star.lane}
              height={starHeight(star, now)}
            >
              <div className={styles.star} data-testid="star" data-comet={star.comet} data-lane={star.lane}>
                <StarLook comet={star.comet}>{formatProblem(star.problem)}</StarLook>
              </div>
            </Rail>
          ))}
          {bursts.map((burst) => (
            <Rail key={burst.key} lane={burst.star.lane} height={burst.height}>
              <div
                className={styles.burst}
                data-kind={burst.kind}
                data-comet={burst.star.comet}
                data-lane={burst.star.lane}
              >
                <StarLook comet={burst.star.comet}>{formatProblem(burst.star.problem)}</StarLook>
              </div>
            </Rail>
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

interface RailProps {
  lane: number;
  /** 0 at the top of the sky, 1 on the horizon. */
  height: number;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * What carries a star (or a burst) down its lane: a line as tall as the sky, with no width, at the lane's center.
 * The animation loop moves it with a transform, which needs no layout; what it carries is only the look.
 */
function Rail({ lane, height, ref, children }: RailProps) {
  return (
    <div ref={ref} className={styles.rail} data-rail={lane} style={{ transform: railAt(height) }}>
      {children}
    </div>
  );
}

/** The points of a 5-point star in a 100-unit box: outer radius 50, inner 21, centered a little low (y 52). */
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5;
  const radius = i % 2 === 0 ? 50 : 21;
  return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(52 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(' ');

/**
 * What a star looks like: a 5-point star (a round ball for the comet: the shape, not only the color, tells them
 * apart) with its operation on a label just under it. The shapes are drawn and hold no text, so the star's text is
 * exactly its operation.
 */
function StarLook({ comet, children }: { comet: boolean; children: ReactNode }) {
  return (
    <>
      {comet ? <span className={styles.ball} /> : <StarHead />}
      <span className={styles.label}>{children}</span>
    </>
  );
}

/** The star itself, in the color of the game (CSS), with a soft white shine at the upper left. */
function StarHead() {
  // Each star has its own shine, so no two gradients in the page share an id.
  const shine = useId();
  return (
    <svg className={styles.head} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={shine} cx="40%" cy="35%" r="55%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon className={styles.headBody} points={STAR_POINTS} />
      <polygon points={STAR_POINTS} fill={`url(#${shine})`} />
    </svg>
  );
}
