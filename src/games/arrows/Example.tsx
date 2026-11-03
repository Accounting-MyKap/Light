import { useTranslation } from 'react-i18next';
import { ArrowRow } from './ArrowRow';
import styles from './arrows.module.css';

export function ArrowsExample() {
  const { t } = useTranslation();
  return (
    <>
      <ArrowRow trial={{ direction: 'left', congruent: false }} className={styles.demo} />
      <p>{t('games.arrows.exampleAnswer')}</p>
    </>
  );
}
