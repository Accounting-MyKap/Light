import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPercentile, getRemote, requestSync } from '../../sync';
import styles from './Play.module.css';

/** Where the player stands among the others, once the latest game has reached the server. Shows nothing if unknown. */
export function PercentileLine({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  // Tied to its game, so an answer is never shown under another one.
  const [found, setFound] = useState<{ gameId: string; percent: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // The result just played must be on the server before it is ranked; `requestSync` resolves even when offline.
      await requestSync();
      if (!alive) return;
      const percent = await fetchPercentile(getRemote(), gameId, new Date());
      if (alive && typeof percent === 'number') setFound({ gameId, percent });
    })();
    return () => {
      alive = false;
    };
  }, [gameId]);

  if (found?.gameId !== gameId) return null;
  return <p className={styles.percentile}>{t('play.percentile', { percent: found.percent })}</p>;
}
