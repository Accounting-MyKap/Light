import { clearAllData } from '../data/db';
import type { RemoteStore } from './remote';

/**
 * Deletes the player's data on the server (when there is a session) and then on the device.
 *
 * `'remote-failed'` means the server side could not be completed, and nothing on the device was touched: wiping the
 * device first would orphan the server copy, since the session that owns it would be gone. Trying again is safe. If the
 * server data went but signing out failed, the retry finds no session and just clears the device.
 *
 * A failure to clear the device itself rejects, as `clearAllData` does.
 *
 * The app calls it through `deleteEverything` in `./index`, which queues it behind any sync run in flight.
 */
export async function deleteEverything(remote: RemoteStore | null): Promise<'ok' | 'remote-failed'> {
  if (remote) {
    try {
      if ((await remote.currentUserId()) !== null) {
        await remote.deleteMyData();
        await remote.signOut();
      }
    } catch (error) {
      console.warn('Deleting the server data failed', error);
      return 'remote-failed';
    }
  }
  await clearAllData();
  return 'ok';
}
