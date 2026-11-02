import type { QuizCategory } from '../types';

/**
 * Cuántas preguntas tiene cada banco. La pantalla Preguntas lo usa para mostrar «Vistas: N de M»
 * sin cargar los bancos. Se actualiza a mano al agregar preguntas (docs/quiz/guia-de-contenido.md,
 * sección 9); `banks.test.ts` comprueba que coincida con los archivos.
 */
export const BANK_SIZES: Record<QuizCategory, number> = {
  history: 12,
  science: 12,
  geography: 12,
  math: 12,
  arts: 12,
  entertainment: 12,
  sports: 12,
  technology: 12,
  concepts: 100,
  colombia: 100,
  us: 100,
  lending: 12,
};
