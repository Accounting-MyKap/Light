import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Flash, useReactionSignal } from '../reaction';
import styles from './PracticeFrame.module.css';

export interface PracticeFrameProps {
  /** The current round, starting at 1. */
  round: number;
  total: number;
  /** The guide's message. */
  message: ReactNode;
  /** The game's title, for the page heading screen readers land on. */
  title: string;
  /** `normal` for the prompt, `ok` for a right answer, `hint` while a hint is the message. */
  tone?: 'normal' | 'ok' | 'hint';
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
  title,
  tone = 'normal',
  onSkip,
  controls,
  children,
}: PracticeFrameProps) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const signal = useReactionSignal(stageRef);
  const frameRef = useRef<HTMLDivElement>(null);
  // The live region is mounted empty and filled after the first paint: a region that arrives with its text is
  // usually not announced.
  const [live, setLive] = useState(false);
  useEffect(() => {
    // Deliberate: the second render is what makes the region announce its first message.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(true);
    const frame = frameRef.current;
    if (frame && !frame.contains(document.activeElement)) frame.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={frameRef} tabIndex={-1} className={styles.frame}>
      <h1 className="visually-hidden">{title}</h1>
      <div className={styles.top}>
        <p className={styles.progress}>{t('practice.progress', { n: round, total })}</p>
        <button type="button" className={styles.skip} onClick={onSkip}>
          {t('practice.skip')}
        </button>
      </div>

      <div className={styles.bubble} aria-live="polite" data-tone={tone}>
        {live ? message : null}
      </div>

      <div ref={stageRef} className={styles.stage} data-zone="stage">
        {/* Its own key scope, apart from the flash: a keyed scene can never clash with the flash's key. */}
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
