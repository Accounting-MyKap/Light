import { MAX_TRUE_FALSE_SHARE, QUIZ_TEXT_LIMITS } from './types';
import type { QuizCategory } from './types';

const MIN_QUESTIONS = 10;
const DIFFICULTIES = [1, 2, 3] as const;
const LANGS = ['es', 'en'] as const;
const OPTIONS_PER_CHOICE = 4;

/** «Todas/ninguna de las anteriores» y su versión en inglés. */
const FORBIDDEN_OPTION = /\b(todas|ninguna)( de)? las anteriores\b|\b(all|none) of the above\b/i;
const AS_OF = /^\d{4}-(0[1-9]|1[0-2])$/;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Descripción corta y segura (nunca lanza) de un valor para los mensajes de error. */
function show(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : typeof value;
}

/** Errores de un texto suelto: vacío, con espacios en los bordes o demasiado largo. */
function textErrors(text: unknown, label: string, max: number): string[] {
  if (typeof text !== 'string') return [`${label} must be a string, got ${show(text)}`];
  if (text.trim() === '') return [`${label} is empty`];
  const errors: string[] = [];
  if (text !== text.trim()) errors.push(`${label} has leading or trailing whitespace`);
  if (text.length > max) errors.push(`${label} is ${text.length} characters, the limit is ${max}`);
  return errors;
}

function optionErrors(options: unknown, label: string): string[] {
  if (!Array.isArray(options) || options.length !== OPTIONS_PER_CHOICE) {
    return [`${label} must be an array of ${OPTIONS_PER_CHOICE} strings`];
  }
  const errors = options.flatMap((option, i) => textErrors(option, `${label}[${i}]`, QUIZ_TEXT_LIMITS.option));
  const strings = options.filter((o): o is string => typeof o === 'string');
  if (new Set(strings.map((o) => o.trim().toLocaleLowerCase())).size < strings.length) {
    errors.push(`${label} must be ${OPTIONS_PER_CHOICE} distinct options (ignoring case and spaces)`);
  }
  for (const [i, option] of options.entries()) {
    if (typeof option === 'string' && FORBIDDEN_OPTION.test(option)) {
      errors.push(`${label}[${i}] uses "all/none of the above", which is not allowed`);
    }
  }
  return errors;
}

function languageErrors(q: Json, lang: (typeof LANGS)[number]): string[] {
  const texts = q[lang];
  if (!isRecord(texts)) return [`${lang} must be an object`];
  const errors = [
    ...textErrors(texts.question, `${lang}.question`, QUIZ_TEXT_LIMITS.question),
    ...textErrors(texts.explanation, `${lang}.explanation`, QUIZ_TEXT_LIMITS.explanation),
  ];
  if (q.type === 'choice') errors.push(...optionErrors(texts.options, `${lang}.options`));
  else if (q.type === 'truefalse' && 'options' in texts) errors.push(`${lang}.options is not allowed in true/false questions`);
  return errors;
}

function questionErrors(q: Json, fileCategory: QuizCategory): string[] {
  const errors: string[] = [];
  if (!(typeof q.id === 'string' && new RegExp(`^${fileCategory}-\\d{4}$`).test(q.id))) {
    errors.push(`id must look like ${fileCategory}-NNNN, got ${show(q.id)}`);
  }
  if (!DIFFICULTIES.some((d) => d === q.difficulty)) errors.push(`difficulty must be 1, 2 or 3, got ${show(q.difficulty)}`);
  if (q.type !== 'choice' && q.type !== 'truefalse') {
    errors.push(`type must be "choice" or "truefalse", got ${show(q.type)}`);
  } else if (q.type === 'truefalse' && typeof q.answer !== 'boolean') {
    errors.push(`answer must be true or false, got ${show(q.answer)}`);
  }
  if (q.asOf !== undefined && !(typeof q.asOf === 'string' && AS_OF.test(q.asOf))) {
    errors.push(`asOf must be YYYY-MM, got ${show(q.asOf)}`);
  }
  for (const lang of LANGS) errors.push(...languageErrors(q, lang));
  return errors;
}

/**
 * Valida el contenido de un archivo de banco (`src/quiz/banks/<categoría>.json`).
 * Devuelve la lista de errores, vacía si es válido. Cada error empieza con el id de la
 * pregunta (o `questions[i]` si no tiene id) o con `bank:` si es del archivo completo.
 * Nunca lanza, aunque `raw` no tenga la forma esperada.
 */
export function validateBank(raw: unknown, fileCategory: QuizCategory): string[] {
  if (!isRecord(raw)) return [`bank: the file must contain a JSON object, got ${show(raw)}`];

  const errors: string[] = [];
  if (raw.category !== fileCategory) {
    errors.push(`bank: category is ${show(raw.category)} but the file is for "${fileCategory}"`);
  }
  if (!Array.isArray(raw.questions)) {
    errors.push('bank: "questions" must be an array');
    return errors;
  }

  const seen = new Set<string>();
  const perDifficulty = new Map<unknown, number>();
  let trueFalse = 0;

  for (const [i, q] of raw.questions.entries()) {
    if (!isRecord(q)) {
      errors.push(`questions[${i}]: must be an object, got ${show(q)}`);
      continue;
    }
    const name = typeof q.id === 'string' ? q.id : `questions[${i}]`;
    const own = questionErrors(q, fileCategory);
    if (typeof q.id === 'string') {
      if (seen.has(q.id)) own.push('duplicate id in this file');
      seen.add(q.id);
    }
    errors.push(...own.map((e) => `${name}: ${e}`));

    perDifficulty.set(q.difficulty, (perDifficulty.get(q.difficulty) ?? 0) + 1);
    if (q.type === 'truefalse') trueFalse++;
  }

  const total = raw.questions.length;
  if (total < MIN_QUESTIONS) errors.push(`bank: needs at least ${MIN_QUESTIONS} questions, found ${total}`);
  for (const d of DIFFICULTIES) {
    if (!perDifficulty.has(d)) errors.push(`bank: no questions with difficulty ${d}`);
  }
  if (total > 0 && trueFalse / total > MAX_TRUE_FALSE_SHARE) {
    errors.push(
      `bank: ${trueFalse} of ${total} questions are true/false, the limit is ${MAX_TRUE_FALSE_SHARE * 100} %`,
    );
  }
  return errors;
}
