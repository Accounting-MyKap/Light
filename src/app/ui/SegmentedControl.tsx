import styles from './controls.module.css';

interface SegmentedControlProps<T extends string> {
  name: string;
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ name, legend, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <fieldset className={styles.segmented}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.segTrack}>
        {options.map((option) => (
          <label key={option.value} className={styles.segOption}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={styles.segInput}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
