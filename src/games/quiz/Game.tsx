import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../../core/motion';
import { createRng, randomSeed, type Rng } from '../../core/rng';
import { answerHistory } from '../../data/quizAnswers';
import { loadQuestions } from '../../quiz/banks/load';
import { correctIndex, optionTexts, type AnswerOutcome, type QuizCategory } from '../../quiz/types';
import { useGameClock, useTrialTimeout, type GameClock } from '../shared/clock';
import { MIN_RT_MS } from '../shared/constants';
import { useFeedback, type FeedbackKind } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps, GameResult } from '../types';
import {
  QUIZ_QUESTION_MS,
  QUIZ_URGENT_MS,
  QUIZ_ROUND_LENGTH,
  answerQuestion,
  createQuizRound,
  dontKnow,
  lastItem,
  nextQuestion,
  quizResult,
  timeOutQuestion,
  type QuizRoundState,
} from './engine';
import { QuestionAnswers, QuestionCard } from './QuestionView';
import { useQuestionTimer } from './useQuestionTimer';
import styles from './quiz.module.css';

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; round: QuizRoundState };

/** The reaction to each outcome. A time-out and «No sé» cost nothing, so, like Quick Math's skip, they are no mistake. */
const FEEDBACK: Record<AnswerOutcome, FeedbackKind> = {
  correct: 'correct',
  wrong: 'wrong',
  timeout: 'timeout',
  skipped: 'timeout',
};

/** A history that cannot be read must never block the game: the round just starts with no memory. */
async function readHistory(categories: readonly QuizCategory[]): Promise<ReadonlyMap<string, number>> {
  try {
    return await answerHistory(categories);
  } catch {
    return new Map<string, number>();
  }
}

