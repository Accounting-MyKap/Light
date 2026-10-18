import { useLiveQuery } from 'dexie-react-hooks';
import type { Language } from '../i18n';
import type { ThemeSetting } from '../app/theme';
import { db } from './db';

export interface Settings {
  language: Language | null;
  sound: boolean;
  theme: ThemeSetting;
  seenInstructions: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  language: null,
  sound: true,
  theme: 'auto',
  seenInstructions: [],
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('settings');
  return {
    language: stored?.language ?? DEFAULT_SETTINGS.language,
    sound: stored?.sound ?? DEFAULT_SETTINGS.sound,
    theme: stored?.theme ?? DEFAULT_SETTINGS.theme,
    seenInstructions: stored?.seenInstructions ?? [],
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch };
    await db.settings.put({ id: 'settings', ...next });
    return next;
  });
}

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
}
