import { useTranslation } from 'react-i18next';
import type { GameDefinition } from '../../games/types';
import { IntroHeader } from './IntroHeader';
import styles from './Play.module.css';

/** First visit to a game: an invitation to practice without a clock, or to skip it and play. */
export function PracticeIntro({
  game,
  onStart,
  onSkip,
  onExit,
}: {
  game: GameDefinition;
  onStart: () => void;
  onSkip: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.screen}>
      <IntroHeader area={game.area} onExit={onExit} />
      <h1 className={styles.introTitle}>{t(`games.${game.id}.title`)}</h1>
      <p className={styles.description}>{t('practice.intro')}</p>
      <div className={styles.introActions}>
        <button className={styles.primary} onClick={onStart}>
          {t('practice.start')}
        </button>
        <button className={styles.secondary} onClick={onSkip}>
          {t('practice.skip')}
        </button>
      </div>
    </section>
  );
}
