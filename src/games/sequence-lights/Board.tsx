import { useTranslation } from 'react-i18next';
import styles from './sequence-lights.module.css';

export interface BoardProps {
  size: number;
  lit: ReadonlySet<number>;
  marks?: Readonly<Record<number, string>>;
  onPress?: (cell: number) => void;
  small?: boolean;
}

export function Board({ size, lit, marks = {}, onPress, small = false }: BoardProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`${styles.board} ${small ? styles.small : ''}`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size * size }, (_, cell) => (
        <button
          key={cell}
          type="button"
          className={styles.cell}
          data-lit={lit.has(cell)}
          aria-label={t('games.sequence-lights.cell', { n: cell + 1 })}
          tabIndex={onPress ? 0 : -1}
          onClick={onPress ? () => onPress(cell) : undefined}
        >
          {marks[cell] ?? ''}
        </button>
      ))}
    </div>
  );
}
