import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { db } from '../data/db';
import { GAMES } from '../games/registry';
import { V1_AREAS } from '../games/types';
import styles from './Screens.module.css';

export function GamesScreen() {
  const { t } = useTranslation();
  const best = useLiveQuery(
    async () => {
      const map = new Map<string, number>();
      await db.results.each((r) => map.set(r.gameId, Math.max(map.get(r.gameId) ?? 0, r.score)));
      return map;
    },
    [],
    new Map<string, number>(),
  );

  return (
    <section className={styles.screen}>
      <h1>{t('nav.games')}</h1>
      {V1_AREAS.map((area) => {
        const games = GAMES.filter((g) => g.area === area);
        if (games.length === 0) return null;
        return (
          <section key={area} className={styles.section}>
            <h2>{t(`areas.${area}`)}</h2>
            <ul className={styles.cards}>
              {games.map((g) => (
                <li key={g.id}>
                  <Link className={styles.card} to={`/play/${g.id}`}>
                    <h3>{t(`games.${g.id}.title`)}</h3>
                    <p className={styles.muted}>{t(`games.${g.id}.description`)}</p>
                    <p>{t('gamesScreen.best', { score: best.get(g.id) ?? '—' })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
