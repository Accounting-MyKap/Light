import { useTranslation } from 'react-i18next';

export function SettingsScreen() {
  const { t } = useTranslation();
  return <h1>{t('nav.settings')}</h1>;
}
