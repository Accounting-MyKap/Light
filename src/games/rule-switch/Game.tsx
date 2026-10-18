import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock, useTrialTimeout } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { CardView, RuleIcon } from './Card';
import { answerRule, createRuleSwitchGame, ruleSwitchResult, ruleWindowMs, timeoutRule, type Side } from './engine';
import styles from './rule-switch.module.css';

export function RuleSwitchGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createRuleSwitchGame(startLevel, rng, 0));
  const [finished, setFinished] = useState(false);

  const remaining = useCountdown(clock, GAME_DURATION_MS, paused, () => {
    setFinished(true);
    onFinish(ruleSwitchResult(game, GAME_DURATION_MS));
  });

  const active = !paused && !finished;

  useTrialTimeout(clock, game.trialStartedAt, active ? ruleWindowMs(game.staircase.level) : null, paused, () => {
    feedback('wrong');
    setGame(timeoutRule(game, clock.now(), rng));
  });

  const answer = (side: Side) => {
    if (!active) return false;
    const res = answerRule(game, side, clock.now(), rng);
    if (res.correct === null) return false;
    feedback(res.correct ? 'correct' : 'wrong');
    setGame(res.state);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return answer('left');
    if (key === 'ArrowRight') return answer('right');
    return false;
  });

  const { trial } = game;

  return (
    <div className={styles.game}>
      <GameHud remainingMs={remaining} score={game.score} level={game.staircase.level} />
      <div
        key={game.justSwitched ? `rule-${game.total}` : 'rule-steady'}
        className={`${styles.banner} ${game.justSwitched ? styles.switched : ''}`}
        data-testid="rule-banner"
        data-rule={game.rule}
        aria-live="polite"
      >
        <RuleIcon rule={game.rule} />
        {t(`games.rule-switch.rule.${game.rule}`)}
      </div>
      <CardView key={`stimulus-${game.total}`} card={trial.stimulus} testId="stimulus" className={`${styles.stimulus} appear`} />
      <div className={styles.targets}>
        <CardView card={trial.left} testId="target-left" onSelect={() => answer('left')} />
        <CardView card={trial.right} testId="target-right" onSelect={() => answer('right')} />
      </div>
    </div>
  );
}
