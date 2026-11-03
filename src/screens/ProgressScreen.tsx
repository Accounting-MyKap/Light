import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { areaScores } from '../core/areaScore';
import { useLocalDay } from '../app/useLocalDay';
import { computeStreak } from '../core/streak';
import { completedDays } from '../data/dailyPlans';
import { listResults } from '../data/results';
import { GAMES } from '../games/registry';
import { CATALOG_AREAS, catalogAreas } from '../games/catalog';
import { LineChart } from './progress/LineChart';
import styles from './Progress.module.css';

const CHART_POINTS = 30;

export function ProgressScreen() {
  const { t } = useTranslation();
  const today = useLocalDay();
  // The 30-day window is measured from the end of the current local day.
  const now = useMemo(() => new Date(`${today}T23:59:59`), [today]);
  const results = useLiveQuery(() => listResults(), []);
  const days = useLiveQuery(completedDays, [], []);

  if (!results) return <h1>{t('nav.progress')}</h1>;

  if (results.length === 0) {
    return (
      <section className={styles.screen}>
        <h1>{t('nav.progress')}</h1>
        <p className={styles.muted}>{t('progress.empty')}</p>
        <Link to="/" className={styles.cta}>{t('progress.goToday')}</Link>
      </section>
    );
  }

  const scores = areaScores(results, GAMES, now);
  const streak = computeStreak(days, today);
  const daysTrained = new Set(results.map((r) => r.day)).size;

  const games = GAMES.map((g, i) => ({ g, i }))
    .sort((a, b) => CATALOG_AREAS.indexOf(a.g.area) - CATALOG_AREAS.indexOf(b.g.area) || a.i - b.i)
    .map((x) => x.g);

  return (
    <section className={styles.screen}>
      <h1>{t('nav.progress')}</h1>

      <ul className={styles.stats}>
        <li><b>{streak.current}</b><span>{t('progress.statStreak')}</span></li>
        <li><b>{streak.best}</b><span>{t('progress.statBest')}</span></li>
        <li><b>{daysTrained}</b><span>{t('progress.statDays')}</span></li>
      </ul>

      <h2>{t('progress.byArea')}</h2>
      <div className={`${styles.card} ${styles.areas}`}>
        {catalogAreas(GAMES).map((area) => {
          const value = scores[area];
          const id = `meter-${area}`;
          return (
            <div key={area} className={styles.bar} data-area={area}>
              <span id={id}>{t(`areas.${area}`)}</span>
              {value === undefined ? (
                <span className={styles.muted}>—</span>
              ) : (
                <div role="meter" aria-labelledby={id} aria-valuemin={0} aria-valuemax={1000} aria-valuenow={value} className={styles.track}>
                  <i style={{ width: `${value / 10}%` }} />
                </div>
              )}
              <span className={styles.value}>{value ?? ''}</span>
            </div>
          );
        })}
      </div>

      <h2>{t('progress.byGame')}</h2>
      {games.map((g) => {
        const values = results.filter((r) => r.gameId === g.id).map((r) => r.score);
        if (values.length === 0) return null;
        const recent = values.slice(-CHART_POINTS);
        return (
          <article key={g.id} className={`${styles.card} ${styles.game}`} data-area={g.area}>
            <div className={styles.gameHead}>
              <div className={styles.thumb} aria-hidden="true">
                <g.Thumb />
              </div>
              <div className={styles.gameText}>
                <h3>{t(`games.${g.id}.title`)}</h3>
                <span>{t('progress.best', { score: Math.max(...values) })}</span>
              </div>
            </div>
            <LineChart
              className={styles.chart}
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
  );
}
