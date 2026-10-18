import { useTranslation } from 'react-i18next';
import styles from './quick-math.module.css';

interface KeypadProps {
  onDigit: (digit: number) => void;
  onDelete: () => void;
  onSubmit: () => void;
}

export function Keypad({ onDigit, onDelete, onSubmit }: KeypadProps) {
  const { t } = useTranslation();
  const digit = (d: number) => (
    <button key={d} type="button" className={styles.key} onClick={() => onDigit(d)}>
      {d}
    </button>
  );
  return (
    <div className={styles.keypad}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit)}
      <button type="button" className={styles.key} onClick={onDelete} aria-label={t('games.quick-math.delete')}>
        ⌫
      </button>
      {digit(0)}
      <button type="button" className={`${styles.key} ${styles.ok}`} onClick={onSubmit}>
        {t('games.quick-math.ok')}
      </button>
    </div>
  );
}
