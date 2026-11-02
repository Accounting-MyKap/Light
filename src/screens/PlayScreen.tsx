import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { playTone } from '../core/sound';
import { getStartLevel } from '../data/levels';
import { DEFAULT_SETTINGS, getSettings, updateSettings, useSettings } from '../data/settings';
import { getGame } from '../games/registry';
import { LuzScope } from '../games/shared/luz/LuzScope';
import { PlayChromeContext, type PlayChrome, type PlayHud } from '../games/shared/playChrome';
import type { GameDefinition, GameResult } from '../games/types';
import { recordGameResult } from '../play/recordGameResult';
import { requestSync } from '../sync';
import { AreaLabel } from './play/AreaLabel';
import { Instructions } from './play/Instructions';
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

async function markInstructionsSeen(gameId: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.seenInstructions.includes(gameId)) {
    await updateSettings({ seenInstructions: [...settings.seenInstructions, gameId] });
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'intro'; showInstructions: boolean; firstTime: boolean }
  | { kind: 'playing' }
  | { kind: 'result'; result: GameResult; previousBest: number | null; nextGameId: string | null }
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
  const [startLevel, setStartLevel] = useState(1);
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
    ]).then(([level, settings]) => {
      if (!alive) return;
      const firstTime = !settings.seenInstructions.includes(game.id);
      setStartLevel(level);
      setPhase({ kind: 'intro', showInstructions: firstTime, firstTime });
    });
    return () => {
      alive = false;
    };
  }, [game.id]);

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
    if (phase.kind === 'intro' && phase.firstTime) void markInstructionsSeen(game.id);
    startPlaying();
  };

  // The result id is fixed per finished game so a retry after a storage error never duplicates it.
  const save = useCallback(
    async (result: GameResult, resultId: string) => {
      try {
        const recorded = await recordGameResult({ game, startLevel, result, daily, resultId });
        setStartLevel(recorded.newStartLevel);
        const nextGameId = recorded.plan?.gameIds.find((id) => !recorded.plan?.completed.includes(id)) ?? null;
        setPhase({ kind: 'result', result, previousBest: recorded.previousBest, nextGameId });
        // Once per finished game: only a save that went through gets here, and "play again" starts a new game.
        void requestSync();
      } catch (error) {
        console.error(error);
        setPhase({ kind: 'saveError', result, resultId });
      }
    },
    [game, startLevel, daily],
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

  const exit = () => {
    if (daily !== null) navigate('/');
    else if (location.key === 'default') navigate('/games');
    else navigate(-1);
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
        if (phase.showInstructions) return <Instructions game={game} onStart={handleStart} />;
        return (
          <section className={styles.screen}>
            <AreaLabel area={game.area} />
            <h1 className={styles.introTitle}>{title}</h1>
            <p className={styles.description}>{t(`games.${game.id}.description`)}</p>
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
          <section ref={playRef} tabIndex={-1} className={`${styles.screen} ${styles.playing}`} data-game={game.id}>
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
            onBack={() => navigate('/games')}
            daily={
              daily === null
                ? undefined
                : {
                    nextGameId: phase.nextGameId,
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
