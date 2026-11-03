import { useTranslation } from 'react-i18next';
import type { GameDefinition } from '../../games/types';
import { IntroHeader } from './IntroHeader';
import styles from './Play.module.css';

/** After the practice: «¡Listo!», the rules in one line and the way into the real game. */
export function PracticeDone({
  game,
  onStart,
  onExit,
}: {
  game: GameDefinition;
  onStart: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.screen}>
      <IntroHeader area={game.area} onExit={onExit} />
      <h1 className={styles.introTitle}>{t('practice.doneTitle')}</h1>
      <p className={styles.description}>{t(`games.${game.id}.practice.recap`)}</p>
      <div className={styles.introActions}>
        <button className={styles.primary} onClick={onStart}>
          {t('common.start')}
        </button>
      </div>
    </section>
  );
}
