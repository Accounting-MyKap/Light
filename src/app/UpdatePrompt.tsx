import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './Layout.module.css';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;
  return (
    <div className={styles.update} role="status">
      <span>{t('update.available')}</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </button>
    </div>
  );
}
