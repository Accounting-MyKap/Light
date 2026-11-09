import { useState } from 'react';
import { playTone } from '../../core/sound';
import { createRng, randomSeed } from '../../core/rng';
import { useSettings } from '../../data/settings';
import { useCountdown, useGameClock, useTrialTimeout } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { ChallengeView } from './ChallengeView';
import { Controls } from './Controls';
import {
  BALANCE_DURATION_MS,
  answerBalance,
  balanceResult,
  choicesOf,
  createBalanceGame,
  type Choice,
} from './engine';
import type { Outcome } from './solver';

/** Keys of «which way will it tip?». */
const OUTCOME_KEYS: Record<string, Outcome> = { ArrowLeft: 'left', ArrowRight: 'right', '=': 'level', ArrowDown: 'level' };

export function BalanceGame({ startLevel, paused, onFinish }: GameProps) {
  const feedback = useFeedback();
  const { sound } = useSettings();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createBalanceGame(startLevel, rng, 0));
  // True while the answered challenge stays on screen with its answer; the next one shows after.
  const [revealing, setRevealing] = useState(false);
  const [finished, setFinished] = useState(false);

  const remaining = useCountdown(clock, BALANCE_DURATION_MS, paused, () => {
    setFinished(true);
    onFinish(balanceResult(game, BALANCE_DURATION_MS));
  });

  // The pause after an answer runs on the game clock, so it freezes while the game is paused.
  useTrialTimeout(clock, game.last?.until ?? 0, revealing ? 0 : null, paused, () => setRevealing(false));

  const active = !paused && !finished;

  const choose = (choice: Choice) => {
    if (!active || revealing) return false;
    const res = answerBalance(game, choice, clock.now(), rng);
    if (res.correct === null) return false;
    feedback(res.correct ? 'correct' : 'wrong');
    if (game.challenge.kind === 'tilt' && sound) playTone('tilt');
    setGame(res.state);
    setRevealing(true);
    return true;
  };

  const shown = revealing && game.last ? game.last.challenge : game.challenge;

  useGameKeys((key) => {
    if (shown.kind === 'tilt') return key in OUTCOME_KEYS ? choose(OUTCOME_KEYS[key]) : false;
    const index = Number(key) - 1;
    const choices = choicesOf(shown);
    return Number.isInteger(index) && index >= 0 && index < choices.length ? choose(choices[index]) : false;
  });

  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: BALANCE_DURATION_MS }}
      controls={
        <Controls
          challenge={shown}
          marked={revealing && game.last ? game.last : null}
          onChoose={(choice) => choose(choice)}
        />
      }
    >
      {/* Keyed by the challenge's number: the answered one keeps its element, so its new balance tips in place. */}
      <ChallengeView key={revealing ? game.total - 1 : game.total} challenge={shown} revealed={revealing} />
    </GameFrame>
  );
}
