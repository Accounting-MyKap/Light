import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ThemeSetting } from '../app/theme';
import { updateSettings, useSettings } from '../data/settings';
import type { Language } from '../i18n';
import { syncConfig } from '../sync/config';
import { deleteEverything, getRemote } from '../sync';
import { SegmentedControl } from '../app/ui/SegmentedControl';
import { Switch } from '../app/ui/Switch';
import styles from './Settings.module.css';

const THEMES: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const currentLanguage: Language = i18n.language?.startsWith('es') ? 'es' : 'en';

  const deleteAll = async () => {
    setDeleting(true);
    setDeleted(false);
    setRemoteFailed(false);
    try {
      const outcome = await deleteEverything(getRemote());
      setConfirming(false);
      setDeleted(outcome === 'ok');
      setRemoteFailed(outcome === 'remote-failed');
    } catch (error) {
      // The device could not be cleared: no message claims otherwise, and the dialog stays open to try again.
      console.error('Deleting local data failed', error);
    } finally {
      setDeleting(false);
    }
  };

  const themeOptions = THEMES.map((theme) => ({ value: theme, label: t(`settings.themes.${theme}`) }));

  return (
    <section className={styles.screen}>
      <h1>{t('nav.settings')}</h1>

      <section className={styles.group}>
        <h2>{t('settings.appearance')}</h2>
        <div className={styles.card}>
          <div className={styles.line}>
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
          <SegmentedControl
            name="theme"
            legend={t('settings.theme')}
            options={themeOptions}
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
          />
        </div>
      </section>

      <section className={styles.group}>
        <h2>{t('settings.duringGame')}</h2>
        <div className={styles.card}>
          <Switch
            id="sound"
            label={t('settings.sound')}
            checked={settings.sound}
            onChange={(sound) => void updateSettings({ sound })}
          />
          <Switch
            id="vibration"
            label={t('settings.vibration')}
            hint={t('settings.vibrationHint')}
            checked={settings.vibration}
            onChange={(vibration) => void updateSettings({ vibration })}
          />
        </div>
      </section>

      <section className={styles.group}>
        <h2>{t('settings.privacyTitle')}</h2>
        <div className={styles.card}>
          <p className={styles.muted}>{t(syncConfig ? 'settings.privacySync' : 'settings.privacy')}</p>
          {syncConfig?.turnstileSiteKey && <p className={styles.muted}>{t('settings.privacyCaptcha')}</p>}
        </div>
      </section>

      <section className={styles.group}>
        <h2>{t('settings.dataTitle')}</h2>
        {!confirming ? (
          <button type="button" className={styles.danger} onClick={() => setConfirming(true)}>
            {t('settings.deleteData')}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="confirm-delete" className={`${styles.card} ${styles.dialog}`}>
            <p id="confirm-delete">{t(syncConfig ? 'settings.deleteConfirmSync' : 'settings.deleteConfirm')}</p>
            <button type="button" className={styles.confirmYes} disabled={deleting} onClick={() => void deleteAll()}>
              {t('settings.deleteYes')}
            </button>
            <button type="button" className={styles.confirmNo} disabled={deleting} onClick={() => setConfirming(false)}>
              {t('settings.deleteCancel')}
            </button>
          </div>
        )}
        {deleted && <p role="status" className={styles.muted}>{t(syncConfig ? 'settings.deletedSync' : 'settings.deleted')}</p>}
        {remoteFailed && <p role="alert" className={styles.error}>{t('settings.deleteRemoteError')}</p>}
      </section>
    </section>
  );
}
