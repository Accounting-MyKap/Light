import { useTranslation } from 'react-i18next';
import { CardView, RuleIcon } from './Card';
import styles from './rule-switch.module.css';

export function RuleSwitchExample() {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.banner}>
        <RuleIcon rule="color" />
        {t('games.rule-switch.rule.color')}
      </div>
      <div className={styles.exampleRow}>
        <CardView card={{ shape: 'circle', color: 'blue' }} />
        <span aria-hidden="true">→</span>
        <CardView card={{ shape: 'square', color: 'blue' }} className={styles.chosen} />
        <CardView card={{ shape: 'circle', color: 'orange' }} />
      </div>
      <p>{t('games.rule-switch.exampleAnswer')}</p>
    </>
  );
}
