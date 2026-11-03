import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createStaircase } from '../../core/difficulty';
import { createRng } from '../../core/rng';
import { VIBRATION } from '../../core/vibrate';
import { useCue } from '../shared/feedback';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import {
  advanceSwitchyard,
  destinationOf,
  spawnIntervalMs,
  type Arrival,
  type SwitchyardState,
  type Train,
} from './engine';
import { mapFor } from './maps';
import { WorldBoard, useSwitchyardWorld } from './useSwitchyardWorld';

/** The map of level 1, unmirrored: switch 1 sends left to red or on to switch 2, which sends to yellow or green. */
const MAP = mapFor(3, false);

/** After a train reaches the wrong station, the round starts over this much later. */
export const RESTART_MS = 1000;

/** The practice clock moves at most this much from one frame to the next. */
export const MAX_STEP_MS = 100;

/**
 * Where the waiting train of round 1 stands: out of the tunnel, with its locomotive just short of the first switch,
 * so the person sees the whole train and the arrow it has to turn. At distance 0 the train would still be inside the
 * tunnel, hidden by the portal.
 */
export const WAIT_DISTANCE = 64;

/** Nothing comes out of the tunnel on its own in the practice, so the engine never draws from this. */
const NO_SPAWN_RNG = createRng(1);

export interface PracticeTrain {
  /** The station it goes to: its color. */
  station: number;
  /** When it comes out of the tunnel, in ms after the round starts. */
  at: number;
}

export interface PracticeRound {
  /** How the switches start: always the wrong way for the first train. */
  switches: (0 | 1)[];
  trains: PracticeTrain[];
  /** The first train waits, out of the tunnel, until the switches lead it home. */
  waits: boolean;
  guide: 'tap' | 'moving' | 'two';
  hint: 'hintEach' | 'hintYellow';
}

export const PRACTICE_ROUNDS: readonly PracticeRound[] = [
  // The red train waits while switch 1 sends it on toward yellow; one tap on switch 1 sends it home.
  { switches: [1, 0], trains: [{ station: 0, at: 0 }], waits: true, guide: 'tap', hint: 'hintEach' },
  // The yellow train sets off at once toward green; switch 2 has to flip before it gets there.
  { switches: [1, 1], trains: [{ station: 1, at: 0 }], waits: false, guide: 'moving', hint: 'hintYellow' },
  // Green sets off toward yellow (switch 2); red comes one interval later and needs switch 1 back to the left.
  {
    switches: [1, 0],
    trains: [
      { station: 2, at: 0 },
      { station: 0, at: spawnIntervalMs(1) },
    ],
    waits: false,
    guide: 'two',
    hint: 'hintEach',
  },
];

/** One try at a round. A wrong arrival ends it; RESTART_MS later another try of the same round begins. */
interface Attempt {
  round: number;
  /** Practice time it began at. */
  startedAt: number;
  /** Id of the round's first train; the others follow. */
  firstId: number;
  /** Trains of the round home so far. */
  home: number;
  /** When a train reached the wrong station. */
  failedAt: number | null;
}

const trainOf = (attempt: Attempt, index: number): Train => {
  const { station } = PRACTICE_ROUNDS[attempt.round].trains[index];
  const waits = index === 0 && PRACTICE_ROUNDS[attempt.round].waits;
  return { id: attempt.firstId + index, station, route: [0], distance: waits ? WAIT_DISTANCE : 0, arrived: false };
};

/** A round as it begins: level 1, its switches, and the trains due at once. Score and staircase are not used. */
function startAttempt(round: number, now: number, firstId: number): { attempt: Attempt; state: SwitchyardState } {
  const setup = PRACTICE_ROUNDS[round];
  const attempt: Attempt = { round, startedAt: now, firstId, home: 0, failedAt: null };
  const state: SwitchyardState = {
    map: MAP,
    switches: [...setup.switches],
    trains: setup.trains.flatMap((train, i) => (train.at === 0 ? [trainOf(attempt, i)] : [])),
    nextTrainId: firstId + setup.trains.length,
    nextSpawnAt: Infinity,
    recentStations: [],
    staircase: createStaircase(1),
    score: 0,
    correct: 0,
    total: 0,
    now,
  };
  return { attempt, state };
}

/** True for the waiting train of round 1 while it has not moved and the switches still lead it elsewhere. */
function isWaiting(attempt: Attempt, state: SwitchyardState, train: Train): boolean {
  return (
    PRACTICE_ROUNDS[attempt.round].waits &&
    train.id === attempt.firstId &&
    train.route.length === 1 &&
    train.distance === WAIT_DISTANCE &&
    destinationOf(state.map, state.switches, train.route[0]) !== train.station
  );
}

