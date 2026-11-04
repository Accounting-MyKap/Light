import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { BALANCE_BOX, BalanceView } from './BalanceView';
import type { Challenge } from './generator';
import styles from './balance.module.css';

const GAP = 16;
/** The scene is two balances wide; the new balance is drawn this much bigger, under a thin line. */
const SCENE_WIDTH = 2 * BALANCE_BOX.width + GAP;
const QUESTION_SCALE = 1.25;
const QUESTION_GAP = 22;

interface Placed {
  x: number;
  y: number;
}

/** Where each clue and the new balance go: clues two to a row (an odd last one centered), the new one below. */
export function layoutChallenge(challenge: Challenge): { clues: Placed[]; question: Placed | null; height: number } {
  const n = challenge.clues.length;
  const clues = challenge.clues.map((_, i) => {
    const row = Math.floor(i / 2);
    const alone = i === n - 1 && n % 2 === 1;
    const x = alone ? (SCENE_WIDTH - BALANCE_BOX.width) / 2 : (i % 2) * (BALANCE_BOX.width + GAP);
    return { x, y: row * (BALANCE_BOX.height + GAP) };
  });
  const rows = Math.ceil(n / 2);
  const cluesHeight = rows * BALANCE_BOX.height + (rows - 1) * GAP;
  if (challenge.kind !== 'tilt') return { clues, question: null, height: cluesHeight };
  const question = {
    x: (SCENE_WIDTH - BALANCE_BOX.width * QUESTION_SCALE) / 2,
    y: cluesHeight + QUESTION_GAP,
  };
  return { clues, question, height: question.y + BALANCE_BOX.height * QUESTION_SCALE };
}

/**
 * The width that lets the whole scene fit in the measured box, keeping its proportions. Undefined until measured (or
 * where ResizeObserver does not exist), and the scene then takes the width of its box.
 */
function useFittedWidth(box: RefObject<HTMLElement | null>, aspect: number): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) setWidth(Math.floor(Math.min(w, h * aspect)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box, aspect]);
  return width;
}

/**
 * The clues and, for «which way will it tip?», the new balance, as one picture as large as the game zone allows.
 * `revealed` tips the new balance to its outcome. Carries the kind and the answer for the end-to-end tests.
 */
export function ChallengeView({ challenge, revealed }: { challenge: Challenge; revealed: boolean }) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const { clues, question, height } = layoutChallenge(challenge);
  const width = useFittedWidth(boxRef, SCENE_WIDTH / height);
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
        viewBox={`0 0 ${SCENE_WIDTH} ${height}`}
        style={width ? { width } : undefined}
        role="group"
        aria-label={t('games.balance.clues')}
        overflow="visible"
      >
        {challenge.clues.map((clue, i) => (
          <BalanceView key={i} balance={clue} x={clues[i].x} y={clues[i].y} />
        ))}
        {challenge.kind === 'tilt' && question && (
          <>
            <path className={styles.divider} d={`M${SCENE_WIDTH * 0.2} ${lineY}H${SCENE_WIDTH * 0.8}`} />
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
