import type { TFunction } from 'i18next';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FIGURES, SHAPE_PATHS, type FigureId } from './figures';
import type { Balance, Outcome, Pan } from './solver';
import styles from './balance.module.css';

/** One balance is drawn in a box of this size (SVG units). */
export const BALANCE_BOX = { width: 200, height: 130 };
/** How far a tipped beam turns, and how far each pan rises or falls with it (half beam 68 u × sin 10°). */
export const TILT_DEG = 10;
const PAN_SHIFT = 11.8;
const PIVOT = { x: 100, y: 40 };
const ARM = 68;
/** Top of the hanger and bottom of the pan, under each end of the beam. */
const HANGER_TOP = 46;
const PAN_Y = 86;
const PAN_HALF = 29;
const FIGURE_STEP = 19;
const FIGURE_SCALE = 0.8;

/** «2 cyan squares and 1 amber circle»: the figures of a pan, grouped by kind in the order they first appear. */
export function describePan(pan: readonly FigureId[], t: TFunction): string {
  const counts = new Map<FigureId, number>();
  for (const f of pan) counts.set(f, (counts.get(f) ?? 0) + 1);
  const parts = [...counts].map(([f, count]) => t(`games.balance.count.${FIGURES[f].shape}`, { count }));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')}${t('games.balance.and')}${parts.at(-1)}` : parts[0];
}

/** The name of a balance for screen readers; a new balance not yet revealed ends in «?». */
export function describeBalance(balance: Pick<Balance, 'left' | 'right'>, outcome: Outcome | null, t: TFunction): string {
  return t('games.balance.balance', {
    left: describePan(balance.left, t),
    right: describePan(balance.right, t),
    outcome: t(`games.balance.outcome.${outcome ?? 'unknown'}`),
  });
}

/** The beam angle and the pans' vertical shift for an outcome (0 while a new balance waits for the answer). */
function pose(outcome: Outcome | null): { angle: number; left: number; right: number } {
  if (outcome === 'left') return { angle: -TILT_DEG, left: PAN_SHIFT, right: -PAN_SHIFT };
  if (outcome === 'right') return { angle: TILT_DEG, left: -PAN_SHIFT, right: PAN_SHIFT };
  return { angle: 0, left: 0, right: 0 };
}

/** The figures of one pan, in rows of three from the bottom up, centered on the pan. */
function PanFigures({ pan, x }: { pan: Pan; x: number }) {
  return pan.map((figure, i) => {
    const row = Math.floor(i / 3);
    const inRow = Math.min(3, pan.length - row * 3);
    const cx = x + (i % 3 - (inRow - 1) / 2) * FIGURE_STEP;
    const cy = PAN_Y - 10 - row * FIGURE_STEP;
    const { shape, color } = FIGURES[figure];
    return (
      <path
        key={i}
        className={styles.figure}
        d={SHAPE_PATHS[shape]}
        transform={`translate(${cx} ${cy}) scale(${FIGURE_SCALE})`}
        fill={color}
        style={{ '--figure': color } as CSSProperties}
      />
    );
  });
}

function PanGroup({ pan, side, shift }: { pan: Pan; side: 'left' | 'right'; shift: number }) {
  const x = side === 'left' ? PIVOT.x - ARM : PIVOT.x + ARM;
  return (
    <g className={styles.pan} style={{ '--shift': `${shift}px` } as CSSProperties}>
      <path
        className={styles.hanger}
        d={`M${x} ${PIVOT.y}V${HANGER_TOP}M${x - PAN_HALF} ${PAN_Y}V${HANGER_TOP}H${x + PAN_HALF}V${PAN_Y}`}
      />
      <PanFigures pan={pan} x={x} />
      <path className={styles.plate} d={`M${x - PAN_HALF - 3} ${PAN_Y}h${2 * PAN_HALF + 6}l-6 7h${-2 * PAN_HALF + 6}z`} />
    </g>
  );
}

/**
 * One balance as a nested SVG at (x, y), `scale` times its natural size. A clue shows its outcome; the new balance
 * (`question`) stays level with a «?» until `revealed`, then tips to its outcome.
 */
export function BalanceView({
  balance,
  x,
  y,
  scale = 1,
  question = false,
  revealed = false,
}: {
  balance: Balance;
  x: number;
  y: number;
  scale?: number;
  question?: boolean;
  revealed?: boolean;
}) {
  const { t } = useTranslation();
  const shown = question && !revealed ? null : balance.outcome;
  const { angle, left, right } = pose(shown);
  return (
    <svg
      x={x}
      y={y}
      width={BALANCE_BOX.width * scale}
      height={BALANCE_BOX.height * scale}
      viewBox={`0 0 ${BALANCE_BOX.width} ${BALANCE_BOX.height}`}
      role="img"
      aria-label={describeBalance(balance, shown, t)}
      data-question={question ? 'true' : undefined}
      data-outcome={shown ?? 'unknown'}
      className={styles.balance}
      overflow="visible"
    >
      <path className={styles.stand} d="M76 127h48l-7-8h-34z" />
      <rect className={styles.stand} x="97" y={PIVOT.y} width="6" height="80" rx="3" />
      <g className={styles.beam} style={{ '--angle': `${angle}deg` } as CSSProperties}>
        <rect x={PIVOT.x - ARM - 4} y={PIVOT.y - 3} width={2 * ARM + 8} height="6" rx="3" />
      </g>
      <PanGroup pan={balance.left} side="left" shift={left} />
      <PanGroup pan={balance.right} side="right" shift={right} />
      <circle className={styles.pivot} cx={PIVOT.x} cy={PIVOT.y} r="6" />
      {question && !revealed && (
        <g className={styles.ask}>
          <circle cx={PIVOT.x} cy="78" r="12" />
          <text x={PIVOT.x} y="83.5" textAnchor="middle">
            ?
          </text>
        </g>
      )}
    </svg>
  );
}
