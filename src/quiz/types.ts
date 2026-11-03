export type QuizBank = 'trivia' | 'accounting';

export const TRIVIA_CATEGORIES = [
  'history',
  'science',
  'geography',
  'math',
  'arts',
  'entertainment',
  'sports',
  'technology',
] as const;

export const ACCOUNTING_CATEGORIES = ['concepts', 'colombia', 'us', 'lending'] as const;

export type QuizCategory = (typeof TRIVIA_CATEGORIES)[number] | (typeof ACCOUNTING_CATEGORIES)[number];

export const CATEGORIES_BY_BANK: Record<QuizBank, readonly QuizCategory[]> = {
  trivia: TRIVIA_CATEGORIES,
  accounting: ACCOUNTING_CATEGORIES,
};

/** Las 12 categorías, en el orden de arriba. */
export const ALL_CATEGORIES: readonly QuizCategory[] = [...TRIVIA_CATEGORIES, ...ACCOUNTING_CATEGORIES];

export type Difficulty = 1 | 2 | 3;

export interface ChoiceTexts {
  question: string;
  options: [string, string, string, string];
  explanation: string;
}

export interface TrueFalseTexts {
  question: string;
  explanation: string;
}

interface QuestionBase {
  id: string;
  category: QuizCategory;
  difficulty: Difficulty;
  /**
   * `YYYY-MM`: mes en que se verificó la norma; la app lo muestra como «Vigente a …». Solo para normas que pueden
   * cambiar.
   */
  asOf?: string;
}

/** En las de opción múltiple la respuesta correcta va siempre primero en `options`. */
export type ChoiceQuestion = QuestionBase & { type: 'choice'; es: ChoiceTexts; en: ChoiceTexts };
export type TrueFalseQuestion = QuestionBase & {
  type: 'truefalse';
  answer: boolean;
  es: TrueFalseTexts;
  en: TrueFalseTexts;
};
export type Question = ChoiceQuestion | TrueFalseQuestion;

export type AnswerOutcome = 'correct' | 'wrong' | 'skipped' | 'timeout';

/** `chosen`: índice canónico (choice: 0 = correcta; truefalse: 0 = Verdadero, 1 = Falso), null si no respondió. */
export interface QuizRoundItem {
  question: Question;
  outcome: AnswerOutcome;
  chosen: number | null;
}

export interface QuizRoundDetails {
  items: QuizRoundItem[];
}

export interface QuizConfig {
  bank: QuizBank;
  categories: readonly QuizCategory[];
}

/** Largos máximos, en caracteres, en ambos idiomas. */
export const QUIZ_TEXT_LIMITS = { question: 160, option: 60, explanation: 220 } as const;

/** Proporción máxima de preguntas de verdadero/falso por categoría. */
export const MAX_TRUE_FALSE_SHARE = 0.25;

/** Índice canónico de la respuesta correcta: choice → 0; truefalse → 0 (Verdadero) o 1 (Falso). */
export function correctIndex(q: Question): number {
  return q.type === 'choice' ? 0 : q.answer ? 0 : 1;
}

/** Textos de las opciones en orden canónico (correcta primero; verdadero/falso: Verdadero, Falso). */
export function optionTexts(
  q: Question,
  lang: 'es' | 'en',
  labels: { true: string; false: string },
): string[] {
  if (q.type === 'truefalse') return [labels.true, labels.false];
  return [...q[lang].options];
}
