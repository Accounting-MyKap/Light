import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { asOfLabel } from '../../quiz/asOf';
import { correctIndex, optionTexts, type QuizRoundItem } from '../../quiz/types';
import { keepNumbersTogether } from '../../quiz/typography';
import type { GameResult } from '../types';
import styles from './quiz.module.css';

/** «Repasa tus errores»: every question the player missed, left blank or skipped with «No sé». */
export function QuizReview({ result }: { result: GameResult }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  if (!result.quiz) return null;

  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const labels = { true: t('quiz.true'), false: t('quiz.false') };
  const missed = result.quiz.items.filter((item) => item.outcome !== 'correct');

  /** What the player answered, in the language shown: the option text, «No sé», or nothing at all. */
  const yourAnswer = ({ question, outcome, chosen }: QuizRoundItem): string => {
    if (outcome === 'skipped') return t('quiz.review.yourAnswer', { answer: t('quiz.dontKnow') });
    const picked = chosen === null ? undefined : optionTexts(question, lang, labels)[chosen];
    if (picked === undefined) return t('quiz.review.noAnswer');
    return t('quiz.review.yourAnswer', { answer: keepNumbersTogether(picked) });
  };

  return (
    <section className={styles.review} aria-labelledby={headingId}>
      <h2 id={headingId}>{t('quiz.review.title')}</h2>
      {missed.length === 0 ? (
        <p className={styles.reviewNone}>{t('quiz.review.none')}</p>
      ) : (
        <div className={styles.reviewList}>
          {missed.map((item) => {
            const { question } = item;
            const date = question.asOf ? asOfLabel(question.asOf, lang) : null;
            return (
              <article key={question.id} className={styles.reviewItem}>
                <h3 className={styles.reviewPrompt}>{keepNumbersTogether(question[lang].question)}</h3>
                <p className={styles.reviewWrong}>{yourAnswer(item)}</p>
                <p className={styles.reviewRight}>
                  {t('quiz.review.correctAnswer', {
                    answer: keepNumbersTogether(optionTexts(question, lang, labels)[correctIndex(question)]),
                  })}
                </p>
                <p>{keepNumbersTogether(question[lang].explanation)}</p>
                {date && <p className={styles.asOf}>{t('quiz.asOf', { date })}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
