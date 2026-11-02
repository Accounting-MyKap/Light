import { useTranslation } from 'react-i18next';
import type { GameDefinition } from '../../games/types';
import { AreaLabel } from './AreaLabel';
import styles from './Play.module.css';

export function Instructions({ game, onStart }: { game: GameDefinition; onStart: () => void }) {
  const { t } = useTranslation();
  const steps = t(`games.${game.id}.instructions`, { returnObjects: true }) as string[];
  const { Example } = game;
  return (
    <section className={styles.screen}>
      <AreaLabel area={game.area} />
      <h1 className={styles.introTitle}>{t(`games.${game.id}.title`)}</h1>
      {/* Explicit role: Safari drops the list semantics once the markers are hidden. */}
      <ol className={styles.steps} role="list">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <figure className={styles.example}>
        <Example />
        <figcaption>{t('play.example')}</figcaption>
      </figure>
      <div className={styles.introActions}>
        <button className={styles.primary} onClick={onStart}>
          {t('common.start')}
        </button>
      </div>
    </section>
  );
}
