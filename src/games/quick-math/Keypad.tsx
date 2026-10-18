import { useTranslation } from 'react-i18next';
import styles from './quick-math.module.css';

// Pointer clicks should not move keyboard focus onto keypad buttons (Enter must keep submitting).
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

interface KeypadProps {
  onDigit: (digit: number) => unknown;
  onDelete: () => unknown;
  onSubmit: () => unknown;
}

export function Keypad({ onDigit, onDelete, onSubmit }: KeypadProps) {
  const { t } = useTranslation();
  const digit = (d: number) => (
    <button key={d} type="button" className={styles.key} onMouseDown={keepFocus} onClick={() => onDigit(d)}>
      {d}
    </button>
  );
  return (
    <div className={styles.keypad}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit)}
      <button type="button" className={styles.key} onMouseDown={keepFocus} onClick={onDelete} aria-label={t('games.quick-math.delete')}>
        ⌫
      </button>
      {digit(0)}
      <button type="button" className={`${styles.key} ${styles.ok}`} onMouseDown={keepFocus} onClick={onSubmit}>
        {t('games.quick-math.ok')}
      </button>
    </div>
  );
}
