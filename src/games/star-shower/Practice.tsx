import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng } from '../../core/rng';
import type { Problem } from '../shared/arithmetic';
import { Keypad } from '../shared/Keypad';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import {
  advance,
  createStarShower,
  deleteDigit,
  typeDigit,
  type Star,
  type StarShowerEvent,
  type StarShowerState,
} from './engine';
import { Sky } from './Sky';
import { useStarSky } from './useStarSky';
import styles from './star-shower.module.css';

/** How long a practice star takes to fall: slower than the game, whose stars start at 9 s, because it teaches. */
export const PRACTICE_FALL_MS = 14_000;

/** After a star touches the horizon, the round starts over this much later. */
export const RESTART_MS = 1000;

/** The practice clock moves at most this much from one frame to the next. */
export const MAX_STEP_MS = 100;

/** Where the still star of round 1 floats: its bottom edge a third of the way down the sky. */
const STILL_HEIGHT = 1 / 3;

/** No star is born on its own in the practice, so the engine never draws from this. */
const NO_SPAWN_RNG = createRng(1);

export interface PracticeStar {
  problem: Problem;
  /** 0 left, 1 middle, 2 right. */
  lane: number;
  /** When it appears at the top of the sky, in ms after the round starts. */
  at: number;
  comet?: boolean;
}

export interface PracticeRound {
  /** In the order they appear, every answer different. */
  stars: PracticeStar[];
  /** The stars float still: they neither fall nor reach the horizon. */
  still: boolean;
  guide: 'pop' | 'falling' | 'comet';
  /** The hint for a number that is on no star. */
  wrongHint: 'hintFirst' | 'hintWrong';
}

type Hint = PracticeRound['wrongHint'] | 'hintLost';

const plus = (a: number, b: number): Problem => ({ a, b, op: '+', answer: a + b });
const minus = (a: number, b: number): Problem => ({ a, b, op: '-', answer: a - b });

export const PRACTICE_ROUNDS: readonly PracticeRound[] = [
  // One star floats still in the middle: typing 7 and OK pops it.
  { stars: [{ problem: plus(3, 4), lane: 1, at: 0 }], still: true, guide: 'pop', wrongHint: 'hintFirst' },
  // Two fall slowly, the second two seconds after the first: both have to be popped before the horizon.
  {
    stars: [
      { problem: plus(5, 2), lane: 0, at: 0 },
      { problem: minus(9, 3), lane: 2, at: 2000 },
    ],
    still: false,
    guide: 'falling',
    wrongHint: 'hintWrong',
  },
  // Two more, then the golden comet in the middle: popping it pops them all.
  {
    stars: [
      { problem: minus(8, 5), lane: 0, at: 0 },
      { problem: plus(2, 6), lane: 2, at: 0 },
      { problem: plus(4, 5), lane: 1, at: 1500, comet: true },
    ],
    still: false,
    guide: 'comet',
    wrongHint: 'hintWrong',
  },
];

/** One try at a round. A star on the horizon ends it; RESTART_MS later another try of the same round begins. */
interface Attempt {
  round: number;
  /** Practice time it began at. */
  startedAt: number;
  /** Id of the round's first star; the others follow in order. */
  firstId: number;
  /** Stars of the round popped so far. */
  popped: number;
  /** When a star touched the horizon. */
  failedAt: number | null;
}

const starOf = (attempt: Attempt, index: number): Star => {
  const setup = PRACTICE_ROUNDS[attempt.round];
  const { problem, lane, at, comet = false } = setup.stars[index];
  // A still star is born a third of a fall before the round, which is the time it is always drawn at.
  const bornAt = attempt.startedAt + at - (setup.still ? STILL_HEIGHT * PRACTICE_FALL_MS : 0);
  return { id: attempt.firstId + index, problem, level: 1, lane, bornAt, fallMs: PRACTICE_FALL_MS, comet };
};

/**
 * A round as it begins: the game's starting state at level 1 with the round's first stars, and none born on its own.
 * Its score, lives and breaks are not used.
 */
function startAttempt(round: number, now: number, firstId: number): { attempt: Attempt; state: StarShowerState } {
  const attempt: Attempt = { round, startedAt: now, firstId, popped: 0, failedAt: null };
  const first = PRACTICE_ROUNDS[round].stars.flatMap((star, i) => (star.at === 0 ? [starOf(attempt, i)] : []));
  const state: StarShowerState = {
    ...createStarShower(1, NO_SPAWN_RNG),
    stars: first,
    nextId: firstId + first.length,
    nextSpawnAt: Infinity,
  };
  return { attempt, state };
}

/**
 * Moves the sky to `to`, bringing in the round's later stars when they are due. The engine's `nextId` tells which of
 * them are already in. It stops at a lost star: that try is over.
 */
