import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { playTone } from '../../core/sound';
import { VIBRATION, vibrate } from '../../core/vibrate';
import { useSettings } from '../../data/settings';
import { PlayChromeContext } from './playChrome';
import { Flash, useReactionSignal } from './reaction';
import styles from './GameFrame.module.css';

export interface GameFrameProps {
  score: number;
  level: number;
  /**
   * Games with a clock. `stopped` is a clock that is not counting down and keeps the time it had (the quiz, while
   * the answer to a question is shown): with nothing to hurry for, its bar is never urgent. `urgentMs` is the
   * window at the end when the bar turns urgent (default 10 s); the quiz, with 20 s questions, uses 5 s.
   */
  time?: { remainingMs: number; totalMs: number; stopped?: boolean; urgentMs?: number };
  /** Games played in rounds (Secuencia de luces). */
  rounds?: { current: number; total: number };
  /** Games with lives (Lluvia de estrellas). */
  lives?: { left: number; total: number };
  /** Bottom zone: the answer buttons. */
  controls?: ReactNode;
  /** Flash over the whole game zone on each answer (on by default). Off for a game that draws its own reaction. */
  stageFlash?: boolean;
  /** Announce a level-up with a badge, a tone and a vibration (on by default). Off in the quiz. */
  levelUp?: boolean;
  /** The game zone. */
  children: ReactNode;
}

/** The last seconds, when the time bar turns urgent. */
const URGENT_MS = 10_000;

/** How long the level-up badge stays. */
export const LEVEL_UP_MS = 1_600;

/**
 * The common frame of every game: top bar (title and pause button when the game screen provides them, level,
 * points), time bar or round dots, the game zone and the controls. It also draws the reaction to each answer:
 * the points that float, a flash over the game zone and the shake of a wrong answer.
 */
export function GameFrame({
  score,
  level,
  time,
  rounds,
  lives,
  controls,
  stageFlash = true,
  levelUp = true,
  children,
}: GameFrameProps) {
  const { t } = useTranslation();
  const chrome = useContext(PlayChromeContext);
  const stageRef = useRef<HTMLDivElement>(null);

  // The game screen gets the score and time for its pause overlay. Only their values should trigger a report,
  // not the identity of its callback, so the latest one is kept apart.
  const reportHud = useRef(chrome?.reportHud);
  useEffect(() => {
    reportHud.current = chrome?.reportHud;
  });
  const remainingMs = time?.remainingMs ?? null;
  useEffect(() => {
    reportHud.current?.({ score, remainingMs });
  }, [score, remainingMs]);

  // The points that float: the real difference of the latest change, restarted on every change. Kept in state
  // and adjusted while rendering, so the first render shows nothing and a change never needs a second pass.
  const [lastScore, setLastScore] = useState(score);
  const [float, setFloat] = useState<{ delta: number; change: number } | null>(null);
  if (score !== lastScore) {
    setLastScore(score);
    setFloat({ delta: score - lastScore, change: (float?.change ?? 0) + 1 });
  }

  const signal = useReactionSignal(stageRef);
  const notice = useLevelUpNotice(level, levelUp);

  return (
    <div className={styles.frame}>
      <div className={styles.top}>
        {chrome && (
          <button type="button" className={styles.exit} aria-label={t('play.exit')} onClick={chrome.onPause}>
            <span aria-hidden="true">✕</span>
          </button>
        )}
        <div className={styles.heading}>
          {chrome && <h1>{chrome.title}</h1>}
          <dl className={styles.level}>
            <div>
              <dt>{t('game.hud.level')}</dt>
              <dd key={notice?.id} data-bump={notice ? 'true' : undefined}>
                {level}
              </dd>
            </div>
          </dl>
        </div>
        <div className={styles.score}>
          <dl className={styles.chip}>
            <div>
              <dt className="visually-hidden">{t('game.hud.score')}</dt>
              <dd>{score}</dd>
            </div>
          </dl>
          {float && (
            <span
              key={float.change}
              className={styles.float}
              data-sign={float.delta > 0 ? 'gain' : 'loss'}
              aria-hidden="true"
            >
              {`${float.delta > 0 ? '+' : '−'}${Math.abs(float.delta)}`}
            </span>
          )}
        </div>
      </div>

      {time && (
        <TimeBar
          remainingMs={time.remainingMs}
          totalMs={time.totalMs}
          stopped={time.stopped ?? false}
          urgentMs={time.urgentMs ?? URGENT_MS}
        />
      )}
      {rounds && <RoundDots current={rounds.current} total={rounds.total} />}

      {lives && <Lives left={lives.left} total={lives.total} />}

      <div ref={stageRef} className={styles.stage} data-zone="stage">
        {/* The game's children and the flash are siblings, so each gets its own scope: a game that keys its
            element (Arrows keys its row by trial count, which can equal a signal id) can never share a key
            with the flash, which would stop React from removing the old rows. */}
        <>{children}</>
        {stageFlash && <Flash signal={signal} />}
        {notice && (
          <div key={notice.id} className={styles.levelUp} data-testid="level-up" aria-hidden="true">
            <strong>{t('game.levelUp.badge', { n: notice.level })}</strong>
            <span>{t('game.levelUp.harder')}</span>
          </div>
        )}
      </div>
      {/* Mounted empty, so the announcement of a level-up is read out when it arrives. */}
      <p className="visually-hidden" aria-live="polite">
        {notice ? t('game.levelUp.announce', { n: notice.level }) : ''}
      </p>

      {controls && (
        <div className={styles.controls} data-zone="controls">
          {controls}
        </div>
      )}
    </div>
  );
}

