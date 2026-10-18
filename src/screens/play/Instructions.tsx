import { useTranslation } from 'react-i18next';
import type { GameDefinition } from '../../games/types';
import styles from './Play.module.css';

export function Instructions({ game, onStart }: { game: GameDefinition; onStart: () => void }) {
  const { t } = useTranslation();
  const steps = t(`games.${game.id}.instructions`, { returnObjects: true }) as string[];
  const { Example } = game;
  return (
    <section className={styles.screen}>
      <h1>{t(`games.${game.id}.title`)}</h1>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <figure className={`${styles.card} ${styles.example}`}>
        <Example />
        <figcaption>{t('play.example')}</figcaption>
      </figure>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={onStart}>
          {t('common.start')}
        </button>
      </div>
    </section>
  );
}
