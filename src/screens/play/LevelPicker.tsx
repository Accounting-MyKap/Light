import { useTranslation } from 'react-i18next';
import styles from './Play.module.css';

/**
 * The levels a game can start at: from 1 to the highest one already reached. The suggested level (the one the app
 * keeps adapting) is marked; any other is for practice and leaves the suggested one as it is.
 */
export function LevelPicker({
  highest,
  chosen,
  suggested,
  note,
  onChoose,
}: {
  highest: number;
  chosen: number;
  suggested: number;
  /** What the chosen level brings, for games where levels differ visibly. */
  note?: string;
  onChoose: (level: number) => void;
}) {
  const { t } = useTranslation();
  const levels = Array.from({ length: highest }, (_, i) => i + 1);
  return (
    <div className={styles.levels}>
      <div role="group" aria-labelledby="level-choice" className={styles.levelOptions}>
        <h2 id="level-choice" className={styles.levelTitle}>
          {t('play.levelChoice')}
        </h2>
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            className={styles.levelOption}
            aria-pressed={level === chosen}
            aria-label={t(level === suggested ? 'play.levelSuggested' : 'play.levelOption', { n: level })}
            data-suggested={level === suggested ? 'true' : undefined}
            onClick={() => onChoose(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <p className={styles.levelNote} aria-live="polite">
        {t('play.levelOption', { n: chosen })}
        {note ? ` · ${note}` : ''}
        {chosen === suggested ? ` · ${t('play.levelSuggestedMark')}` : ''}
      </p>
      {chosen !== suggested && <p className={styles.levelNote}>{t('play.practiceNote', { n: suggested })}</p>}
    </div>
  );
}
