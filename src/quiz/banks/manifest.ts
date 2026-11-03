import type { QuizCategory } from '../types';

/**
 * Cuántas preguntas tiene cada banco. La pantalla Preguntas lo usa para mostrar «Vistas: N de M»
 * sin cargar los bancos. Se actualiza a mano al agregar preguntas (docs/quiz/guia-de-contenido.md,
 * sección 9); `banks.test.ts` comprueba que coincida con los archivos.
 */
export const BANK_SIZES: Record<QuizCategory, number> = {
  history: 100,
  science: 100,
  geography: 100,
  math: 100,
  arts: 100,
  entertainment: 100,
  sports: 100,
  technology: 48,
  concepts: 100,
  colombia: 100,
  us: 100,
  lending: 100,
};
