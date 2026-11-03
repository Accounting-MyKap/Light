import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PendingSyncBadge } from '../app/PendingSyncBadge';
import { SunIcon } from '../app/NavIcons';
import { useLocalDay } from '../app/useLocalDay';
import { computeStreak } from '../core/streak';
import { completedDays, getOrCreatePlan, getPlan, isPlanComplete } from '../data/dailyPlans';
import { db } from '../data/db';
import { getGame } from '../games/registry';
import styles from './Today.module.css';
import { WeekStrip } from './today/WeekStrip';

export function TodayScreen() {
  const { t } = useTranslation();
  const today = useLocalDay();
  const [planErrorDay, setPlanErrorDay] = useState<string | null>(null);
  const planError = planErrorDay === today;

  useEffect(() => {
    getOrCreatePlan(today).catch((error: unknown) => {
      console.error(error);
      setPlanErrorDay(today);
    });
  }, [today]);

  const plan = useLiveQuery(() => getPlan(today), [today]);
  const days = useLiveQuery(completedDays, [], []);
  const dailyResults = useLiveQuery(
    () => db.results.where('day').equals(today).filter((r) => r.isDaily).sortBy('playedAt'),
    [today],
    [],
  );

  const streak = computeStreak(days, today);
  const done = plan ? isPlanComplete(plan) : false;
  const next = plan?.gameIds.find((id) => !plan.completed.includes(id));
  const lastScore = new Map(dailyResults.map((r) => [r.gameId, r.score]));

  const rows = plan && (
    <ol className={styles.plan} data-complete={done}>
      {plan.gameIds.map((id) => {
        const game = getGame(id);
        const state = plan.completed.includes(id) ? 'done' : id === next ? 'next' : 'pending';
        return (
          <li key={id} className={styles.row} data-state={state} data-area={game?.area}>
            {game && (
              <div className={styles.thumb} aria-hidden="true">
                <game.Thumb />
              </div>
            )}
            <span className={styles.rowText}>
              <span className={styles.itemTitle}>{t(`games.${id}.title`, { defaultValue: id })}</span>
              {game && <span className={styles.skill}>{t(`games.${id}.skill`)}</span>}
            </span>
            {state === 'done' && (
              <span className={styles.ok}>
                <span aria-hidden="true">✓</span>
                <span className="visually-hidden">{t('today.done')}</span>
                <span className={styles.score}>{lastScore.get(id) ?? '—'}</span>
              </span>
            )}
            {state === 'next' && <span className={styles.next}>{t('today.next')}</span>}
          </li>
        );
      })}
    </ol>
  );

  return (
    <section className={styles.screen}>
      <div className={styles.top}>
        <span className={styles.brand}>{t('app.name')}</span>
        <span className={styles.streakPill}>
          <SunIcon />
          <span aria-hidden="true">{t('today.streakDays', { count: streak.current })}</span>
          <span className="visually-hidden">{t('today.streak', { count: streak.current })}</span>
        </span>
      </div>
      <h1>{t('today.title')}</h1>
      <PendingSyncBadge />
      {plan && !done && <p className={styles.muted}>{t('today.intro')}</p>}

      <WeekStrip today={today} completed={days} />

      {!plan && planError && <p role="alert">{t('today.loadError')}</p>}

      {plan && done && (
        <>
          <h2>{t('today.completed')}</h2>
          {rows}
          <p className={styles.muted}>{t('today.comeBack')}</p>
          <Link className={styles.secondary} to="/games">
            {t('today.explore')}
          </Link>
        </>
      )}

      {plan && !done && (
        <>
          {rows}
          {next && (
            <Link className={styles.primary} to={`/play/${next}?daily=${today}`}>
              {plan.completed.length === 0
                ? t('common.start')
                : t('today.continueStep', { step: plan.completed.length + 1, total: plan.gameIds.length })}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