function advanceRound(game: StarShowerState, to: number, attempt: Attempt) {
  const { stars } = PRACTICE_ROUNDS[attempt.round];
  let state = game;
  const events: StarShowerEvent[] = [];
  const moveTo = (until: number) => {
    const result = advance(state, until, NO_SPAWN_RNG);
    state = result.state;
    events.push(...result.events);
    return events.some((event) => event.kind === 'lost');
  };
  for (let i = state.nextId - attempt.firstId; i < stars.length; i++) {
    const due = attempt.startedAt + stars[i].at;
    if (due > to) break;
    if (moveTo(due)) return { state, events };
    state = { ...state, stars: [...state.stars, starOf(attempt, i)], nextId: attempt.firstId + i + 1 };
  }
  moveTo(to);
  return { state, events };
}

/** The first try of the practice: round 1 at practice time 0. */
const FIRST = startAttempt(0, 0, 1);

/**
 * The guided practice of Lluvia de estrellas: three fixed rounds in the game's own sky. A still star to pop, two that
 * fall slowly, then two and a comet. A wrong number only shows the hint; a star on the horizon shows its hint and
 * starts the round over a second later. No points, no lives.
 */
export function StarShowerPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(PRACTICE_ROUNDS.length, onComplete);
  const [hint, setHint] = useState<Hint>('hintWrong');
  const attemptRef = useRef(FIRST.attempt);
  // The practice's own clock: real time from its first read, in steps of at most MAX_STEP_MS. A hidden page or a long
  // frame then only pauses the practice, instead of letting the stars fall while the person is away. It stands still
  // in a still round.
  const clockRef = useRef<{ last: number | null; elapsed: number }>({ last: null, elapsed: 0 });

  const { current, commit, submit, sky } = useStarSky(() => FIRST.state, {
    active: true,
    now: () => {
      const at = Date.now();
      const clock = clockRef.current;
      const still = PRACTICE_ROUNDS[attemptRef.current.round].still;
      if (clock.last !== null && !still) clock.elapsed += Math.min(Math.max(0, at - clock.last), MAX_STEP_MS);
      clock.last = at;
      return clock.elapsed;
    },
    advance: (game, to) => {
      const attempt = attemptRef.current;
      const over = attempt.failedAt !== null && to - attempt.failedAt >= RESTART_MS;
      if (attempt.round !== round || over) {
        const next = startAttempt(round, to, attempt.firstId + PRACTICE_ROUNDS[attempt.round].stars.length);
        attemptRef.current = next.attempt;
        return { state: next.state, events: [] };
      }
      // A lost star cleared the sky: nothing moves until the round starts over.
      if (attempt.failedAt !== null) return { state: game, events: [] };
      return advanceRound(game, to, attempt);
    },
    onLost: (event) => {
      const attempt = attemptRef.current;
      if (attempt.failedAt !== null) return;
      attemptRef.current = { ...attempt, failedAt: event.star.bornAt + event.star.fallMs };
      setHint('hintLost');
      answer(false);
    },
  });

  // The keys hold still once the try is decided: while «¡Bien!» shows (all its stars are popped) and from a lost star
  // until the round starts over.
  const decided = () => {
    const attempt = attemptRef.current;
    return attempt.failedAt !== null || attempt.popped === PRACTICE_ROUNDS[attempt.round].stars.length;
  };

  // Each action returns whether it was used, so unused keys keep their browser behavior.
  const actions = {
    digit: (d: number) => {
      if (decided()) return false;
      commit(typeDigit(current(), d));
      return true;
    },
    remove: () => {
      if (decided()) return false;
      commit(deleteDigit(current()));
      return true;
    },
    submit: () => {
      if (decided()) return false;
      const outcome = submit();
      if (outcome === null) return false;
      const attempt = attemptRef.current;
      if (outcome.kind === 'wrong') {
        setHint(PRACTICE_ROUNDS[attempt.round].wrongHint);
        answer(false);
        return true;
      }
      // One reaction per round, once all its stars are popped: a comet pops every star still in the sky.
      const popped = attempt.popped + outcome.popped.length;
      attemptRef.current = { ...attempt, popped };
      if (popped === PRACTICE_ROUNDS[attempt.round].stars.length) answer(true);
      return true;
    },
  };

  useGameKeys((key) => {
    if (/^[0-9]$/.test(key)) return actions.digit(Number(key));
    if (key === 'Backspace') return actions.remove();
    if (key === 'Enter') return actions.submit();
    return false;
  });

  const setup = PRACTICE_ROUNDS[round];
  const message =
    status === 'right'
      ? t('practice.nice')
      : t(`games.star-shower.practice.${status === 'wrong' ? hint : setup.guide}`);

  return (
    <PracticeFrame
      round={round + 1}
      total={PRACTICE_ROUNDS.length}
      message={message}
      title={t('games.star-shower.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={
        // The game's wrapper, so the keys come down to 44 px on short screens as they do there.
        <div className={styles.keys}>
          <Keypad onDigit={actions.digit} onDelete={actions.remove} onSubmit={actions.submit} />
        </div>
      }
    >
      <Sky {...sky} />
    </PracticeFrame>
  );
}
