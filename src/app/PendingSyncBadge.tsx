import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { syncConfig } from '../sync/config';
import styles from './Layout.module.css';

/** Tells how many finished games are still waiting to upload. Shows nothing unless sync is configured. */
export function PendingSyncBadge() {
  // The query lives in its own component so a build without sync never reads the table for it.
  return syncConfig ? <PendingCount /> : null;
}

function PendingCount() {
  const { t } = useTranslation();
  // A storage error must never take the header down; without a count there is nothing to show.
  const pending = useLiveQuery(() => db.results.where('synced').equals(0).count().catch(() => 0), [], 0);
  if (pending === 0) return null;
  return (
    <span className={styles.pending} role="status">
      {t('sync.pending', { count: pending })}
    </span>
  );
}
