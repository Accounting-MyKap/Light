import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ThemeSetting } from '../app/theme';
import { clearAllData } from '../data/db';
import { updateSettings, useSettings } from '../data/settings';
import type { Language } from '../i18n';
import styles from './Screens.module.css';

const THEMES: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const currentLanguage: Language = i18n.language?.startsWith('es') ? 'es' : 'en';

  const deleteAll = async () => {
    await clearAllData();
    setConfirming(false);
    setDeleted(true);
  };

  return (
    <section className={styles.screen}>
      <h1>{t('nav.settings')}</h1>

      <div className={styles.section}>
        <label htmlFor="language">{t('settings.language')}</label>
        <select
          id="language"
          className={styles.select}
          value={currentLanguage}
          onChange={(e) => void updateSettings({ language: e.target.value as Language })}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>

      <fieldset className={`${styles.section} ${styles.fieldset}`}>
        <legend>{t('settings.theme')}</legend>
        {THEMES.map((theme) => (
          <label key={theme} className={styles.option}>
            <input
              type="radio"
              name="theme"
              value={theme}
              checked={settings.theme === theme}
              onChange={() => void updateSettings({ theme })}
            />{' '}
            {t(`settings.themes.${theme}`)}
          </label>
        ))}
      </fieldset>

      <label className={styles.option}>
        <input
          type="checkbox"
          role="switch"
          checked={settings.sound}
          onChange={(e) => void updateSettings({ sound: e.target.checked })}
        />{' '}
        {t('settings.sound')}
      </label>

      <section className={styles.section}>
        <h2>{t('settings.privacyTitle')}</h2>
        <p className={styles.muted}>{t('settings.privacy')}</p>
      </section>

      <section className={styles.section}>
        <h2>{t('settings.dataTitle')}</h2>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)}>
            {t('settings.deleteData')}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="confirm-delete">
            <p id="confirm-delete">{t('settings.deleteConfirm')}</p>
            <button type="button" onClick={() => void deleteAll()}>
              {t('settings.deleteYes')}
            </button>{' '}
            <button type="button" onClick={() => setConfirming(false)}>
              {t('settings.deleteCancel')}
            </button>
          </div>
        )}
        {deleted && <p role="status">{t('settings.deleted')}</p>}
      </section>
    </section>
  );
}
