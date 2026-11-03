import type { ArrowTrial, Direction } from './engine';
import styles from './arrows.module.css';

export function ArrowIcon({
  direction,
  className,
  target = false,
}: {
  direction: Direction;
  className?: string;
  /** The arrow the person answers about: the center one of the row. */
  target?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} data-target={target ? 'true' : undefined} aria-hidden="true">
      <path
        d="M4 12h15M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={direction === 'left' ? 'rotate(180 12 12)' : undefined}
      />
    </svg>
  );
}

export function ArrowRow({ trial, className = '' }: { trial: ArrowTrial; className?: string }) {
  const flank: Direction = trial.congruent ? trial.direction : trial.direction === 'left' ? 'right' : 'left';
  const directions = [flank, flank, trial.direction, flank, flank];
  return (
    <div className={`${styles.row} ${className}`} data-testid="arrows-row" data-direction={trial.direction} aria-hidden="true">
      {directions.map((d, i) => (
        <ArrowIcon key={i} direction={d} className={styles.arrow} target={i === 2} />
      ))}
    </div>
  );
}
