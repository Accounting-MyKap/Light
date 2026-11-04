import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './switchyard.module.css';

/** How long «¡Más rápido!» stays over the board. */
export const FASTER_SHOW_MS = 1200;

/**
 * «¡Más rápido! · Nivel N» over the board for a moment each time the level goes up during the game: never at the
 * start, never when it goes down. Its live region is there from the start, so a screen reader says each toast,
 * politely; it takes no taps, so the switches under it still answer.
 */
export function FasterToast({ level }: { level: number }) {
  const { t } = useTranslation();
  // The level last seen and the toast showing, adjusted while rendering so the toast comes with the new level.
  const [seen, setSeen] = useState(level);
  const [shown, setShown] = useState<{ level: number; id: number } | null>(null);
  if (level !== seen) {
    setSeen(level);
    if (level > seen) setShown({ level, id: (shown?.id ?? 0) + 1 });
  }

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), FASTER_SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div className={styles.fasterSlot} role="status">
      {shown && (
        // Keyed, so a new level up starts the animation over.
        <p
          key={shown.id}
          className={styles.faster}
          style={{ '--faster-ms': `${FASTER_SHOW_MS}ms` } as CSSProperties}
        >
          {t('games.switchyard.faster', { level: shown.level })}
        </p>
      )}
    </div>
  );
}
