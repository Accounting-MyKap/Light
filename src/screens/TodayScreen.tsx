import { useTranslation } from 'react-i18next';

export function TodayScreen() {
  const { t } = useTranslation();
  return <h1>{t('nav.today')}</h1>;
}
