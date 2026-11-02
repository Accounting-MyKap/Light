import { pick, type Rng } from '../../core/rng';
import type { Difficulty, Question, QuizCategory } from '../../quiz/types';

/** Cuántas de las preguntas respondidas hace más tiempo compiten cuando ya se vieron todas. */
export const OLDEST_SEEN_CHOICES = 10;

const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3];

/** Probabilidad de cada dificultad según el nivel de la escalera (spec §2). */
export function difficultyWeights(level: number): Record<Difficulty, number> {
  if (level <= 3) return { 1: 0.7, 2: 0.3, 3: 0 };
  if (level <= 7) return { 1: 0.2, 2: 0.6, 3: 0.2 };
  return { 1: 0, 2: 0.4, 3: 0.6 };
}

export interface PickInput {
  pool: readonly Question[];
  /** questionId → última vez respondida (ms). */
  history: ReadonlyMap<string, number>;
  /** Ya usadas en esta ronda. */
  usedIds: ReadonlySet<string>;
  /** Categorías de esta ronda, en orden. */
  askedCategories: readonly QuizCategory[];
  level: number;
  rng: Rng;
}

/** Sortea contra los pesos acumulados en el orden 1, 2, 3; una dificultad de peso 0 nunca sale. */
function drawDifficulty(level: number, rng: Rng): Difficulty {
  const weights = difficultyWeights(level);
  const r = rng();
  let cumulative = 0;
  let last: Difficulty = 1;
  for (const d of DIFFICULTIES) {
    if (weights[d] <= 0) continue;
    cumulative += weights[d];
    last = d;
    if (r < cumulative) return d;
  }
  return last; // r cayó en el error de redondeo del último acumulado
}

/** Las dificultades de la más cercana a `d` a la más lejana: d, d−1, d+1, d−2, d+2 (la menor primero). */
function nearestFirst(d: Difficulty): Difficulty[] {
  const order: Difficulty[] = [];
  for (const offset of [0, -1, 1, -2, 2]) {
    const candidate = d + offset;
    if (candidate >= 1 && candidate <= 3) order.push(candidate as Difficulty);
  }
  return order;
}

/**
 * Categoría de la siguiente pregunta: solo entre las que aún tienen preguntas sin usar, sin la de las dos
 * últimas si coinciden (salvo que no quede otra), y al azar entre las menos usadas en la ronda.
 */
function chooseCategory(
  unused: readonly Question[],
  askedCategories: readonly QuizCategory[],
  rng: Rng,
): QuizCategory {
  const available = [...new Set(unused.map((q) => q.category))];
  let eligible = available;
  const n = askedCategories.length;
  if (n >= 2 && askedCategories[n - 1] === askedCategories[n - 2]) {
    const others = available.filter((c) => c !== askedCategories[n - 1]);
    if (others.length > 0) eligible = others;
  }
  const uses = (category: QuizCategory) => askedCategories.filter((c) => c === category).length;
  const fewest = Math.min(...eligible.map(uses));
  return pick(
    rng,
    eligible.filter((c) => uses(c) === fewest),
  );
}

/** Nunca respondida → al azar entre esas; si no, al azar entre las `OLDEST_SEEN_CHOICES` más antiguas. */
function chooseFromCandidates(
  candidates: readonly Question[],
  history: ReadonlyMap<string, number>,
  rng: Rng,
): Question {
  const fresh = candidates.filter((q) => !history.has(q.id));
  if (fresh.length > 0) return pick(rng, fresh);
  const lastSeen = (q: Question) => history.get(q.id) ?? 0;
  const oldest = [...candidates].sort((a, b) => lastSeen(a) - lastSeen(b)).slice(0, OLDEST_SEEN_CHOICES);
  return pick(rng, oldest);
}

/**
 * Elige la siguiente pregunta de la ronda (spec §5.3). Pura: no modifica sus entradas y, con el mismo `rng`
 * sembrado, da siempre lo mismo. `null` solo si ya se usaron todas las preguntas del pool.
 */
export function pickQuestion({
  pool,
  history,
  usedIds,
  askedCategories,
  level,
  rng,
}: PickInput): Question | null {
  const unused = pool.filter((q) => !usedIds.has(q.id));
  if (unused.length === 0) return null;

  const difficulty = drawDifficulty(level, rng);

  // La categoría elegida siempre tiene alguna pregunta sin usar, así que la búsqueda por cercanía de
  // dificultad siempre encuentra candidatas y nunca hace falta pasar a otra categoría.
  const multipleCategories = new Set(pool.map((q) => q.category)).size > 1;
  const category = multipleCategories ? chooseCategory(unused, askedCategories, rng) : null;
  const scope = category === null ? unused : unused.filter((q) => q.category === category);

  const candidates =
    nearestFirst(difficulty)
      .map((d) => scope.filter((q) => q.difficulty === d))
      .find((group) => group.length > 0) ?? scope;

  return chooseFromCandidates(candidates, history, rng);
}
