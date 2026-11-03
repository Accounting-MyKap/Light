import { useEffect, useRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { asOfLabel } from '../../quiz/asOf';
import { correctIndex, optionTexts, type AnswerOutcome, type Question } from '../../quiz/types';
import styles from './quiz.module.css';

/** Pointer clicks on game controls should not move keyboard focus onto them (the window keys keep working). */
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

export interface QuestionViewProps {
  question: Question;
  /** Canonical option indices in the order they are shown on screen. */
  order: readonly number[];
  lang: 'es' | 'en';
  phase: 'asking' | 'feedback';
  outcome?: AnswerOutcome;
  /** Canonical index the player picked, or null if they did not answer. */
  chosen: number | null;
  onChoose?: (shownIndex: number) => void;
  onDontKnow?: () => void;
  onNext?: () => void;
  isLast?: boolean;
  /** The prompt heading, so the game can move the focus to each new question. */
  promptRef?: Ref<HTMLHeadingElement>;
}

export function QuestionView({
  question,
  order,
  lang,
  phase,
  outcome,
  chosen,
  onChoose,
  onDontKnow,
  onNext,
  isLast = false,
  promptRef,
}: QuestionViewProps) {
  const { t } = useTranslation();
  const nextRef = useRef<HTMLButtonElement>(null);
  const texts = optionTexts(question, lang, { true: t('quiz.true'), false: t('quiz.false') });
  const right = correctIndex(question);
  const answered = phase === 'feedback';
  const date = question.asOf ? asOfLabel(question.asOf, lang) : null;

  // After an answer the keyboard goes to «Siguiente», so Enter continues whether or not the window key listener ran.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  return (
    <div className={styles.question}>
      <div className={styles.card}>
        <p className={styles.category}>{t(`quiz.categories.${question.category}`)}</p>
        <h2 ref={promptRef} className={styles.prompt} tabIndex={-1}>
          {question[lang].question}
        </h2>
      </div>

      <div className={styles.options}>
        {order.map((canonical, shown) => {
          const isRight = answered && canonical === right;
          const isWrongPick = answered && canonical === chosen && canonical !== right;
          const mark = isRight ? `✓ ${t('quiz.correct')}` : isWrongPick ? `✗ ${t('quiz.yourAnswer')}` : null;
          return (
            <button
              key={canonical}
              type="button"
              className={styles.option}
              data-state={isRight ? 'correct' : isWrongPick ? 'wrong' : undefined}
              disabled={answered}
              onMouseDown={keepFocus}
              onClick={() => onChoose?.(shown)}
            >
              <span className={styles.number}>{shown + 1}</span>{' '}
              <span className={styles.optionBody}>
                <span>{texts[canonical]}</span>
                {mark && (
                  <>
                    {' '}
                    <span className={styles.mark}>{mark}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {!answered && (
        <button type="button" className={styles.dontKnow} onMouseDown={keepFocus} onClick={() => onDontKnow?.()}>
          {t('quiz.dontKnow')}
        </button>
      )}

      {answered && (
        <div className={styles.feedback}>
          {outcome === 'timeout' && <p className={styles.timeUp}>{t('quiz.timeUp')}</p>}
          <p className={styles.explanation}>{question[lang].explanation}</p>
          {date && <p className={styles.asOf}>{t('quiz.asOf', { date })}</p>}
          {onNext && (
            <button ref={nextRef} type="button" className={styles.next} onMouseDown={keepFocus} onClick={onNext}>
              {t(isLast ? 'quiz.finish' : 'quiz.next')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
