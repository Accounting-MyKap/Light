import type {
  ChoiceQuestion,
  Difficulty,
  Question,
  QuizCategory,
  TrueFalseQuestion,
} from '../quiz/types';

/** Pregunta de opción múltiple válida. Correcta primero: «Correcta <id>». */
export function makeChoice(
  id: string,
  category: QuizCategory,
  difficulty: Difficulty,
  extra: Partial<ChoiceQuestion> = {},
): ChoiceQuestion {
  return {
    id,
    category,
    difficulty,
    type: 'choice',
    es: {
      question: `Pregunta ${id}`,
      options: [`Correcta ${id}`, `Incorrecta A ${id}`, `Incorrecta B ${id}`, `Incorrecta C ${id}`],
      explanation: `Explicación ${id}`,
    },
    en: {
      question: `Question ${id}`,
      options: [`Correct ${id}`, `Incorrect A ${id}`, `Incorrect B ${id}`, `Incorrect C ${id}`],
      explanation: `Explanation ${id}`,
    },
    ...extra,
  };
}

/** Pregunta de verdadero/falso válida. */
export function makeTrueFalse(
  id: string,
  category: QuizCategory,
  difficulty: Difficulty,
  answer: boolean,
): TrueFalseQuestion {
  return {
    id,
    category,
    difficulty,
    type: 'truefalse',
    answer,
    es: { question: `Afirmación ${id}`, explanation: `Explicación ${id}` },
    en: { question: `Statement ${id}`, explanation: `Explanation ${id}` },
  };
}

/** Banco de opción múltiple con ids `<category>-0001…`, primero las fáciles y al final las difíciles. */
export function makePool(category: QuizCategory, counts: Record<Difficulty, number>): Question[] {
  const pool: Question[] = [];
  for (const difficulty of [1, 2, 3] as const) {
    for (let i = 0; i < counts[difficulty]; i++) {
      const id = `${category}-${String(pool.length + 1).padStart(4, '0')}`;
      pool.push(makeChoice(id, category, difficulty));
    }
  }
  return pool;
}

/** El formato de archivo: `{ category, questions }`, sin `category` en cada pregunta. */
export function rawBank(category: QuizCategory, questions: Question[]): unknown {
  return {
    category,
    questions: questions.map((q) => {
      const copy: Partial<Question> = { ...q };
      delete copy.category;
      return copy;
    }),
  };
}
