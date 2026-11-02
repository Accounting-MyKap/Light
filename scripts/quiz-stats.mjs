// Resumen de los bancos de preguntas: una línea por categoría con el total, el reparto por
// dificultad y la cantidad de verdadero/falso. Uso: `npm run quiz:stats`. Sin dependencias.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const banksDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'quiz', 'banks');

// El orden de src/quiz/types.ts (ALL_CATEGORIES). Si hay un archivo que no está aquí, va al final.
const CATEGORY_ORDER = [
  'history', 'science', 'geography', 'math', 'arts', 'entertainment', 'sports', 'technology',
  'concepts', 'colombia', 'us', 'lending',
];

const rank = (category) => {
  const i = CATEGORY_ORDER.indexOf(category);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

const categories = readdirSync(banksDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

for (const category of categories) {
  const { questions } = JSON.parse(readFileSync(join(banksDir, `${category}.json`), 'utf8'));
  const byDifficulty = (d) => questions.filter((q) => q.difficulty === d).length;
  const trueFalse = questions.filter((q) => q.type === 'truefalse').length;
  console.log(
    `${category}  total ${questions.length}  fácil ${byDifficulty(1)}  media ${byDifficulty(2)}  difícil ${byDifficulty(3)}  v/f ${trueFalse}`,
  );
}
