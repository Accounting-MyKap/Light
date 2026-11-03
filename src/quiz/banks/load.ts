import type { Question, QuizCategory } from '../types';

interface BankFile {
  category: QuizCategory;
  questions: Omit<Question, 'category'>[];
}

/**
 * Sin `eager`: cada banco queda en su propio fragmento y solo se descarga cuando se pide
 * (y el service worker lo guarda de antemano para jugar sin conexión).
 */
const banks = import.meta.glob<BankFile>('./*.json', { import: 'default' });

/** Un banco ya cargado se pide una sola vez; si la carga falla se olvida, para poder reintentar. */
const cache = new Map<QuizCategory, Promise<Question[]>>();

async function readBank(category: QuizCategory): Promise<Question[]> {
  const load = banks[`./${category}.json`];
  if (!load) throw new Error(`There is no question bank for category "${category}"`);
  const bank = await load();
  if (bank.category !== category) {
    throw new Error(`The bank for "${category}" declares category "${bank.category}"`);
  }
  return bank.questions.map((q) => ({ ...q, category }) as Question);
}

function loadBank(category: QuizCategory): Promise<Question[]> {
  let pending = cache.get(category);
  if (!pending) {
    pending = readBank(category);
    cache.set(category, pending);
    pending.catch(() => cache.delete(category));
  }
  return pending;
}

/** Preguntas de las categorías pedidas, con su `category`. Rechaza si falta algún banco. */
export async function loadQuestions(categories: readonly QuizCategory[]): Promise<Question[]> {
  const loaded = await Promise.all(categories.map(loadBank));
  return loaded.flat();
}
