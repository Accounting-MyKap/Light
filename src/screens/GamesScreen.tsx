import { useTranslation } from 'react-i18next';

export function GamesScreen() {
  const { t } = useTranslation();
  return <h1>{t('nav.games')}</h1>;
}
