import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed, type Rng } from '../../core/rng';
import { answerHistory } from '../../data/quizAnswers';
import { loadQuestions } from '../../quiz/banks/load';
import { correctIndex, optionTexts, type QuizCategory } from '../../quiz/types';
import { useGameClock, useTrialTimeout, type GameClock } from '../shared/clock';
import { MIN_RT_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps, GameResult } from '../types';
import {
  QUIZ_QUESTION_MS,
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
import { QuestionView } from './QuestionView';
import { useQuestionTimer } from './useQuestionTimer';
import styles from './quiz.module.css';

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; round: QuizRoundState };

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
        if (alive) setLoad({ kind: 'error' });
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

  if (load.kind === 'error') {
    return (
      <div className={styles.status}>
        <p role="alert">{t('quiz.loadError')}</p>
        <button type="button" className={styles.retry} onClick={retry}>
          {t('play.retry')}
        </button>
      </div>
    );
  }
  if (load.kind === 'loading') {
    return (
      <p className={styles.status} role="status">
        {t('quiz.loading')}
      </p>
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

  const asking = round.phase === 'asking';
  const active = !paused && round.phase !== 'finished';
  const { question, order, askedAt } = round.current;
  const resolved = asking ? undefined : lastItem(round);

  const timerWindow = asking ? QUIZ_QUESTION_MS : null;
  const timerLeft = useQuestionTimer(clock, askedAt, timerWindow, paused);
  // The time-out and the last 100 ms tick can land in the same instant, so a time-out always reads 0.
  const remaining = resolved?.outcome === 'timeout' ? 0 : timerLeft;

  useTrialTimeout(clock, askedAt, timerWindow, paused, () => {
    const next = timeOutQuestion(round);
    if (next === round) return;
    feedback('wrong');
    setRound(next);
  });

  // The engine returns the same state when it ignores an action (wrong phase, or a tap before MIN_RT_MS).
  const resolveWith = (next: QuizRoundState): boolean => {
    if (next === round) return false;
    feedback(lastItem(next)?.outcome === 'correct' ? 'correct' : 'wrong');
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

  return (
    <div className={styles.game}>
      <GameHud remainingMs={remaining} score={round.score} level={round.staircase.level} />
      <p className={styles.counter}>{t('quiz.questionOf', { n: number, total: QUIZ_ROUND_LENGTH })}</p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label={t('game.hud.time')}
        aria-valuemin={0}
        aria-valuemax={QUIZ_QUESTION_MS / 1000}
        aria-valuenow={Math.ceil(remaining / 1000)}
      >
        <div className={styles.barFill} style={{ width: `${(remaining / QUIZ_QUESTION_MS) * 100}%` }} />
      </div>
      <div key={question.id} className="appear">
        <QuestionView
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
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
