import { useTranslation } from 'react-i18next';
import type { ChoiceQuestion, ChoiceTexts } from '../../quiz/types';
import { QuestionView } from './QuestionView';

/** A solved sample question for the instructions: static, so it has no handlers. */
export function QuizExample() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('es') ? 'es' : 'en';

  const raw: unknown = t('quiz.example.options', { returnObjects: true });
  const list = Array.isArray(raw) ? raw.map(String) : [];
  const texts: ChoiceTexts = {
    question: t('quiz.example.question'),
    options: [list[0] ?? '', list[1] ?? '', list[2] ?? '', list[3] ?? ''],
    explanation: t('quiz.example.explanation'),
  };
  // The texts already come in the current language, so both language slots hold them.
  const question: ChoiceQuestion = {
    id: 'example',
    category: 'science',
    difficulty: 1,
    type: 'choice',
    es: texts,
    en: texts,
  };

  return <QuestionView question={question} order={[0, 1, 2, 3]} lang={lang} phase="feedback" outcome="correct" chosen={0} />;
}
