import { useTranslation } from 'react-i18next';
import { SymbolGlyph } from './symbols';
import styles from './same-different.module.css';

export function SameDifferentExample() {
  const { t } = useTranslation();
  const label = t('games.same-different.symbols.star');
  return (
    <>
      <div className={styles.exampleRow}>
        <div className={styles.card}>
          <SymbolGlyph id="star" label={label} className={styles.symbol} />
        </div>
        <span aria-hidden="true">→</span>
        <div className={styles.card}>
          <SymbolGlyph id="star" label={label} className={styles.symbol} />
        </div>
      </div>
      <p>{t('games.same-different.exampleAnswer')}</p>
    </>
  );
}
