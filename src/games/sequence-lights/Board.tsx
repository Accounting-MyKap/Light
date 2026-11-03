import { useTranslation } from 'react-i18next';
import styles from './sequence-lights.module.css';

export interface BoardProps {
  size: number;
  lit: ReadonlySet<number>;
  onPress: (cell: number) => void;
}

export function Board({ size, lit, onPress }: BoardProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.board}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: size * size }, (_, cell) => (
        <button
          key={cell}
          type="button"
          className={styles.cell}
          data-lit={lit.has(cell)}
          aria-label={t('games.sequence-lights.cell', { n: cell + 1 })}
          onClick={() => onPress(cell)}
        />
      ))}
    </div>
  );
}
