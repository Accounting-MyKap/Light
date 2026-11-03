import styles from './controls.module.css';

interface SwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function Switch({ id, label, checked, onChange, hint }: SwitchProps) {
  return (
    <div className={styles.switchRow}>
      <label htmlFor={id} className={styles.switchLabel}>
        <span>{label}</span>
        <span className={styles.trackWrap}>
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={hint ? `${id}-hint` : undefined}
            className={styles.switchInput}
          />
          <span className={styles.track} aria-hidden="true" />
        </span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
