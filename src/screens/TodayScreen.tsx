import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { localDay } from '../core/dates';
import { computeStreak } from '../core/streak';
import { completedDays, getOrCreatePlan, getPlan, isPlanComplete } from '../data/dailyPlans';
import { db } from '../data/db';
import { getGame } from '../games/registry';
import styles from './Today.module.css';

function LightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </g>
    </svg>
  );
}

export function TodayScreen() {
  const { t } = useTranslation();
  const [today] = useState(() => localDay(new Date()));

  useEffect(() => {
    void getOrCreatePlan(today);
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

  return (
    <section className={styles.screen}>
      <h1>{t('today.title')}</h1>
      <p className={styles.streak}>
        <LightIcon />
        {t('today.streak', { count: streak.current })}
      </p>

      {plan && done && (
        <>
          <h2>{t('today.completed')}</h2>
          <ul className={styles.summary}>
            {plan.gameIds.map((id) => (
              <li key={id} className={styles.item}>
                <span className={styles.itemTitle}>{t(`games.${id}.title`)}</span>
                <span className={styles.score}>{lastScore.get(id) ?? '—'}</span>
              </li>
            ))}
          </ul>
          <p className={styles.muted}>{t('today.comeBack')}</p>
        </>
      )}

      {plan && !done && (
        <>
          <p className={styles.muted}>{t('today.intro')}</p>
          <ol className={styles.plan}>
            {plan.gameIds.map((id) => {
              const game = getGame(id);
              const isDone = plan.completed.includes(id);
              return (
                <li key={id} className={styles.item} data-done={isDone}>
                  <span>
                    <span className={styles.itemTitle}>{t(`games.${id}.title`)}</span>
                    <br />
                    {game && <span className={styles.itemArea}>{t(`areas.${game.area}`)}</span>}
                  </span>
                  {isDone && <span className={styles.badge}>{t('today.done')}</span>}
                </li>
              );
            })}
          </ol>
          {next && (
            <Link className={styles.primary} to={`/play/${next}?daily=${today}`}>
              {plan.completed.length === 0 ? t('common.start') : t('common.continue')}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
