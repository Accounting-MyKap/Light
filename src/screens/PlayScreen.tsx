import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { playTone } from '../core/sound';
import { getStartLevel } from '../data/levels';
import { highestLevelReached } from '../data/results';
import { DEFAULT_SETTINGS, getSettings, updateSettings, useSettings } from '../data/settings';
import { getGame } from '../games/registry';
import { LuzScope } from '../games/shared/luz/LuzScope';
import { PlayChromeContext, type PlayChrome, type PlayHud } from '../games/shared/playChrome';
import type { GameDefinition, GameResult } from '../games/types';
import { recordGameResult } from '../play/recordGameResult';
import { requestSync } from '../sync';
import { IntroHeader } from './play/IntroHeader';
import { Instructions } from './play/Instructions';
import { LevelPicker } from './play/LevelPicker';
import { PauseOverlay } from './play/PauseOverlay';
import { ResultView } from './play/ResultView';
import { ResumeCountdown } from './play/ResumeCountdown';
import styles from './play/Play.module.css';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function PlayScreen() {
  const { gameId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const dailyParam = searchParams.get('daily');
  const daily = dailyParam && DAY_PATTERN.test(dailyParam) ? dailyParam : null;
  const game = getGame(gameId);
  if (!game) return <GameNotFound />;
  return <PlaySession key={`${game.id}-${daily ?? 'free'}`} game={game} daily={daily} />;
}

function GameNotFound() {
  const { t } = useTranslation();
  return (
    <section className={styles.screen}>
      <h1>{t('errors.gameNotFound')}</h1>
      <Link to="/" className="link-button">
        {t('errors.backHome')}
      </Link>
    </section>
  );
}

/**
 * What «instructions seen» is stored under: the shared instructions key when several games use the same
 * instructions (the 14 quiz games), so they show only once; otherwise the game id, as it always was.
 */
const instructionsSeenKey = (game: GameDefinition) => game.instructionsKey ?? game.id;

async function markInstructionsSeen(key: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.seenInstructions.includes(key)) {
    await updateSettings({ seenInstructions: [...settings.seenInstructions, key] });
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'intro'; showInstructions: boolean; firstTime: boolean }
  | { kind: 'playing' }
  | {
      kind: 'result';
      result: GameResult;
      previousBest: number | null;
      nextGameId: string | null;
      /** How many games of the daily plan are done, this one included (0 of 0 when there is no plan). */
      progress: { done: number; total: number };
    }
  | { kind: 'saveError'; result: GameResult; resultId: string };

/** The pause of a running game: the sheet, then the 3-2-1 after «Continuar». The game stays paused through both. */
type Pause = 'off' | 'sheet' | 'resuming';

const NO_HUD: PlayHud = { score: 0, remainingMs: null };

function PlaySession({ game, daily }: { game: GameDefinition; daily: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sound } = useSettings();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // The level the app suggests (it adapts it after each game), the one chosen for the next game, and the highest one
  // reached so far, up to which a level can be chosen outside the daily training.
  const [suggestedLevel, setSuggestedLevel] = useState(1);
  const [startLevel, setStartLevel] = useState(1);
  const [highestLevel, setHighestLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [pause, setPause] = useState<Pause>('off');
  const paused = pause !== 'off';
  // The frame reports the score and time of the game here without re-rendering the screen; the sheet shows the
  // values from the moment it opened.
  const hudRef = useRef<PlayHud>(NO_HUD);
  const [pausedHud, setPausedHud] = useState<PlayHud>(NO_HUD);
  const playRef = useRef<HTMLElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getStartLevel(game.id).catch(() => 1),
      getSettings().catch(() => DEFAULT_SETTINGS),
      highestLevelReached(game.id).catch(() => 0),
    ]).then(([level, settings, highest]) => {
      if (!alive) return;
      const firstTime = !settings.seenInstructions.includes(instructionsSeenKey(game));
      setSuggestedLevel(level);
      setStartLevel(level);
      setHighestLevel(Math.max(level, highest));
      setPhase({ kind: 'intro', showInstructions: firstTime, firstTime });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const pauseGame = useCallback(() => {
    setPausedHud(hudRef.current);
    setPause('sheet');
  }, []);

  // Hiding the app pauses the game, and also sends a countdown back to the sheet.
  const isPlaying = phase.kind === 'playing';
  useEffect(() => {
    if (!isPlaying) return;
    const onVisibility = () => {
      if (document.hidden) pauseGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPlaying, pauseGame]);

  // A game can leave the page scrolled down (a long quiz question with its explanation, then «Ver resultado» at the
  // bottom), so every result opens at the top, with the title and the score in view. Before paint, so the result is never
  // drawn scrolled; and a jump, not a glide: it is a new screen, and nothing moves for whoever asked for less motion.
  const isResult = phase.kind === 'result';
  useLayoutEffect(() => {
    if (isResult) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [isResult]);

  // The game runs again and gets the focus back: it was on the pause sheet, which is gone.
  const resumeGame = useCallback(() => {
    setPause('off');
    playRef.current?.focus({ preventScroll: true });
  }, []);

  const startPlaying = useCallback(() => {
    finishedRef.current = false;
    setPause('off');
    setRound((r) => r + 1);
    setPhase({ kind: 'playing' });
  }, []);

  const handleStart = () => {
    if (phase.kind === 'intro' && phase.firstTime) void markInstructionsSeen(instructionsSeenKey(game));
    startPlaying();
  };

  // The result id is fixed per finished game so a retry after a storage error never duplicates it.
  const save = useCallback(
    async (result: GameResult, resultId: string) => {
      try {
        const recorded = await recordGameResult({ game, startLevel, suggestedLevel, result, daily, resultId });
        // Playing again keeps a level chosen for practice; at the suggested level, it follows the new suggestion.
        if (startLevel === suggestedLevel) setStartLevel(recorded.newStartLevel);
        setSuggestedLevel(recorded.newStartLevel);
        setHighestLevel((h) => Math.max(h, result.levelReached, recorded.newStartLevel));
        const nextGameId = recorded.plan?.gameIds.find((id) => !recorded.plan?.completed.includes(id)) ?? null;
        const progress = { done: recorded.plan?.completed.length ?? 0, total: recorded.plan?.gameIds.length ?? 0 };
        setPhase({ kind: 'result', result, previousBest: recorded.previousBest, nextGameId, progress });
        // Once per finished game: only a save that went through gets here, and "play again" starts a new game.
        void requestSync();
      } catch (error) {
        console.error(error);
        setPhase({ kind: 'saveError', result, resultId });
      }
    },
    [game, startLevel, suggestedLevel, daily],
  );

  const handleFinish = useCallback(
    async (result: GameResult) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (sound) playTone('finish');
      await save(result, crypto.randomUUID());
    },
    [save, sound],
  );

  // A quiz game belongs to the Quiz tab, so a deep link with no history lands there; the training games go to Games.
  const home = game.quiz ? '/quiz' : '/games';

  // Free play goes back in history (the catalog keeps its filter in the address); a deep link has none.
  const leaveFreePlay = () => {
    if (location.key === 'default') navigate(home);
    else navigate(-1);
  };
  const exit = () => {
    if (daily !== null) navigate('/');
    else leaveFreePlay();
  };

  const title = t(`games.${game.id}.title`);
  const reportHud = useCallback((hud: PlayHud) => {
    hudRef.current = hud;
  }, []);
  const chrome = useMemo<PlayChrome>(() => ({ title, onPause: pauseGame, reportHud }), [title, pauseGame, reportHud]);

  // Every phase of the game screen sits on the dark Luz background, whatever the app theme is.
  const renderPhase = (phase: Exclude<Phase, { kind: 'loading' }>) => {
    switch (phase.kind) {
      case 'intro':
        if (phase.showInstructions) return <Instructions game={game} onStart={handleStart} onExit={exit} />;
        return (
          <section className={styles.screen}>
            <IntroHeader area={game.area} onExit={exit} />
            <h1 className={styles.introTitle}>{title}</h1>
            <p className={styles.description}>{t(`games.${game.id}.description`)}</p>
            {daily === null && highestLevel > 1 && (
              <LevelPicker
                highest={highestLevel}
                chosen={startLevel}
                suggested={suggestedLevel}
                note={game.describeLevel?.(startLevel, t)}
                onChoose={setStartLevel}
              />
            )}
            <div className={styles.introActions}>
              <button className={styles.primary} onClick={handleStart}>
                {t('common.start')}
              </button>
              <button className={styles.secondary} onClick={() => setPhase({ ...phase, showInstructions: true })}>
                {t('common.howToPlay')}
              </button>
            </div>
          </section>
        );
      case 'playing': {
        const { Component } = game;
        return (
          <section
            ref={playRef}
            tabIndex={-1}
            aria-label={title}
            className={`${styles.screen} ${styles.playing}`}
            data-game={game.id}
          >
            {/* Dimmed, blurred and out of reach while the sheet or the countdown is on. */}
            <div className={styles.game} data-dimmed={paused} inert={paused}>
              <PlayChromeContext.Provider value={chrome}>
                <Component key={round} startLevel={startLevel} paused={paused} onFinish={handleFinish} />
              </PlayChromeContext.Provider>
            </div>
            {pause === 'sheet' && (
              <PauseOverlay hud={pausedHud} onContinue={() => setPause('resuming')} onExit={exit} />
            )}
            {pause === 'resuming' && <ResumeCountdown onDone={resumeGame} />}
          </section>
        );
      }
      case 'saveError':
        return (
          <section className={`${styles.screen} ${styles.center}`}>
            <h1>{title}</h1>
            <p role="alert">{t('play.saveError')}</p>
            <div className={styles.actions}>
              <button className={styles.primary} onClick={() => void save(phase.result, phase.resultId)}>
                {t('play.retry')}
              </button>
              <button className={styles.secondary} onClick={exit}>
                {t('common.exit')}
              </button>
            </div>
          </section>
        );
      case 'result':
        return (
          <ResultView
            game={game}
            result={phase.result}
            previousBest={phase.previousBest}
            onPlayAgain={startPlaying}
            onBack={leaveFreePlay}
            daily={
              daily === null
                ? undefined
                : {
                    nextGameId: phase.nextGameId,
                    progress: phase.progress,
                    onNext: () => navigate(`/play/${phase.nextGameId}?daily=${daily}`, { replace: true }),
                    onSummary: () => navigate('/'),
                  }
            }
          />
        );
    }
  };

  return <LuzScope area={game.area}>{phase.kind === 'loading' ? null : renderPhase(phase)}</LuzScope>;
}
