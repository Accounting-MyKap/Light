import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { areaScores } from '../core/areaScore';
import { useLocalDay } from '../app/useLocalDay';
import { computeStreak } from '../core/streak';
import { completedDays } from '../data/dailyPlans';
import type { StoredResult } from '../data/db';
import { listResults } from '../data/results';
import { TRAINING_GAMES } from '../games/registry';
import { CATALOG_AREAS, catalogAreas } from '../games/catalog';
import { LineChart } from './progress/LineChart';
import { QuizProgress } from './progress/QuizProgress';
import styles from './Progress.module.css';

const CHART_POINTS = 30;

export function ProgressScreen() {
  const { t } = useTranslation();
  const today = useLocalDay();
  // The 30-day window is measured from the end of the current local day.
  const now = useMemo(() => new Date(`${today}T23:59:59`), [today]);
  // A local read that fails (IndexedDB closed or blocked) shows what an empty history would, never the error screen.
  const results = useLiveQuery(() => listResults().catch((): StoredResult[] => []), []);
  const days = useLiveQuery(() => completedDays().catch((): string[] => []), [], []);

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

  // The training metrics count only the training games; quiz rounds have their own block below.
  const trainingIds = new Set(TRAINING_GAMES.map((g) => g.id));
  const scores = areaScores(results, TRAINING_GAMES, now);
  const streak = computeStreak(days, today);
  const training = results.filter((r) => trainingIds.has(r.gameId));
  const daysTrained = new Set(training.map((r) => r.day)).size;

  const games = TRAINING_GAMES.map((g, i) => ({ g, i }))
    .sort((a, b) => CATALOG_AREAS.indexOf(a.g.area) - CATALOG_AREAS.indexOf(b.g.area) || a.i - b.i)
    .map((x) => x.g);

  return (
    <section className={styles.screen}>
      <h1>{t('nav.progress')}</h1>

      {training.length === 0 ? (
        // A quiz-only player: the streaks, area scores and per-game charts would all be empty. The way into training
        // is the empty state's.
        <>
          <p className={styles.muted}>{t('progress.trainingEmpty')}</p>
          <Link to="/" className={styles.cta}>{t('progress.goToday')}</Link>
        </>
      ) : (
        <>
          <ul className={styles.stats}>
            <li><b>{streak.current}</b><span>{t('progress.statStreak')}</span></li>
            <li><b>{streak.best}</b><span>{t('progress.statBest')}</span></li>
            <li><b>{daysTrained}</b><span>{t('progress.statDays')}</span></li>
          </ul>

          <section className={styles.block} aria-labelledby="progress-by-area">
            <h2 id="progress-by-area">{t('progress.byArea')}</h2>
            <div className={`${styles.card} ${styles.areas}`}>
              {catalogAreas(TRAINING_GAMES).map((area) => {
                const value = scores[area];
                const id = `meter-${area}`;
                return (
                  <div key={area} className={styles.bar} data-area={area}>
                    <span id={id}>{t(`areas.${area}`)}</span>
                    {value === undefined ? (
                      <span className={styles.muted}>—</span>
                    ) : (
                      <div role="meter" aria-labelledby={id} aria-valuemin={0} aria-valuemax={1000} aria-valuenow={value} aria-valuetext={String(value)} className={styles.track}>
                        <i style={{ width: `${value / 10}%` }} />
                      </div>
                    )}
                    <span className={styles.value} aria-hidden="true">{value ?? ''}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.block} aria-labelledby="progress-by-game">
            <h2 id="progress-by-game">{t('progress.byGame')}</h2>
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
        </>
      )}

      <QuizProgress results={results} now={now} />
    </section>
  );
}
