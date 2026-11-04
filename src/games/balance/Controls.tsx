import { useTranslation } from 'react-i18next';
import { choicesOf, type Choice } from './engine';
import { FIGURES, SHAPE_PATHS, type FigureId } from './figures';
import type { Challenge } from './generator';
import type { Outcome } from './solver';
import styles from './balance.module.css';

/** The answer just given, to mark the buttons during the pause after it. */
export interface Marked {
  choice: Choice;
  correct: boolean;
}

/**
 * The state a button shows: the chosen one is `right` or `wrong`; after a miss, the right one is `answer`.
 */
function stateOf(choice: Choice, challenge: Challenge, marked: Marked | null): string | undefined {
  if (!marked) return undefined;
  if (marked.choice === choice) return marked.correct ? 'right' : 'wrong';
  if (!marked.correct && challenge.answer === choice) return 'answer';
  return undefined;
}

export function FigureIcon({ figure }: { figure: FigureId }) {
  const { shape, color } = FIGURES[figure];
  return (
    <svg className={styles.icon} viewBox="-13 -13 26 26" aria-hidden="true" focusable="false">
      <path d={SHAPE_PATHS[shape]} fill={color} />
    </svg>
  );
}

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  const d = {
    left: 'M15 6 9 12l6 6M9 12h11',
    right: 'M9 6l6 6-6 6M15 12H4',
    level: 'M5 9h14M5 15h14',
  }[outcome];
  return (
    <svg className={styles.outcomeIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  left: 'games.balance.left',
  level: 'games.balance.equal',
  right: 'games.balance.right',
};

/** The question and its answer buttons: one per figure, or left / equal / right. */
export function Controls({
  challenge,
  marked,
  onChoose,
}: {
  challenge: Challenge;
  marked: Marked | null;
  onChoose: (choice: Choice) => void;
}) {
  const { t } = useTranslation();
  const choices = choicesOf(challenge);
  return (
    <div className={styles.controls}>
      <p className={styles.prompt}>{t(challenge.kind === 'heaviest' ? 'games.balance.heaviest' : 'games.balance.tilt')}</p>
      {challenge.kind === 'heaviest' ? (
        <div className={styles.figures} style={{ ['--count' as string]: choices.length }}>
          {challenge.figures.map((figure) => (
            <button
              key={figure}
              type="button"
              className={styles.figureButton}
              aria-label={t(`games.balance.names.${FIGURES[figure].shape}`)}
              data-choice={figure}
              data-state={stateOf(figure, challenge, marked)}
              onClick={() => onChoose(figure)}
            >
              <FigureIcon figure={figure} />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.outcomes}>
          {(choices as Outcome[]).map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={styles.outcomeButton}
              data-choice={outcome}
              data-state={stateOf(outcome, challenge, marked)}
              onClick={() => onChoose(outcome)}
            >
              <OutcomeIcon outcome={outcome} />
              {t(OUTCOME_LABEL[outcome])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
