import styles from './quick-math.module.css';

export function QuickMathExample() {
  return (
    <div className={styles.display}>
      <span>7 + 5</span>
      <span aria-hidden="true">=</span>
      <span className={styles.answer}>12</span>
    </div>
  );
}
