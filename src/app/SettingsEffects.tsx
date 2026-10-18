import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { getSettings } from '../data/settings';
import { i18n } from '../i18n';
import { applyTheme } from './theme';

/** Applies saved language and theme. A null language keeps the one detected at startup. */
export function SettingsEffects() {
  const settings = useLiveQuery(getSettings, []);
  const language = settings?.language ?? null;
  const theme = settings?.theme;

  useEffect(() => {
    if (!language) return;
    document.documentElement.lang = language;
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  return null;
}
