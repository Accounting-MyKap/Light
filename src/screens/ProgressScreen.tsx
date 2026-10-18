import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { areaScores } from '../core/areaScore';
import { localDay } from '../core/dates';
import { computeStreak } from '../core/streak';
import { completedDays } from '../data/dailyPlans';
import { listResults } from '../data/results';
import { GAMES } from '../games/registry';
import { V1_AREAS } from '../games/types';
import { LineChart } from './progress/LineChart';
import styles from './Screens.module.css';

const CHART_POINTS = 30;

export function ProgressScreen() {
  const { t } = useTranslation();
  const [now] = useState(() => new Date());
  const results = useLiveQuery(() => listResults(), []);
  const days = useLiveQuery(completedDays, [], []);

  if (!results) return <h1>{t('nav.progress')}</h1>;

  if (results.length === 0) {
    return (
      <section className={styles.screen}>
        <h1>{t('nav.progress')}</h1>
        <p className={styles.muted}>{t('progress.empty')}</p>
      </section>
    );
  }

  const scores = areaScores(results, GAMES, now);
  const streak = computeStreak(days, localDay(now));
  const daysTrained = new Set(results.map((r) => r.day)).size;

  return (
    <section className={styles.screen}>
      <h1>{t('nav.progress')}</h1>

      <ul className={styles.stats}>
        <li>{t('progress.streakCurrent', { count: streak.current })}</li>
        <li>{t('progress.streakBest', { count: streak.best })}</li>
        <li>{t('progress.daysTrained', { count: daysTrained })}</li>
      </ul>

      <section className={styles.section}>
        <h2>{t('progress.byArea')}</h2>
        {V1_AREAS.map((area) => {
          const value = scores[area];
          const id = `meter-${area}`;
          return (
            <div key={area} className={styles.meterRow}>
              <span id={id}>{t(`areas.${area}`)}</span>
              {value === undefined ? (
                <span className={styles.muted}>—</span>
              ) : (
                <meter aria-labelledby={id} min={0} max={1000} value={value} />
              )}
              <span className={styles.value}>{value ?? ''}</span>
            </div>
          );
        })}
      </section>

      <section className={styles.section}>
        <h2>{t('progress.byGame')}</h2>
        {GAMES.map((g) => {
          const values = results.filter((r) => r.gameId === g.id).map((r) => r.score);
          if (values.length === 0) return null;
          const recent = values.slice(-CHART_POINTS);
          return (
            <article key={g.id} className={styles.card}>
              <h3>{t(`games.${g.id}.title`)}</h3>
              <p className={styles.muted}>{t('gamesScreen.best', { score: Math.max(...values) })}</p>
              <LineChart
                values={recent}
                label={t('progress.chartLabel', {
                  count: recent.length,
                  min: Math.min(...recent),
                  max: Math.max(...recent),
                  last: recent[recent.length - 1],
                })}
              />
            </article>
          );
        })}
      </section>
    </section>
  );
}
