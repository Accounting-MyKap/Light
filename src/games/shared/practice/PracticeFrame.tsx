import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Flash, useReactionSignal } from '../reaction';
import styles from './PracticeFrame.module.css';

export interface PracticeFrameProps {
  /** The current round, starting at 1. */
  round: number;
  total: number;
  /** The guide's message. */
  message: ReactNode;
  tone?: 'hint' | 'ok';
  onSkip: () => void;
  /** Bottom zone: the answer buttons. */
  controls?: ReactNode;
  /** The practice scene. */
  children: ReactNode;
}

/** The frame of every guided practice: progress and skip, the guide's bubble, the scene and the controls. */
export function PracticeFrame({
  round,
  total,
  message,
  tone = 'hint',
  onSkip,
  controls,
  children,
}: PracticeFrameProps) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const signal = useReactionSignal(stageRef);

  return (
    <div className={styles.frame}>
      <div className={styles.top}>
        <p className={styles.progress}>{t('practice.progress', { n: round, total })}</p>
        <button type="button" className={styles.skip} onClick={onSkip}>
          {t('practice.skip')}
        </button>
      </div>

      <div className={styles.bubble} aria-live="polite" data-tone={tone}>
        {message}
      </div>

      <div ref={stageRef} className={styles.stage} data-zone="stage">
        <>{children}</>
        <Flash signal={signal} />
      </div>

      {controls && (
        <div className={styles.controls} data-zone="controls">
          {controls}
        </div>
      )}
    </div>
  );
}
