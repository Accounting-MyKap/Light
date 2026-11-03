import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../../core/motion';
import { CardView, RuleIcon } from './Card';
import styles from './rule-switch.module.css';

/** How long each rule stays on the banner in the instructions before it turns over to the other one. */
export const DEMO_RULE_MS = 3200;

export function RuleSwitchExample() {
  const { t } = useTranslation();
  // Every step turns the banner over to the other rule, and the answer follows it. With reduced motion (or when
  // the browser cannot tell) nothing turns: the first rule stays.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setStep((current) => current + 1), DEMO_RULE_MS);
    return () => window.clearInterval(timer);
  }, []);
  const rule = step % 2 === 0 ? 'color' : 'shape';

  return (
    <>
      {/* Re-mounted at each step, so the turn plays again; the first one has nothing to turn from. */}
      <div key={step} className={`${styles.banner} ${step > 0 ? styles.switched : ''}`} data-rule={rule}>
        <RuleIcon rule={rule} />
        {t(`games.rule-switch.rule.${rule}`)}
      </div>
      <div className={styles.exampleRow}>
        <CardView card={{ shape: 'circle', color: 'blue' }} className={styles.stimulus} />
        <span aria-hidden="true">→</span>
        <CardView
          card={{ shape: 'square', color: 'blue' }}
          className={rule === 'color' ? styles.chosen : undefined}
        />
        <CardView
          card={{ shape: 'circle', color: 'orange' }}
          className={rule === 'shape' ? styles.chosen : undefined}
        />
      </div>
      <p>{t(rule === 'color' ? 'games.rule-switch.exampleAnswer' : 'games.rule-switch.exampleAnswerShape')}</p>
    </>
  );
}
