import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameResult } from '../types';
import { INK, ShapeMark } from './art';
import { STATION_STYLES } from './maps';
import styles from './ResultDetails.module.css';

/**
 * «Tus trenes», below the stats of the result: how many trains reached their own station out of all that arrived,
 * the longest run sent home, and the station the person missed most, with a chip of its color and shape and its name
 * in words (the chip alone would not reach a screen reader, nor someone who cannot tell the colors apart).
 */
export function SwitchyardResultDetails({ result }: { result: GameResult }) {
  const { t } = useTranslation();
  const headingId = useId();
  const details = result.switchyard;
  if (!details || details.arrived === 0) return null;

  const worst = details.missed[0];
  const look = worst && STATION_STYLES[worst.style];
  return (
    <section className={styles.summary} aria-labelledby={headingId}>
      <h2 id={headingId}>{t('games.switchyard.result.title')}</h2>
      <ul className={styles.card}>
        <li>{t('games.switchyard.result.home', { home: details.home, arrived: details.arrived })}</li>
        {/* A run of none tells nothing the line above does not. */}
        {details.bestStreak > 0 && <li>{t('games.switchyard.result.bestStreak', { count: details.bestStreak })}</li>}
        {worst && look && (
          <li className={styles.worst}>
            <svg className={styles.chip} viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
              <circle r={11.5} fill={look.color} />
              <ShapeMark shape={look.shape} size={6.6} fill={INK} />
            </svg>
            <span>
              {t('games.switchyard.result.worstStation', {
                station: t(`games.switchyard.result.stations.${look.shape}`),
                count: worst.count,
              })}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
