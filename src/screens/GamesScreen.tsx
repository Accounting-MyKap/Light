import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useLocalDay } from '../app/useLocalDay';
import { getPlan } from '../data/dailyPlans';
import { catalogAreas } from '../games/catalog';
import { GAMES, getGame } from '../games/registry';
import type { Area } from '../games/types';
import styles from './Games.module.css';

export function GamesScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const today = useLocalDay();
  const plan = useLiveQuery(() => getPlan(today), [today]);
  const areas = catalogAreas(GAMES);
  const raw = params.get('area') as Area | null;
  const selected = raw && areas.includes(raw) ? raw : null;
  const visible = selected ? [selected] : areas;
  const planned = (plan?.gameIds ?? []).flatMap((id) => {
    const g = getGame(id);
    return g ? [g] : [];
  });

  const choose = (area: Area | null) => setParams(area ? { area } : {}, { replace: true });

  return (
    <div className={styles.screen}>
      <h1>{t('nav.games')}</h1>
      <div role="group" aria-label={t('gamesScreen.filters')} className={styles.filters}>
        <button type="button" className={styles.pill} aria-pressed={selected === null} onClick={() => choose(null)}>
          {t('gamesScreen.all')}
        </button>
        {areas.map((area) => (
          <button
            key={area}
            type="button"
            className={styles.pill}
            aria-pressed={selected === area}
            onClick={() => choose(area)}
          >
            {t(`areas.${area}`)}
          </button>
        ))}
      </div>

      {selected === null && plan && planned.length > 0 && (
        <section aria-labelledby="games-today" className={styles.section}>
          <h2 id="games-today">{t('gamesScreen.today')}</h2>
          <ul className={styles.grid}>
            {planned.map((g) => (
              <li key={g.id}>
                <Link className={styles.card} to={`/play/${g.id}?daily=${today}`}>
                  <div className={styles.thumb}>
                    <g.Thumb />
                    {plan.completed.includes(g.id) && (
                      <>
                        <span className={styles.done} aria-hidden="true">✓</span>
                        <span className="visually-hidden">{t('gamesScreen.played')}</span>
                      </>
                    )}
                  </div>
                  <span className={styles.name}>{t(`games.${g.id}.title`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.map((area) => (
        <section key={area} aria-labelledby={`games-${area}`} className={styles.section}>
          <h2 id={`games-${area}`}>
            <span className={styles.dot} data-area={area} aria-hidden="true" />
            {t(`areas.${area}`)}
          </h2>
          <ul className={styles.grid}>
            {GAMES.filter((g) => g.area === area).map((g) => (
              <li key={g.id}>
                <Link className={styles.card} to={`/play/${g.id}`}>
                  <g.Thumb />
                  <h3 className={styles.name}>{t(`games.${g.id}.title`)}</h3>
                  <span className={styles.skill}>{t(`games.${g.id}.skill`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
