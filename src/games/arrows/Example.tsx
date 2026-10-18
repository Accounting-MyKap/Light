import { useTranslation } from 'react-i18next';
import { ArrowRow } from './ArrowRow';

export function ArrowsExample() {
  const { t } = useTranslation();
  return (
    <>
      <ArrowRow trial={{ direction: 'left', congruent: false }} />
      <p>{t('games.arrows.exampleAnswer')}</p>
    </>
  );
}
