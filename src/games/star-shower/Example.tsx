import { useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { Sparkle } from './Sky';
import styles from './star-shower.module.css';

export function StarShowerExample() {
  // A looping mini sky made only of CSS: two stars fall, 12 pops the first, a comet falls and bursts everything.
  // With reduced motion (or when the browser cannot tell) nothing moves: the three are drawn at rest.
  const [animated] = useState(() => !prefersReducedMotion());
  return (
    <div className={`${styles.sky} ${styles.demo}`} data-animated={animated} aria-hidden="true">
      <div className={styles.scene}>
        <div className={styles.field}>
          <div className={styles.dots} />
          <div className={`${styles.star} ${styles.demoPop}`} data-comet="false" data-lane="0">
            7 + 5
          </div>
          <div className={`${styles.star} ${styles.demoLate}`} data-comet="false" data-lane="2">
            4 + 3
          </div>
          <div className={`${styles.star} ${styles.demoComet}`} data-comet="true" data-lane="1">
            <Sparkle />
            6 + 2
          </div>
        </div>
        <div className={styles.horizon} />
      </div>
      <div className={styles.slot}>
        <span className={`${styles.answer} ${styles.demoAnswer}`} data-empty="false">
          12
        </span>
      </div>
    </div>
  );
}