interface LevelUpNotice {
  level: number;
  id: number;
}

/**
 * The level-up being announced, or null. A rise of the level (never the first render, never a drop) starts a new
 * notice that plays the level-up tone and vibration, each per its setting, and clears itself after LEVEL_UP_MS.
 */
function useLevelUpNotice(level: number, enabled: boolean): LevelUpNotice | null {
  const { sound, vibration } = useSettings();
  const [lastLevel, setLastLevel] = useState(level);
  const [notice, setNotice] = useState<LevelUpNotice | null>(null);
  const [count, setCount] = useState(0);
  if (level !== lastLevel) {
    setLastLevel(level);
    if (enabled && level > lastLevel) {
      setNotice({ level, id: count + 1 });
      setCount(count + 1);
    }
  }

  // The latest settings, so a change of a setting never replays the tone of the current notice.
  const settings = useRef({ sound, vibration });
  useEffect(() => {
    settings.current = { sound, vibration };
  });

  useEffect(() => {
    if (!notice) return;
    if (settings.current.sound) playTone('levelUp');
    if (settings.current.vibration) vibrate(VIBRATION.levelUp);
    const id = setTimeout(() => setNotice(null), LEVEL_UP_MS);
    return () => clearTimeout(id);
  }, [notice]);

  return notice;
}

function TimeBar({
  remainingMs,
  totalMs,
  stopped,
  urgentMs,
}: {
  remainingMs: number;
  totalMs: number;
  stopped: boolean;
  urgentMs: number;
}) {
  const { t } = useTranslation();
  const left = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={t('game.hud.time')}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs / 1000)}
      aria-valuenow={secondsLeft}
      aria-valuetext={t('game.hud.secondsLeft', { count: secondsLeft })}
      data-urgent={!stopped && remainingMs <= urgentMs}
    >
      <div className={styles.fill} style={{ transform: `scaleX(${left})` }} />
    </div>
  );
}

function RoundDots({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return (
    // Explicit role: Safari drops the list semantics (and with them the label) once the markers are hidden.
    <ol className={styles.dots} role="list" aria-label={t('game.hud.round', { n: current, total })}>
      {Array.from({ length: total }, (_, index) => {
        const round = index + 1;
        return <li key={round} data-state={round < current ? 'done' : round === current ? 'now' : 'pending'} />;
      })}
    </ol>
  );
}

function Lives({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation();
  return (
    // Explicit role, like the round dots.
    <ol className={styles.lives} role="list" aria-label={t('game.hud.lives', { left, total })}>
      {Array.from({ length: total }, (_, index) => (
        <li key={index} data-state={index < left ? 'on' : 'off'} />
      ))}
    </ol>
  );
}
