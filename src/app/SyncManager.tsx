import { useEffect } from 'react';
import { startSyncService } from '../sync';

/** Runs the background sync for as long as the app is open. Draws nothing. */
export function SyncManager() {
  useEffect(() => startSyncService(), []);
  return null;
}