export function QuizGame({ startLevel, paused, onFinish, categories }: GameProps & { categories: readonly QuizCategory[] }) {
  const { t } = useTranslation();
  const clock = useGameClock(paused);
  // What the round starts from is fixed when the component mounts, like the other games do with their level.
  const [rng] = useState(() => createRng(randomSeed()));
  const [firstLevel] = useState(startLevel);
  const [wanted] = useState(() => [...categories]);
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [pool, history] = await Promise.all([loadQuestions(wanted), readHistory(wanted)]);
        if (!alive) return;
        // The question clock starts now, when the first question is about to appear, not when the screen mounted.
        setLoad({ kind: 'ready', round: createQuizRound(pool, history, firstLevel, rng, clock.now()) });
      } catch {
        if (!alive) return;
        setFailures((n) => n + 1);
        setLoad({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [wanted, firstLevel, rng, clock, attempt]);

  const retry = () => {
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  // Loading and a failed load are drawn in the frame too: its ✕ is the way out of the game screen.
  if (load.kind === 'error') {
    return (
      <div className={styles.game}>
        <GameFrame score={0} level={firstLevel}>
          <div className={styles.status}>
            <p role="alert">{t('quiz.loadError')}</p>
            <button type="button" className={styles.retry} onClick={retry}>
              {t('play.retry')}
            </button>
            {/* Retrying cannot help when the app itself is stale (a bank chunk of an older version is gone). */}
            {failures >= 2 && (
              <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
                {t('quiz.reload')}
              </button>
            )}
          </div>
        </GameFrame>
      </div>
    );
  }
  if (load.kind === 'loading') {
    return (
      <div className={styles.game}>
        <GameFrame score={0} level={firstLevel}>
          <p className={styles.status} role="status">
            {t('quiz.loading')}
          </p>
        </GameFrame>
      </div>
    );
  }
  return <QuizRound initial={load.round} clock={clock} rng={rng} paused={paused} onFinish={onFinish} />;
}

interface QuizRoundProps {
  initial: QuizRoundState;
  clock: GameClock;
  rng: Rng;
  paused: boolean;
  onFinish: (result: GameResult) => void;
}

function QuizRound({ initial, clock, rng, paused, onFinish }: QuizRoundProps) {
  const { t, i18n } = useTranslation();
  const feedback = useFeedback();
  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const [round, setRound] = useState(initial);
  const finishedRef = useRef(false);
  const gameRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);

  const asking = round.phase === 'asking';
  const active = !paused && round.phase !== 'finished';
  const { question, order, askedAt } = round.current;
  const resolved = asking ? undefined : lastItem(round);

  // The frame fills the screen, but a long question with its explanation can still be taller than a small phone, so
  // the page is scrolled down when «Siguiente» is pressed. Each new question starts like the first: the play screen at
  // the top, with the frame's top bar and time bar in view, and the keyboard and screen readers on the new prompt.
  useEffect(() => {
    if (!asking) return;
    promptRef.current?.focus({ preventScroll: true });
    const screen = gameRef.current?.closest('[data-game]') ?? gameRef.current;
    screen?.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [asking, question.id]);

  const timerWindow = asking ? QUIZ_QUESTION_MS : null;
  const timerLeft = useQuestionTimer(clock, askedAt, timerWindow, paused);
  // The time-out and the last 100 ms tick can land in the same instant, so a time-out always reads 0.
  const remaining = resolved?.outcome === 'timeout' ? 0 : timerLeft;

  useTrialTimeout(clock, askedAt, timerWindow, paused, () => {
    const next = timeOutQuestion(round);
    if (next === round) return;
    feedback(FEEDBACK.timeout);
    setRound(next);
  });

  // The engine returns the same state when it ignores an action (wrong phase, or a tap before MIN_RT_MS).
  const resolveWith = (next: QuizRoundState): boolean => {
    const outcome = lastItem(next)?.outcome;
    if (next === round || !outcome) return false;
    feedback(FEEDBACK[outcome]);
    setRound(next);
    return true;
  };
  const choose = (shownIndex: number) => active && resolveWith(answerQuestion(round, shownIndex, clock.now()));
  // The engine's own MIN_RT_MS check covers the options; «No sé» takes no time there, so the same guard is applied here:
  // a second tap on «Siguiente» must not land on the new question's «No sé» and record a skip.
  const skip = () => active && clock.now() - askedAt >= MIN_RT_MS && resolveWith(dontKnow(round));
  const goNext = () => {
    if (!active || round.phase !== 'feedback') return false;
    const next = nextQuestion(round, rng, clock.now());
    setRound(next);
    if (next.phase === 'finished' && !finishedRef.current) {
      finishedRef.current = true;
      onFinish(quizResult(next, clock.now()));
    }
    return true;
  };

  useGameKeys((key) => {
    if (/^[1-9]$/.test(key)) return choose(Number(key) - 1);
    if (key === '0') return skip();
    if (key === 'Enter') return goNext();
    return false;
  });

  const number = asking ? round.items.length + 1 : round.items.length;
  const announcement = resolved
    ? t(`quiz.announce.${resolved.outcome}`, {
        answer: optionTexts(question, lang, { true: t('quiz.true'), false: t('quiz.false') })[correctIndex(question)],
      })
    : '';

  // Hidden, not removed, while paused: the clock is stopped, so neither the question nor its options may stay readable.
  // Both parts are keyed by the question, so each new one appears afresh.
  const hidden = paused ? ({ visibility: 'hidden' } as const) : undefined;
  const answers = (
    <div key={question.id} className={`${styles.zone} appear`} style={hidden}>
      <QuestionAnswers
        question={question}
        order={order}
        lang={lang}
        phase={asking ? 'asking' : 'feedback'}
        outcome={resolved?.outcome}
        chosen={resolved?.chosen ?? null}
        onChoose={choose}
        onDontKnow={skip}
        onNext={goNext}
        isLast={round.items.length >= QUIZ_ROUND_LENGTH}
      />
    </div>
  );

  return (
    <div ref={gameRef} className={styles.game}>
      <GameFrame
        score={round.score}
        level={round.staircase.level}
        time={{ remainingMs: remaining, totalMs: QUIZ_QUESTION_MS, stopped: !asking, urgentMs: QUIZ_URGENT_MS }}
        controls={answers}
      >
        <div className={styles.zone}>
          <p className={styles.counter}>{t('quiz.questionOf', { n: number, total: QUIZ_ROUND_LENGTH })}</p>
          <div key={question.id} className="appear" style={hidden}>
            <QuestionCard question={question} lang={lang} promptRef={promptRef} />
          </div>
          <div className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
        </div>
      </GameFrame>
    </div>
  );
}
