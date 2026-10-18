import { useTranslation } from 'react-i18next';

export function ProgressScreen() {
  const { t } = useTranslation();
  return <h1>{t('nav.progress')}</h1>;
}