/** Moves the yard to `to`, holding the waiting train and bringing in the round's later trains when they are due. */
function advanceRound(game: SwitchyardState, to: number, attempt: Attempt) {
  let state = game;
  const arrivals: Arrival[] = [];
  const moveTo = (until: number) => {
    const held = state.trains.filter((train) => isWaiting(attempt, state, train));
    const moving = { ...state, trains: state.trains.filter((train) => !held.includes(train)) };
    const result = advanceSwitchyard(moving, until, NO_SPAWN_RNG);
    state = { ...result.state, trains: [...held, ...result.state.trains] };
    // No points in the practice: its marks show the check, never a «+10».
    arrivals.push(...result.arrivals.map((arrival) => ({ ...arrival, points: 0 })));
  };
  PRACTICE_ROUNDS[attempt.round].trains.forEach((train, i) => {
    const due = attempt.startedAt + train.at;
    if (train.at === 0 || due <= state.now || due > to) return;
    moveTo(due);
    state = { ...state, trains: [...state.trains, trainOf(attempt, i)] };
  });
  moveTo(to);
  return { state, arrivals };
}

/**
 * The guided practice of Guardagujas: three fixed rounds on the level-1 map, at level-1 speed. The yard is the
 * game's own, moving in real time; a round is right once all its trains are home, and a train at the wrong station
 * starts the round over after the hint.
 */
export function SwitchyardPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(PRACTICE_ROUNDS.length, onComplete);
  const cue = useCue();
  const [first] = useState(() => startAttempt(0, 0, 0));
  const attemptRef = useRef(first.attempt);
  // The practice's own clock: real time from its first frame, in steps of at most MAX_STEP_MS. A hidden page or a
  // long frame then only pauses the practice, instead of moving the trains on while the person is away.
  const clockRef = useRef<{ last: number | null; elapsed: number }>({ last: null, elapsed: 0 });

  const { world, toggle, reducedMotion, lite } = useSwitchyardWorld(() => first.state, {
    active: true,
    now: () => {
      const at = Date.now();
      const clock = clockRef.current;
      if (clock.last !== null) clock.elapsed += Math.min(Math.max(0, at - clock.last), MAX_STEP_MS);
      clock.last = at;
      return clock.elapsed;
    },
    advance: (game, to) => {
      const attempt = attemptRef.current;
      const over = attempt.failedAt !== null && to - attempt.failedAt >= RESTART_MS;
      if (attempt.round !== round || over) {
        const next = startAttempt(round, to, game.nextTrainId);
        attemptRef.current = next.attempt;
        return { state: next.state, arrivals: [] };
      }
      return advanceRound(game, to, attempt);
    },
    onArrival: (arrival) => {
      const attempt = attemptRef.current;
      if (attempt.failedAt !== null) return; // this try is over; the round starts again shortly
      if (!arrival.correct) {
        attemptRef.current = { ...attempt, failedAt: arrival.at };
        answer(false);
        return;
      }
      const home = attempt.home + 1;
      attemptRef.current = { ...attempt, home };
      if (home === PRACTICE_ROUNDS[attempt.round].trains.length) answer(true);
    },
    // The switch sounds like the game's; the trains need no whistle here.
    onFlip: () => cue('clack', VIBRATION.tick),
  });

  // The switches hold still once the try is decided: while «¡Bien!» shows (all its trains are home) and from a miss
  // until the round starts over. The yard keeps running, so the train that arrived rolls on into its station.
  const flip = useCallback(
    (index: number) => {
      const attempt = attemptRef.current;
      const decided = attempt.failedAt !== null || attempt.home === PRACTICE_ROUNDS[attempt.round].trains.length;
      return decided ? false : toggle(index);
    },
    [toggle],
  );

  useGameKeys((key) => (/^[1-9]$/.test(key) ? flip(Number(key) - 1) : false));

  const setup = PRACTICE_ROUNDS[round];
  const message =
    status === 'right'
      ? t('practice.nice')
      : t(`games.switchyard.practice.${status === 'wrong' ? setup.hint : setup.guide}`);

  return (
    <PracticeFrame
      round={round + 1}
      total={PRACTICE_ROUNDS.length}
      message={message}
      title={t('games.switchyard.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
    >
      <WorldBoard world={world} onToggle={flip} reducedMotion={reducedMotion} lite={lite} />
    </PracticeFrame>
  );
}
