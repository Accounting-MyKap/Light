import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { BALANCE_BOX, BalanceView } from './BalanceView';
import type { Challenge } from './generator';
import styles from './balance.module.css';

const GAP = 16;
/** The new balance is drawn this much bigger, under a thin line. */
const QUESTION_SCALE = 1.25;
const QUESTION_GAP = 22;

interface Placed {
  x: number;
  y: number;
}

export interface Layout {
  clues: Placed[];
  question: Placed | null;
  width: number;
  height: number;
}

/**
 * Where each clue and the new balance go, with the clues in one column or two to a row (an odd last one centered),
 * and the new balance below them.
 */
export function layoutChallenge(challenge: Challenge, columns: 1 | 2): Layout {
  const questionWidth = challenge.kind === 'tilt' ? BALANCE_BOX.width * QUESTION_SCALE : 0;
  const cluesWidth = columns * BALANCE_BOX.width + (columns - 1) * GAP;
  const width = Math.max(cluesWidth, questionWidth);
  const n = challenge.clues.length;
  const clues = challenge.clues.map((_, i) => {
    const row = Math.floor(i / columns);
    const alone = columns === 1 || (i === n - 1 && n % 2 === 1);
    const x = alone ? (width - BALANCE_BOX.width) / 2 : (i % 2) * (BALANCE_BOX.width + GAP);
    return { x, y: row * (BALANCE_BOX.height + GAP) };
  });
  const rows = Math.ceil(n / columns);
  const cluesHeight = rows * BALANCE_BOX.height + (rows - 1) * GAP;
  if (challenge.kind !== 'tilt') return { clues, question: null, width, height: cluesHeight };
  const question = { x: (width - questionWidth) / 2, y: cluesHeight + QUESTION_GAP };
  return { clues, question, width, height: question.y + BALANCE_BOX.height * QUESTION_SCALE };
}

/** How big a layout can be drawn in the box: its scale when fitted. */
function fittedScale(layout: Layout, box: { width: number; height: number }): number {
  return Math.min(box.width / layout.width, box.height / layout.height);
}

/** One column or two: whichever draws the balances bigger in the box (two until the box is measured). */
export function chooseColumns(challenge: Challenge, box: { width: number; height: number } | null): 1 | 2 {
  if (challenge.clues.length === 1) return 1;
  if (!box) return 2;
  return fittedScale(layoutChallenge(challenge, 1), box) > fittedScale(layoutChallenge(challenge, 2), box) ? 1 : 2;
}

/** The size of the box, measured; null until measured (or where ResizeObserver does not exist). */
function useBoxSize(box: RefObject<HTMLElement | null>): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return size;
}

/**
 * The clues and, for «which way will it tip?», the new balance, as one picture as large as the game zone allows (the
 * SVG fits its box and keeps its proportions; the measured box only picks one column or two).
 * `revealed` tips the new balance to its outcome. Carries the kind and the answer for the end-to-end tests.
 */
export function ChallengeView({ challenge, revealed }: { challenge: Challenge; revealed: boolean }) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef);
  const layout = layoutChallenge(challenge, chooseColumns(challenge, box));
  const { clues, question, width: sceneWidth, height } = layout;
  const lineY = question ? question.y - QUESTION_GAP / 2 : 0;
  return (
    <div
      ref={boxRef}
      className={styles.box}
      data-testid="balance-challenge"
      data-kind={challenge.kind}
      data-answer={String(challenge.answer)}
    >
      <svg
        className={styles.scene}
        viewBox={`0 0 ${sceneWidth} ${height}`}
        role="group"
        aria-label={t('games.balance.clues')}
        overflow="visible"
      >
        {challenge.clues.map((clue, i) => (
          <BalanceView key={i} balance={clue} x={clues[i].x} y={clues[i].y} />
        ))}
        {challenge.kind === 'tilt' && question && (
          <>
            <path className={styles.divider} d={`M${sceneWidth * 0.2} ${lineY}H${sceneWidth * 0.8}`} />
            <BalanceView
              balance={challenge.question}
              x={question.x}
              y={question.y}
              scale={QUESTION_SCALE}
              question
              revealed={revealed}
            />
          </>
        )}
      </svg>
    </div>
  );
}
