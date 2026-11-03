# Light — Sección «Preguntas» (trivia y contabilidad) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pestaña nueva, «Preguntas», con rondas de 10 preguntas de opción múltiple y de verdadero/falso:
9 opciones de cultura general y 5 de contabilidad, sobre un banco de 1.200 preguntas en ES y EN. Funciona sin
conexión y no cambia en nada el entrenamiento diario.

**Architecture:**
- Las preguntas son datos: un JSON por categoría en `src/quiz/banks/`, validado por pruebas y cargado de forma
  perezosa.
- Un motor puro (`selection.ts` + `engine.ts`) y un componente común forman 14 juegos que se registran en el
  registro existente con el campo opcional `quiz`.
- Así se reutilizan la pantalla de partida, el guardado, la mejor marca, la sincronización y el percentil.
- El plan diario, la pestaña Juegos y las métricas de entrenamiento usan solo `TRAINING_GAMES`.
- Las respuestas pregunta por pregunta viven en una tabla local de Dexie (versión 3) que nunca se sube.

**Tech Stack:** Lo de los Planes 1 y 2 (React 19, TypeScript 6, Vite 8 + vite-plugin-pwa, Dexie 4, i18next,
Vitest, Playwright, Supabase CLI + pgTAP). **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-11-02-light-quiz-design.md`, que amplía
`docs/superpowers/specs/2026-10-18-light-brain-training-design.md`. Antes de cada tarea, lee las secciones de la
spec que cita.

## Global Constraints

- **Ronda:**
  - Hay `QUIZ_ROUND_LENGTH = 10` preguntas con `QUIZ_QUESTION_MS = 20_000` cada una.
  - Acierto: `QUIZ_CORRECT_POINTS = 20` + `speedBonus(rt, 20_000)` (de `src/games/shared/scoring.ts`, 0–10).
  - Error: `QUIZ_WRONG_PENALTY = { choice: 10, truefalse: 30 }`.
  - «No sé» y tiempo agotado: 0 puntos.
  - El puntaje nunca baja de 0 (`addPoints`). `QUIZ_MAX_SCORE = 300` y `QUIZ_REFERENCE_SCORE = 200`.
  - Se ignoran las respuestas con `rt < MIN_RT_MS` (150, `src/games/shared/constants.ts`).
- **Dificultad por nivel:**
  - Niveles 1–3: `{1: 0.7, 2: 0.3, 3: 0}`.
  - Niveles 4–7: `{1: 0.2, 2: 0.6, 3: 0.2}`.
  - Niveles 8–10: `{1: 0, 2: 0.4, 3: 0.6}`.
  - Dentro de la ronda, la escalera existente (`stepStaircase`), donde «No sé» y el tiempo agotado cuentan como
    fallo. Entre partidas, `nextStartLevel` (ya lo aplica `recordGameResult`).
- **Categorías (ids):**
  - trivia: `history`, `science`, `geography`, `math`, `arts`, `entertainment`, `sports`, `technology`;
  - accounting: `concepts`, `colombia`, `us`, `lending`.
- **Juegos (ids):**
  - `trivia-mix`, `trivia-history`, `trivia-science`, `trivia-geography`, `trivia-math`, `trivia-arts`,
    `trivia-entertainment`, `trivia-sports`, `trivia-technology`;
  - `accounting-mix`, `accounting-concepts`, `accounting-colombia`, `accounting-us`, `accounting-lending`.
  - El `area` de cada juego es su bloque (`'trivia'` o `'accounting'`).
- **Formato de una pregunta:** el de spec §3.3.
  - En opción múltiple, la correcta es `options[0]`.
  - Ids `<categoría>-NNNN`; un id borrado nunca se reutiliza.
  - Largos: enunciado ≤ 160, opción ≤ 60 y explicación ≤ 220 caracteres, en ambos idiomas.
  - Verdadero/falso ≤ 25 % por categoría.
- **Contenido al lanzar:** 100 preguntas por categoría (40 fáciles, 40 medias y 20 difíciles). Debe cumplir las
  reglas de calidad de spec §3.2, que quedan en `docs/quiz/guia-de-contenido.md` (Task 1).
- **Repositorio público:** ninguna pregunta ni archivo puede contener procesos internos, nombres de clientes ni
  datos de una empresa.
- **Nada del entrenamiento cambia:**
  - `TRAINING_GAMES` son exactamente los 5 juegos actuales.
  - El plan diario, la pestaña Juegos, el puntaje por área, «Por juego» y los días entrenados solo los usan a
    ellos.
- **Textos:**
  - Todo texto de interfaz nuevo existe en `es.json` y `en.json` (la prueba de paridad sigue vigente).
  - Las preguntas no van en esos archivos.
  - No se hacen afirmaciones de beneficios médicos ni cognitivos (prueba existente).
- **Privacidad:** las respuestas por pregunta (`quizAnswers`) nunca salen del dispositivo. A Supabase solo sube el
  resultado agregado, como cualquier partida.
- **Publicación:**
  - La rama **no se une a `main`** hasta que el equipo contable apruebe las 400 preguntas contables (Task 26).
  - La migración nueva se aplica en el proyecto real de Supabase **antes** de esa unión (README).
- **Idioma del código:** mensajes de commit e identificadores en inglés; documentos y textos de interfaz en
  español (y en inglés donde corresponda).
- **Verificación local:** `npm test`, `npm run lint`, `npm run typecheck`. Con Supabase local: `npm run db:reset &&
  npm run db:test && npm run test:integration`. En este sandbox hay que arrancar Docker con `dockerd &` y exportar
  `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. Para e2e: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run
  e2e`.

## Review Focus

1. **Banco agotado dentro de una ronda** (una categoría con pocas preguntas de la dificultad sorteada, o todas ya
   vistas): la ronda igual reúne 10 preguntas distintas. → Task 3, prueba `fills a round from a pool of exactly 10
   hard questions at level 1`.
2. **Doble toque al pasar de pregunta** (tocar «Siguiente» y, sin querer, una opción de la pregunta nueva antes de
   150 ms): ese toque se ignora y no responde la pregunta nueva. → Task 4, `ignores answers faster than
   MIN_RT_MS`; Task 6, `a tap right after Next does not answer the new question`.
3. **Respuesta y tiempo agotado casi a la vez:** solo cuenta lo primero que ocurra; después de responder, que se
   cumplan los 20 s no cambia el puntaje ni el resultado. → Task 6, `the timer cannot fire after an answer`.
4. **Almacenamiento local que falla** (modo privado, IndexedDB bloqueado): se puede jugar igual, aunque las
   preguntas puedan repetirse. → Task 6, `plays with an empty history when it cannot be read`.
5. **Preguntas borradas de un banco** mientras el historial conserva sus ids: «Vistas» nunca muestra más que el
   total («Vistas: 105 de 100»). → Task 8, `seen counts never exceed the bank size`.

## Mapa de archivos

| Ruta | Responsabilidad |
|---|---|
| `src/quiz/types.ts` | Tipos de pregunta, categorías, bloques y detalles de la ronda |
| `src/quiz/validate.ts` | `validateBank`: errores legibles de un archivo de preguntas |
| `src/quiz/banks/*.json` | Un banco por categoría (12) |
| `src/quiz/banks/manifest.ts` | Tamaño de cada banco |
| `src/quiz/banks/load.ts` | `loadQuestions`: carga perezosa de bancos |
| `src/quiz/banks.test.ts` | Valida los bancos reales y el manifiesto |
| `src/games/quiz/selection.ts` | Elegir la siguiente pregunta |
| `src/games/quiz/engine.ts` | Estado de la ronda, puntaje y resultado |
| `src/games/quiz/Game.tsx`, `QuestionView.tsx`, `useQuestionTimer.ts`, `Example.tsx`, `quiz.module.css` | Interfaz de la ronda |
| `src/games/quiz/QuizReview.tsx` | «Repasa tus errores» |
| `src/games/quiz/makeQuizGame.ts`, `src/games/quiz/index.ts` | Los 14 `GameDefinition` |
| `src/data/quizAnswers.ts` | Historial local de respuestas |
| `src/screens/QuizScreen.tsx` | Pestaña Preguntas |
| `src/screens/progress/QuizProgress.tsx` | Bloque Preguntas en Progreso |
| `src/test/quizFixtures.ts` | Preguntas de prueba |
| `scripts/quiz-stats.mjs` | Cuenta preguntas por categoría y dificultad (`npm run quiz:stats`) |
| `supabase/migrations/20261102000000_quiz_games.sql`, `supabase/tests/04_quiz_games.test.sql` | Catálogo de juegos de preguntas |
| `docs/quiz/guia-de-contenido.md` | Reglas para escribir y revisar preguntas |

---

### Task 1: Formato de preguntas, validación y guía de contenido

**Files:**
- Create: `src/quiz/types.ts`, `src/quiz/validate.ts`, `src/quiz/validate.test.ts`, `src/test/quizFixtures.ts`,
  `docs/quiz/guia-de-contenido.md`

**Interfaces:**
- Produces (`src/quiz/types.ts`):
  ```ts
  export type QuizBank = 'trivia' | 'accounting';
  export const TRIVIA_CATEGORIES = ['history', 'science', 'geography', 'math', 'arts', 'entertainment', 'sports', 'technology'] as const;
  export const ACCOUNTING_CATEGORIES = ['concepts', 'colombia', 'us', 'lending'] as const;
  export type QuizCategory = (typeof TRIVIA_CATEGORIES)[number] | (typeof ACCOUNTING_CATEGORIES)[number];
  export const CATEGORIES_BY_BANK: Record<QuizBank, readonly QuizCategory[]>;
  export const ALL_CATEGORIES: readonly QuizCategory[];      // los 12, en el orden de arriba
  export type Difficulty = 1 | 2 | 3;
  export interface ChoiceTexts { question: string; options: [string, string, string, string]; explanation: string }
  export interface TrueFalseTexts { question: string; explanation: string }
  interface QuestionBase { id: string; category: QuizCategory; difficulty: Difficulty; asOf?: string }
  export type ChoiceQuestion = QuestionBase & { type: 'choice'; es: ChoiceTexts; en: ChoiceTexts };
  export type TrueFalseQuestion = QuestionBase & { type: 'truefalse'; answer: boolean; es: TrueFalseTexts; en: TrueFalseTexts };
  export type Question = ChoiceQuestion | TrueFalseQuestion;
  export type AnswerOutcome = 'correct' | 'wrong' | 'skipped' | 'timeout';
  /** `chosen`: índice canónico (choice: 0 = correcta; truefalse: 0 = Verdadero, 1 = Falso), null si no respondió. */
  export interface QuizRoundItem { question: Question; outcome: AnswerOutcome; chosen: number | null }
  export interface QuizRoundDetails { items: QuizRoundItem[] }
  export interface QuizConfig { bank: QuizBank; categories: readonly QuizCategory[] }
  export const QUIZ_TEXT_LIMITS = { question: 160, option: 60, explanation: 220 } as const;
  export const MAX_TRUE_FALSE_SHARE = 0.25;
  export function correctIndex(q: Question): number;          // choice → 0; truefalse → answer ? 0 : 1
  export function optionTexts(q: Question, lang: 'es' | 'en', labels: { true: string; false: string }): string[];  // en orden canónico
  ```
- Produces (`src/quiz/validate.ts`): `validateBank(raw: unknown, fileCategory: QuizCategory): string[]`. Devuelve una
  lista de errores, vacía si el archivo es válido. Cada error empieza con el id de la pregunta (o con `bank:` si es
  del archivo completo).
- Produces (`src/test/quizFixtures.ts`):
  - `makeChoice(id: string, category: QuizCategory, difficulty: Difficulty, extra?: Partial<ChoiceQuestion>): ChoiceQuestion`.
    Las opciones son `Correcta <id>`, `Incorrecta A <id>`, `Incorrecta B <id>` e `Incorrecta C <id>`, con textos EN
    análogos.
  - `makeTrueFalse(id, category, difficulty, answer: boolean): TrueFalseQuestion`.
  - `makePool(category, counts: Record<Difficulty, number>): Question[]`, con ids `<category>-0001…`.
  - `rawBank(category, questions: Question[]): unknown`: el formato de archivo, sin `category` en cada pregunta.

- [ ] **Step 1: Write the failing tests** en `src/quiz/validate.test.ts`. Cada caso parte de
  `rawBank('history', makePool('history', {1: 4, 2: 4, 3: 4}))` y cambia una sola cosa:
  ```ts
  test('a valid bank has no errors', () => expect(validateBank(valid(), 'history')).toEqual([]));
  test('the bank category must match the file', () => expect(validateBank(valid(), 'science').join('\n')).toMatch(/^bank:/m));
  test('ids follow <category>-NNNN and are unique', ...);         // 'hist-1' y un id repetido → errores que nombran el id
  test('difficulty is 1, 2 or 3', ...);                          // 4 → error con el id
  test('choice questions have 4 distinct options per language', ...); // 3 opciones; 'París' y ' parís' → error
  test('true/false questions have a boolean answer and no options', ...);
  test('texts are trimmed, non-empty and within the limits', ...);   // 161 / 61 / 221 caracteres → 3 errores
  test('rejects all/none of the above', ...);  // 'Todas las anteriores', 'ninguna de las anteriores', 'All of the above', 'None of the above'
  test('asOf is YYYY-MM', ...);                // '2026-11' ok; '2026-13' y '11-2026' → error
  test('at most 25 % true/false', ...);        // 3 de 12 ok; 4 de 12 → error 'bank:'
  test('at least 10 questions and one of each difficulty', ...);
  test('correctIndex and optionTexts', ...);   // choice → 0; truefalse false → 1; optionTexts truefalse = ['Verdadero','Falso']
  ```
- [ ] **Step 2: Run** `npx vitest run src/quiz/validate.test.ts`. Expected: FAIL (no existe el módulo).
- [ ] **Step 3: Implement** `types.ts`, `validate.ts` y `quizFixtures.ts` con las firmas de arriba.
  - Para comparar opciones: `trim().toLocaleLowerCase()`.
  - Frases prohibidas: `/\b(todas|ninguna) de las anteriores\b|\b(all|none) of the above\b/i`.
  - Formato de `asOf`: `/^\d{4}-(0[1-9]|1[0-2])$/`.
- [ ] **Step 4: Run** `npx vitest run src/quiz/validate.test.ts`. Expected: PASS.
- [ ] **Step 5: Write `docs/quiz/guia-de-contenido.md`** (en español). Contenido:
  - Las reglas de spec §3.2 y el formato de §3.3.
  - Lo que cubre cada categoría (spec §3.1).
  - Tres ejemplos buenos y tres malos, cada uno con su motivo: dato que cambia con el tiempo, respuesta ambigua y
    distractor absurdo.
  - Cómo asignar la dificultad (fácil = lo sabe la mayoría; media = lo sabe quien se interesa por el tema; difícil
    = especialista).
  - Las reglas de la parte contable: sin valores anuales, citar la norma y cuándo usar `asOf`.
  - El proceso de redacción, verificación independiente y revisión del equipo (spec §3.4).
  - Cómo agregar preguntas: el id siguiente, actualizar `manifest.ts`, `npm run quiz:stats` y `npm test`.
- [ ] **Step 6: Commit.** `git add src/quiz src/test/quizFixtures.ts docs/quiz && git commit -m "feat(quiz): question format, bank validation and content guide"`

---

### Task 2: Bancos iniciales, manifiesto y carga perezosa

**Files:**
- Create: `src/quiz/banks/<categoría>.json` (12), `src/quiz/banks/manifest.ts`, `src/quiz/banks/load.ts`,
  `src/quiz/banks/load.test.ts`, `src/quiz/banks.test.ts`, `scripts/quiz-stats.mjs`
- Modify: `package.json` (script `"quiz:stats": "node scripts/quiz-stats.mjs"`)

**Interfaces:**
- Consumes: `validateBank`, los tipos y `ALL_CATEGORIES` (Task 1).
- Produces:
  - `BANK_SIZES: Record<QuizCategory, number>` (`manifest.ts`).
  - `loadQuestions(categories: readonly QuizCategory[]): Promise<Question[]>` (`load.ts`). Agrega `category` a
    cada pregunta y rechaza con `Error` si falta un banco.
  - Archivos `{ "category": "<cat>", "questions": [...] }`.

- [ ] **Step 1: Write the failing tests.**
  - `banks.test.ts` lee los JSON con `import.meta.glob('./banks/*.json', { eager: true, import: 'default' })`:
    ```ts
    test('there is exactly one bank per category', () => expect(Object.keys(files).map(toCategory).sort()).toEqual([...ALL_CATEGORIES].sort()));
    test.each(ALL_CATEGORIES)('%s bank is valid', (c) => expect(validateBank(files[path(c)], c)).toEqual([]));
    test('ids are unique across banks', ...);
    test.each(ALL_CATEGORIES)('manifest size of %s matches its file', (c) => expect(BANK_SIZES[c]).toBe(files[path(c)].questions.length));
    ```
  - `load.test.ts`:
    ```ts
    test('loads the requested categories and tags each question', async () => {
      const qs = await loadQuestions(['history', 'colombia']);
      expect(qs).toHaveLength(BANK_SIZES.history + BANK_SIZES.colombia);
      expect(new Set(qs.map((q) => q.category))).toEqual(new Set(['history', 'colombia']));
    });
    test('rejects an unknown category', () => expect(loadQuestions(['nope' as QuizCategory])).rejects.toThrow());
    ```
- [ ] **Step 2: Run** `npx vitest run src/quiz`. Expected: FAIL.
- [ ] **Step 3: Implement** `load.ts`.
  - Usa `const banks = import.meta.glob<{ category: QuizCategory; questions: unknown[] }>('./*.json', { import: 'default' })`,
    sin `eager`, para que cada banco quede en su propio fragmento.
  - El resultado se cachea en memoria por categoría.
- [ ] **Step 4: Write the first batch of real content**: **12 preguntas por categoría** (4 fáciles, 4 medias y 4
  difíciles; como máximo 3 de verdadero/falso), ids `<cat>-0001` a `<cat>-0012`.
  - Se escriben siguiendo `docs/quiz/guia-de-contenido.md`.
  - Son las primeras 12 de las 100 de cada categoría.
  - Luego `manifest.ts` con 12 en cada categoría.
- [ ] **Step 5: Verificación independiente del lote.** Un revisor que no escribió el lote (otro subagente)
  revisa las 144 preguntas con la lista de la guía:
  - dato correcto y respuesta única;
  - distractores incorrectos pero creíbles;
  - dificultad bien asignada;
  - ES = EN.

  Corrige o reemplaza lo que no pase.
- [ ] **Step 6: Write `scripts/quiz-stats.mjs`** en Node, sin dependencias. Lee `src/quiz/banks/*.json` e imprime
  una línea por categoría: `history  total 12  fácil 4  media 4  difícil 4  v/f 2`.
- [ ] **Step 7: Run** `npx vitest run src/quiz && npm run quiz:stats`. Expected: PASS, y 12 líneas con `total 12`.
- [ ] **Step 8: Verificar los fragmentos y la caché sin conexión.** Run: `npm run build && ls dist/assets | grep -cE '^(history|science|geography|math|arts|entertainment|sports|technology|concepts|colombia|us|lending)-.*\.js$' && grep -c 'assets/history-' dist/sw.js`.
  Expected: `12` y luego `1` o más. Así se confirma que cada banco es un fragmento aparte y que Workbox lo guarda
  de antemano.
- [ ] **Step 9: Commit.** `git commit -m "feat(quiz): first 144 questions, bank manifest and lazy loading"`

---

### Task 3: Selección de preguntas

**Files:**
- Create: `src/games/quiz/selection.ts`, `src/games/quiz/selection.test.ts`

**Interfaces:**
- Consumes: `Question`, `QuizCategory` y `Difficulty` (Task 1); `Rng`, `createRng`, `shuffle` y `pick`
  (`src/core/rng.ts`); `makePool` y `makeChoice` (fixtures).
- Produces:
  ```ts
  export function difficultyWeights(level: number): Record<Difficulty, number>;
  export const OLDEST_SEEN_CHOICES = 10;
  export interface PickInput {
    pool: readonly Question[];
    history: ReadonlyMap<string, number>;      // questionId → última vez respondida (ms)
    usedIds: ReadonlySet<string>;              // ya usadas en esta ronda
    askedCategories: readonly QuizCategory[];  // categorías de esta ronda, en orden
    level: number;
    rng: Rng;
  }
  /** null solo si ya se usaron todas las preguntas del pool. */
  export function pickQuestion(input: PickInput): Question | null;
  ```

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('difficulty weights by level band', () => {
    expect(difficultyWeights(1)).toEqual({ 1: 0.7, 2: 0.3, 3: 0 });
    expect(difficultyWeights(3)).toEqual({ 1: 0.7, 2: 0.3, 3: 0 });
    expect(difficultyWeights(4)).toEqual({ 1: 0.2, 2: 0.6, 3: 0.2 });
    expect(difficultyWeights(7)).toEqual({ 1: 0.2, 2: 0.6, 3: 0.2 });
    expect(difficultyWeights(8)).toEqual({ 1: 0, 2: 0.4, 3: 0.6 });
    expect(difficultyWeights(10)).toEqual({ 1: 0, 2: 0.4, 3: 0.6 });
  });
  test('level 1 never picks a hard question while easy and medium remain', ...); // 300 elecciones, semillas 1..300
  test('prefers questions never answered', ...);  // 30 preguntas, 29 en el historial → siempre la única nueva
  test('when every question was answered, picks among the 10 oldest', ...); // historial 1..30 ms → la elegida tiene tiempo ≤ 10
  test('never repeats a question within a round', ...);
  test('fills a round from a pool of exactly 10 hard questions at level 1', ...); // 10 elecciones distintas y luego null
  test('falls back to the nearest difficulty, lower first', ...); // pool solo con 1 y 3, nivel 5 sortea 2 → elige 1
  test('mix: no category three times in a row and at most 2 per category in 10 picks over 8 categories', ...);
  test('is deterministic for a given seed', ...);
  ```
- [ ] **Step 2: Run** `npx vitest run src/games/quiz/selection.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `pickQuestion` siguiendo spec §5.3 al pie de la letra:
  1. Sortear la dificultad con `difficultyWeights(level)`.
  2. Elegir la categoría:
     - solo entre las que tienen preguntas sin usar;
     - sin la de las dos últimas si coinciden;
     - entre las menos usadas en la ronda, con `pick` para desempatar.
  3. Si no hay candidatas, probar las dificultades por cercanía (±1 y luego ±2, la menor primero); si aun así no
     hay, otra categoría.
  4. Elegir entre las candidatas:
     - si hay alguna sin historial, al azar entre ellas;
     - si no, al azar entre las `OLDEST_SEEN_CHOICES` con el tiempo más antiguo.
- [ ] **Step 4: Run** `npx vitest run src/games/quiz/selection.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): question selection by level, freshness and category balance"`

---

### Task 4: Motor de la ronda

**Files:**
- Create: `src/games/quiz/engine.ts`, `src/games/quiz/engine.test.ts`
- Modify: `src/games/types.ts` (agregar `quiz?: QuizRoundDetails` a `GameResult`)

**Interfaces:**
- Consumes: `pickQuestion` (Task 3); `createStaircase`, `stepStaircase` y `Staircase`
  (`src/core/difficulty.ts`); `speedBonus`, `addPoints` y `accuracyOf` (`src/games/shared/scoring.ts`);
  `MIN_RT_MS`.
- Produces:
  ```ts
  export const QUIZ_ROUND_LENGTH = 10, QUIZ_QUESTION_MS = 20_000, QUIZ_CORRECT_POINTS = 20,
    QUIZ_MAX_SCORE = 300, QUIZ_REFERENCE_SCORE = 200;
  export const QUIZ_WRONG_PENALTY = { choice: 10, truefalse: 30 } as const;
  export interface CurrentQuestion { question: Question; order: number[]; askedAt: number } // order: índices canónicos en orden de pantalla
  export interface QuizRoundState {
    pool: readonly Question[]; history: ReadonlyMap<string, number>;
    staircase: Staircase; score: number; correct: number;
    items: QuizRoundItem[]; current: CurrentQuestion;
    phase: 'asking' | 'feedback' | 'finished';
  }
  export function createQuizRound(pool: readonly Question[], history: ReadonlyMap<string, number>, startLevel: number, rng: Rng, now: number): QuizRoundState;
  export function answerQuestion(state: QuizRoundState, shownIndex: number, now: number): QuizRoundState;
  export function dontKnow(state: QuizRoundState): QuizRoundState;
  export function timeOutQuestion(state: QuizRoundState): QuizRoundState;
  export function nextQuestion(state: QuizRoundState, rng: Rng, now: number): QuizRoundState;
  export function lastItem(state: QuizRoundState): QuizRoundItem | undefined;
  export function quizResult(state: QuizRoundState, durationMs: number): GameResult;
  ```
  - Para una pregunta de opción múltiple, `order` es `shuffle(rng, [0, 1, 2, 3])`. Para verdadero/falso es
    `[0, 1]`.
  - `answerQuestion`, `dontKnow` y `timeOutQuestion` devuelven el mismo estado (`===`) si `phase !== 'asking'`.
    `answerQuestion` lo devuelve también si `shownIndex` está fuera de rango o si `now - askedAt < MIN_RT_MS`.
  - `nextQuestion` solo actúa en `feedback`. Después del ítem 10 pasa a `finished`.

- [ ] **Step 1: Write the failing tests.** El pool es `makePool('history', {1: 20, 2: 20, 3: 20})` y el rng es
  `createRng(7)`. `shownOf(state, canonical)` es un ayudante que devuelve `state.current.order.indexOf(canonical)`.
  ```ts
  test('a correct answer scores 20 plus the speed bonus', () => {
    let s = createQuizRound(pool, new Map(), 1, rng, 0);
    s = answerQuestion(s, shownOf(s, 0), 2000);
    expect(s.score).toBe(20 + speedBonus(2000, 20_000)); // 29
    expect(lastItem(s)).toMatchObject({ outcome: 'correct', chosen: 0 });
  });
  test('a wrong choice costs 10 and never goes below 0', ...);       // primer error → 0; tras 29, error → 19
  test('a wrong true/false costs 30', ...);                          // pool de verdadero/falso: 29 → 0; tras dos aciertos de 29 → 28
  test('dont know and time out score 0 and count as misses', ...);   // outcome 'skipped' / 'timeout', chosen null, correct sin cambio
  test('ignores answers faster than MIN_RT_MS', ...);                 // rt 149 → mismo estado; rt 150 → responde
  test('ignores answers outside asking', ...);
  test('ten fast correct answers score the maximum 300', ...);       // rt 150 en las 10 → 300 === QUIZ_MAX_SCORE
  test('finishes after 10 questions', ...);                          // phase 'finished'; nextQuestion ya no cambia el estado
  test('the staircase moves the level within the round', ...);       // 4 aciertos → nivel 2; 2 fallos → baja
  test('choice options are shuffled and true/false keeps True, False', ...);
  test('quizResult reports accuracy, level reached and canonical choices', ...); // accuracy = correct/10; quiz.items.length 10
  ```
- [ ] **Step 2: Run** `npx vitest run src/games/quiz/engine.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `engine.ts` y el campo `quiz?: QuizRoundDetails` en `GameResult`, con un comentario:
  «Solo en los juegos de preguntas: lo necesario para el repaso y el historial local».
- [ ] **Step 4: Run** `npx vitest run src/games/quiz && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): round engine with scoring, penalties and staircase"`

---

### Task 5: Historial local de respuestas

**Files:**
- Create: `src/data/quizAnswers.ts`, `src/data/quizAnswers.test.ts`
- Modify: `src/data/db.ts` (versión 3), `src/play/recordGameResult.ts`, `src/play/recordGameResult.test.ts`

**Interfaces:**
- Consumes: `QuizRoundDetails`, `QuizCategory` y `AnswerOutcome` (Task 1); `GameResult.quiz` (Task 4).
- Produces:
  ```ts
  // db.ts
  export interface QuizAnswer { resultId: string; questionId: string; category: QuizCategory; outcome: AnswerOutcome; answeredAt: string }
  db.version(3).stores({ quizAnswers: '[resultId+questionId], questionId, category, answeredAt' });
  // quizAnswers.ts
  export function addQuizAnswers(resultId: string, details: QuizRoundDetails, answeredAt: Date): Promise<void>;
  export function answerHistory(categories: readonly QuizCategory[]): Promise<Map<string, number>>;
  export function seenCounts(): Promise<Map<QuizCategory, number>>;
  export function masteryByCategory(since: Date): Promise<Map<QuizCategory, { answered: number; correct: number }>>;
  ```

- [ ] **Step 1: Write the failing tests** en `quizAnswers.test.ts`, con `beforeEach(clearAllData)` como en
  `data.test.ts`:
  ```ts
  test('saving the same result twice does not duplicate answers', ...); // 2 llamadas con 'r1' → 10 filas
  test('history keeps the latest time per question', ...);              // misma pregunta en 2 rondas → la fecha más reciente
  test('history only covers the requested categories', ...);
  test('seen counts distinct questions per category', ...);
  test('mastery counts the window only, and skips and time-outs as not correct', ...); // 1 correcta, 1 skipped, 1 timeout, 1 de hace 31 días → {answered: 3, correct: 1}
  test('clearAllData removes the answers', ...);
  ```
  En `recordGameResult.test.ts`:
  ```ts
  test('a quiz result stores its answers with the result id', ...);
  test('retrying a save with the same id keeps one set of answers', ...);
  ```
- [ ] **Step 2: Run** `npx vitest run src/data src/play`. Expected: FAIL.
- [ ] **Step 3: Implement** la versión 3 de Dexie, solo con la tabla nueva y sin función de migración (como la
  v2), y `quizAnswers.ts`.
  - `recordGameResult` llama a `addQuizAnswers(stored.id, result.quiz, new Date(stored.playedAt))` justo después
    de `addResult`, cuando `result.quiz` existe.
  - En la spec original (§5.1), la frase «El esquema de Dexie está en la versión 2…» se actualiza a la versión 3,
    que agrega la tabla `quizAnswers` (respuestas por pregunta, solo locales).
- [ ] **Step 4: Run** `npx vitest run src/data src/play && npm test`. Expected: PASS; las 386 pruebas previas
  siguen pasando.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): local answer history (Dexie v3)"`

---

### Task 6: Componente de la ronda

**Files:**
- Create: `src/games/quiz/Game.tsx`, `src/games/quiz/QuestionView.tsx`, `src/games/quiz/useQuestionTimer.ts`,
  `src/games/quiz/Example.tsx`, `src/games/quiz/quiz.module.css`, `src/games/quiz/Game.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (bloque `quiz`)

**Interfaces:**
- Consumes:
  - el motor (Task 4);
  - `loadQuestions` (Task 2) y `answerHistory` (Task 5);
  - `useGameClock` y `useTrialTimeout` (`src/games/shared/clock.ts`);
  - `useFeedback`, `useGameKeys` y `GameHud`;
  - `optionTexts` y `correctIndex` (Task 1).
- Produces:
  - `QuizGame(props: GameProps & { categories: readonly QuizCategory[] })`: la factoría de Task 7 la envuelve.
  - `QuestionView(props: QuestionViewProps)` para la tarjeta, opciones, «No sé», respuesta y explicación. La
    reutiliza el ejemplo:
    ```ts
    interface QuestionViewProps {
      question: Question; order: readonly number[]; lang: 'es' | 'en';
      phase: 'asking' | 'feedback'; outcome?: AnswerOutcome; chosen: number | null;
      onChoose?: (shownIndex: number) => void; onDontKnow?: () => void; onNext?: () => void; isLast?: boolean;
    }
    ```
  - `QuizExample()`.
  - `useQuestionTimer(clock, askedAt, windowMs | null, paused): number`: ms restantes, actualizado cada 100 ms.

**Textos** (`quiz.*`, ES / EN; copia exacta):

| Clave | ES | EN |
|---|---|---|
| `quiz.questionOf` | `Pregunta {{n}} de {{total}}` | `Question {{n}} of {{total}}` |
| `quiz.dontKnow` | `No sé` | `I don't know` |
| `quiz.next` / `quiz.finish` | `Siguiente` / `Ver resultado` | `Next` / `See results` |
| `quiz.true` / `quiz.false` | `Verdadero` / `Falso` | `True` / `False` |
| `quiz.correct` / `quiz.yourAnswer` / `quiz.timeUp` | `Correcta` / `Tu respuesta` / `Se acabó el tiempo` | `Correct` / `Your answer` / `Time's up` |
| `quiz.announce.correct` | `¡Correcto!` | `Correct!` |
| `quiz.announce.wrong` | `Incorrecto. La respuesta era: {{answer}}` | `Wrong. The answer was: {{answer}}` |
| `quiz.announce.timeout` | `Se acabó el tiempo. La respuesta era: {{answer}}` | `Time's up. The answer was: {{answer}}` |
| `quiz.announce.skipped` | `La respuesta era: {{answer}}` | `The answer was: {{answer}}` |
| `quiz.asOf` | `Vigente a {{date}}` | `Current as of {{date}}` |
| `quiz.loading` / `quiz.loadError` | `Cargando preguntas…` / `No pudimos cargar las preguntas.` | `Loading questions…` / `We couldn't load the questions.` |
| `quiz.categories.<cat>` | Historia, Ciencias, Geografía, Matemáticas, Arte y literatura, Entretenimiento, Deportes, Tecnología, Conceptos contables, Colombia, EE. UU., Cartera y préstamos | History, Science, Geography, Math, Arts & literature, Entertainment, Sports, Technology, Accounting concepts, Colombia, United States, Lending & loan portfolio |
| `quiz.example.question` / `options` (array de 4, correcta primero) / `explanation` | `¿Cuál es el planeta más grande del sistema solar?` / `Júpiter, Saturno, Neptuno, Tierra` / `Júpiter tiene más del doble de masa que todos los demás planetas juntos.` | `Which is the largest planet in the Solar System?` / `Jupiter, Saturn, Neptune, Earth` / `Jupiter has more than twice the mass of all the other planets combined.` |

- `{{date}}` es `Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' })` del día 1 del mes de `asOf`. En ES
  da «noviembre de 2026».
- «Reintentar» reutiliza `play.retry`.

**Comportamiento** (spec §2, §4 y §7):
1. Mientras cargan `loadQuestions(categories)` y `answerHistory(categories)` se muestra `quiz.loading`. Si falla el
   historial, se usa `new Map()`. Si falla la carga de preguntas, se muestra `quiz.loadError` y un botón
   `play.retry`.
2. El reloj de la pregunta empieza con `clock.now()` cuando la pregunta aparece en pantalla.
3. `useTrialTimeout` recibe la ventana `QUIZ_QUESTION_MS` solo en `asking` y la detiene con la pausa.
4. **HUD:**
   - `GameHud` muestra los segundos restantes de la pregunta, los puntos y el nivel;
   - `quiz.questionOf`;
   - una barra de tiempo con `role="progressbar"`, que con `prefers-reduced-motion` no anima la transición.
5. **Opciones:**
   - Cada opción es un `<button>` con nombre accesible `«<n> <texto>»`.
   - En `feedback`, la correcta lleva «✓ Correcta». La del jugador, si falló, lleva «✗ Tu respuesta».
   - Si se acabó el tiempo se muestra `quiz.timeUp`.
   - Debajo van la explicación del idioma actual (`i18n.language`), la línea `quiz.asOf` si existe y el botón
     `quiz.next`, que en el ítem 10 es `quiz.finish`.
   - Un `aria-live="polite"` anuncia `quiz.announce.*`.
6. **Teclas:** `1`–`n` responden, `0` es «No sé» y `Enter` es «Siguiente» en `feedback`. Los clics de ratón no
   mueven el foco (`onMouseDown={keepFocus}`, como en Cálculo relámpago).
7. Sonido: `feedback('correct' | 'wrong')`. «No sé» y el tiempo agotado suenan como `wrong`.
8. Al pulsar `quiz.finish` se llama **una sola vez** a `onFinish(quizResult(state, clock.now()))`.

- [ ] **Step 1: Write the failing tests** en `Game.test.tsx`.
  - Preparación:
    - `vi.mock('../../quiz/banks/load')` devuelve `makePool('history', {1: 20, 2: 20, 3: 20})`.
    - `vi.mock('../../data/quizAnswers')` hace que `answerHistory` devuelva `new Map()`.
    - Fake timers e `initI18n('es')`, como en `quick-math/Game.test.tsx`.
  - Para encontrar la opción correcta se busca el botón cuyo nombre contiene `Correcta history-`.
  ```ts
  test('shows question 1 of 10 with four options and I don't know', ...);
  test('answering correctly shows the check, the explanation and the score', ...); // 'Puntos' = 20 + bonus
  test('a wrong answer marks both options', ...);                                   // '✓ Correcta' y '✗ Tu respuesta'
  test('keys 1-4 answer, 0 is I don't know and Enter goes next', ...);
  test('time runs out after 20 seconds without a penalty', ...);                   // advance(20_000) → 'Se acabó el tiempo', puntos 0
  test('the timer cannot fire after an answer', ...);                              // responde, advance(25_000) → sigue en la explicación, mismos puntos
  test('a tap right after Next does not answer the new question', ...);            // Siguiente y luego opción en < 150 ms → sigue sin responder
  test('the timer stops while paused', ...);                                       // paused, advance(30_000) → sigue preguntando
  test('shows the as-of line when a question has asOf', ...);                      // 'Vigente a noviembre de 2026'
  test('shows an error and retries when questions cannot load', ...);
  test('plays with an empty history when it cannot be read', ...);
  test('reports one result with 10 items after the last question', ...);           // onFinish llamado 1 vez; quiz.items.length 10
  ```
- [ ] **Step 2: Run** `npx vitest run src/games/quiz/Game.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** los componentes, el hook y los textos, en ES y EN.
  - `QuizExample` usa `QuestionView` en modo `feedback`, con `quiz.example.*` y la correcta marcada.
  - Las clases CSS usan los tokens de `src/app/theme.css`.
  - Cada botón mide al menos `min-height: 44px` y tiene `width: 100%`. El texto se parte en varias líneas.
- [ ] **Step 4: Run** `npx vitest run src/games/quiz src/i18n src/app/contrast.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): round UI with feedback, explanations, keyboard and timer"`

---

### Task 7: Registro de los 14 juegos y catálogo en Supabase

**Files:**
- Create: `src/games/quiz/makeQuizGame.ts`, `src/games/quiz/index.ts`,
  `supabase/migrations/20261102000000_quiz_games.sql`, `supabase/tests/04_quiz_games.test.sql`
- Modify:
  - `src/games/types.ts`, `src/games/registry.ts`, `src/games/registry.test.ts`, `src/games/penaltyCopy.test.ts`;
  - `src/data/dailyPlans.ts`, `src/data/dailyPlans.test.ts`;
  - `src/screens/GamesScreen.tsx`, `src/screens/play/Instructions.tsx`;
  - `src/i18n/es.json`, `src/i18n/en.json`;
  - `supabase/tests/01_core_schema.test.sql`, `tests/integration/sync.int.test.ts`, `SETUP.md`.

**Interfaces:**
- Consumes: `QuizGame` y `QuizExample` (Task 6); `QUIZ_MAX_SCORE` y `QUIZ_REFERENCE_SCORE` (Task 4); `QuizConfig`
  (Task 1).
- Produces:
  ```ts
  // types.ts
  export type Area = 'memory' | 'attention' | 'speed' | 'flexibility' | 'math' | 'logic' | 'language' | 'trivia' | 'accounting';
  export const QUIZ_AREAS: readonly Area[] = ['trivia', 'accounting'];
  // GameDefinition gana: quiz?: QuizConfig; instructionsKey?: string; ResultDetails?: ComponentType<{ result: GameResult }>
  // makeQuizGame.ts
  export function makeQuizGame(args: { id: string; bank: QuizBank; categories: readonly QuizCategory[] }): GameDefinition;
  // index.ts
  export const QUIZ_GAME_LIST: readonly GameDefinition[];  // los 14, en el orden de Global Constraints
  // registry.ts
  export const GAMES: readonly GameDefinition[];           // 5 de entrenamiento + 14 de preguntas
  export const TRAINING_GAMES: readonly GameDefinition[];  // sin `quiz`
  export const QUIZ_GAMES: readonly GameDefinition[];      // con `quiz`
  ```
- `makeQuizGame` fija:
  - `area: bank`, `referenceScore: QUIZ_REFERENCE_SCORE` y `maxScore: QUIZ_MAX_SCORE`;
  - `instructionsKey: 'quiz.instructions'` y `quiz: { bank, categories }`;
  - `Component`, una función estable creada una vez por juego que renderiza
    `<QuizGame categories={categories} {...props} />`;
  - `Example: QuizExample`.

**Textos:**
- `games.<id>.title` y `description` para los 14 (ES / EN):

| id | ES | EN |
|---|---|---|
| `trivia-mix` | Mezcla de cultura general — Preguntas de las 8 categorías en cada ronda. | General knowledge mix — Questions from all 8 categories in every round. |
| `trivia-history` | Historia — Historia universal y de América Latina. | History — World and Latin American history. |
| `trivia-science` | Ciencias — Física, química, biología, astronomía y cuerpo humano. | Science — Physics, chemistry, biology, astronomy and the human body. |
| `trivia-geography` | Geografía — Países, capitales, ríos, montañas y regiones. | Geography — Countries, capitals, rivers, mountains and regions. |
| `trivia-math` | Matemáticas — Conceptos, geometría, cálculo sencillo e historia de las matemáticas. | Math — Concepts, geometry, simple arithmetic and the history of math. |
| `trivia-arts` | Arte y literatura — Pintura, autores y obras, música clásica y mitología. | Arts & literature — Painting, authors and works, classical music and mythology. |
| `trivia-entertainment` | Entretenimiento — Cine, música y televisión. | Entertainment — Film, music and TV. |
| `trivia-sports` | Deportes — Mundiales, Juegos Olímpicos y reglas de cada deporte. | Sports — World Cups, the Olympics and the rules of each sport. |
| `trivia-technology` | Tecnología — Inventos, computación e historia de internet. | Technology — Inventions, computing and the history of the internet. |
| `accounting-mix` | Mezcla contable — Preguntas de las 4 subcategorías contables. | Accounting mix — Questions from all 4 accounting topics. |
| `accounting-concepts` | Conceptos contables — Partida doble, estados financieros, causación y conciliaciones. | Accounting concepts — Double entry, financial statements, accruals and reconciliations. |
| `accounting-colombia` | Contabilidad en Colombia — PUC, NIIF, IVA, retención en la fuente, ICA y facturación electrónica. | Accounting in Colombia — PUC, IFRS, VAT, withholding tax, ICA and e-invoicing. |
| `accounting-us` | Contabilidad en EE. UU. — US GAAP, temas ASC, formularios del IRS y QuickBooks. | US accounting — US GAAP, ASC topics, IRS forms and QuickBooks. |
| `accounting-lending` | Cartera y préstamos — Intereses, amortización, payoff, aging, provisiones y castigos. | Lending & loan portfolio — Interest, amortization, payoff, aging, allowances and charge-offs. |

- `quiz.instructions` (array):
  - **ES:**
    1. «Responde 10 preguntas; tienes 20 segundos para cada una.»
    2. «Toca la respuesta correcta o usa las teclas 1 a 4. Luego verás la respuesta y una breve explicación.»
    3. «Cada acierto suma 20 puntos, más hasta 10 por rapidez. Cada error resta 10 puntos (30 en las de verdadero o
       falso).»
    4. «Si no la sabes, toca «No sé» o la tecla 0: verás la respuesta sin perder puntos.»
  - **EN:**
    1. «Answer 10 questions; you have 20 seconds for each.»
    2. «Tap the right answer or use keys 1 to 4. Then you'll see the answer and a short explanation.»
    3. «Each correct answer earns 20 points, plus up to 10 for speed. Each mistake costs 10 points (30 on
       true-or-false questions).»
    4. «If you don't know, tap “I don't know” or key 0: you'll see the answer without losing points.»

**Migración:**
- [ ] **Step 1: Confirmar el nombre de la restricción.** Run: `npm run db:start` (ver Global Constraints) y luego
  `docker exec supabase_db_light psql -U postgres -c '\d public.games'`. Expected: aparece `"games_area_check"
  CHECK (area = ANY (...))`. Si el nombre es otro, úsalo en el Step 4.
- [ ] **Step 2: Write the failing tests.**
  - `registry.test.ts`:
    - acepta las áreas de entrenamiento para `TRAINING_GAMES` y `QUIZ_AREAS` para `QUIZ_GAMES`;
    - lee las instrucciones de `instructionsKey ?? games.<id>.instructions`;
    - nuevos:
    ```ts
    test('training games are exactly the 5 v1 games', () => expect(TRAINING_GAMES.map((g) => g.id)).toEqual(['sequence-lights', 'arrows', 'same-different', 'rule-switch', 'quick-math']));
    test('quiz games are the 14 ids, their area is their bank and mixes cover the bank', ...); // trivia-mix.quiz.categories = TRIVIA_CATEGORIES
    test('quiz games share a max score of 300', ...);
    ```
  - `penaltyCopy.test.ts`: `quiz.instructions` menciona `10` y `30` en ES y EN.
  - `dailyPlans.test.ts`: `test('the daily plan never picks a quiz game', ...)`. Corre 60 días seguidos con
    `getOrCreatePlan`; ningún id empieza por `trivia-` o `accounting-`.
  - `PlayScreen.test.tsx`: `test('instructions come from instructionsKey when a game sets it', ...)`. Agrega al
    mock del registro un `fakeGame3 = { ...fakeGame, id: 'fake3', instructionsKey: 'quiz.instructions' }` (con
    título en `registerFakeGameTranslations`). Su primera partida muestra «Responde 10 preguntas; tienes 20
    segundos para cada una.».
  - Los mocks de `../games/registry` en `PlayScreen.test.tsx` y `storageFailures.test.tsx` exportan además
    `TRAINING_GAMES` (= sus juegos falsos) y `QUIZ_GAMES` (= `[]`). Si no, `dailyPlans.ts` y `GamesScreen` reciben
    `undefined`.
  - `04_quiz_games.test.sql` (pgTAP, con `plan(5)`):
    - `results_eq` de las 14 filas `(id, area, 300)`, ordenadas por `id collate "C"`;
    - `throws_ok` al insertar `('x', 'cooking', 10)` en `games` con `23514`;
    - `lives_ok` al insertar `('quiz-check', 'accounting', 10)`;
    - como un invitado, `lives_ok` para un resultado de `trivia-history` con `score` 300 y `throws_ok` `P0001`
      con 301.
  - `01_core_schema.test.sql`: el `results_eq` de `games` agrega `where area not in ('trivia', 'accounting')`.
  - `sync.int.test.ts`: `test('a quiz result at 300 is accepted and 301 is refused', ...)`. Usa `syncNow` →
    `{ uploaded: 1, rejected: 1 }`.
- [ ] **Step 3: Run** `npx vitest run src/games src/data && npm run db:reset && npm run db:test`. Expected: FAIL.
- [ ] **Step 4: Write the migration** `20261102000000_quiz_games.sql`:
  ```sql
  -- Quiz section: two new areas and the 14 quiz games. max_score matches QUIZ_MAX_SCORE in src/games/quiz/engine.ts.
  alter table public.games drop constraint games_area_check;
  alter table public.games add constraint games_area_check check (area in
    ('memory','attention','speed','flexibility','math','logic','language','trivia','accounting'));

  insert into public.games (id, area, max_score) values
    ('trivia-mix', 'trivia', 300), ('trivia-history', 'trivia', 300), ('trivia-science', 'trivia', 300),
    ('trivia-geography', 'trivia', 300), ('trivia-math', 'trivia', 300), ('trivia-arts', 'trivia', 300),
    ('trivia-entertainment', 'trivia', 300), ('trivia-sports', 'trivia', 300), ('trivia-technology', 'trivia', 300),
    ('accounting-mix', 'accounting', 300), ('accounting-concepts', 'accounting', 300),
    ('accounting-colombia', 'accounting', 300), ('accounting-us', 'accounting', 300),
    ('accounting-lending', 'accounting', 300);
  ```
- [ ] **Step 5: Implement**:
  - los cambios de `types.ts`, `makeQuizGame`, `index.ts` y `registry.ts`;
  - `TRAINING_GAMES` en `dailyPlans.ts` y en `GamesScreen.tsx`;
  - `instructionsKey` en `Instructions.tsx`;
  - los textos.

  En `SETUP.md`, el paso 2 pasa de «Aplicar las 3 migraciones» a 4, y agrega `20261102000000_quiz_games.sql` a la
  lista.
- [ ] **Step 6: Run** `npm test && npm run typecheck && npm run lint && npm run db:reset && npm run db:test && npm run test:integration`.
  Expected: todo PASS. La prueba «the games table matches the registry» ya incluye los 14.
- [ ] **Step 7: Commit.** `git commit -m "feat(quiz): register 14 quiz games and add them to the Supabase catalog"`

---

### Task 8: Pestaña y pantalla Preguntas

**Files:**
- Create: `src/screens/QuizScreen.tsx`, `src/screens/QuizScreen.test.tsx`
- Modify: `src/app/App.tsx` (ruta `quiz`), `src/app/Layout.tsx` (`NAV_ITEMS`), `src/app/Layout.module.css`
  (`repeat(5, 1fr)`), `src/screens/Screens.module.css` (tarjeta destacada), `src/i18n/*.json`

**Interfaces:**
- Consumes: `QUIZ_GAMES` (Task 7); `BANK_SIZES` (Task 2); `seenCounts` (Task 5); `CATEGORIES_BY_BANK` (Task 1).
- Produces:
  - la ruta `/quiz`;
  - la función pura `seenFor(config: QuizConfig, seen: ReadonlyMap<QuizCategory, number>): { seen: number; total: number }`
    en `QuizScreen.tsx`. Suma `min(seen[c], BANK_SIZES[c])` y `BANK_SIZES[c]` sobre `config.categories`. La usa
    también Task 10.
- **Textos:**
  - `nav.quiz`: `Preguntas` / `Quiz`.
  - `quiz.title`: `Preguntas` / `Quiz`.
  - `quiz.intro`: `Rondas de 10 preguntas de cultura general y de contabilidad.` / `10-question rounds of general
    knowledge and accounting.`
  - `quiz.banks.trivia`: `Cultura general` / `General knowledge`.
  - `quiz.banks.accounting`: `Contabilidad` / `Accounting`.
  - `quiz.seen`: `Vistas: {{seen}} de {{total}}` / `Seen: {{seen}} of {{total}}`.

- [ ] **Step 1: Write the failing tests** (`renderApp('/quiz')`, `beforeEach(clearAllData)`):
  ```ts
  test('lists both blocks with the mix first', ...);   // h2 ['Cultura general','Contabilidad']; los primeros links son las mezclas
  test('each card links to its game with best mark and seen count', ...); // href '/play/trivia-history'; 'Mejor marca: 250'; 'Vistas: 3 de <BANK_SIZES.history>'
  test('the mix card sums its categories', ...);
  test('seen counts never exceed the bank size', ...); // más ids en el historial que BANK_SIZES.history → 'Vistas: N de N'
  test('the nav has five tabs in order', ...);          // ['Hoy','Juegos','Preguntas','Progreso','Ajustes']
  ```
- [ ] **Step 2: Run** `npx vitest run src/screens/QuizScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** la pantalla.
  - Estructura: `h1` = `quiz.title` y el párrafo `quiz.intro`. Luego, por bloque, una `section` con `h2` y una
    lista de tarjetas (`Link` → `/play/<id>`, con `h3`, descripción, mejor marca y «Vistas»).
  - La mejor marca usa `gamesScreen.best`, con la misma consulta que `GamesScreen`.
  - La mezcla lleva una clase destacada.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. `App.test.tsx` («bottom navigation switches screens») recorre
  las pestañas: agrega el paso por «Preguntas» → `h1` «Preguntas».
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): Quiz tab with blocks, best marks and seen counts"`

---

### Task 9: Resultado con «Repasa tus errores» y vuelta a Preguntas

**Files:**
- Create: `src/games/quiz/QuizReview.tsx`, `src/games/quiz/QuizReview.test.tsx`
- Modify: `src/screens/play/ResultView.tsx`, `src/screens/PlayScreen.tsx`, `src/screens/PlayScreen.test.tsx`,
  `src/games/quiz/makeQuizGame.ts` (`ResultDetails: QuizReview`), `src/i18n/*.json`

**Interfaces:**
- Consumes: `GameDefinition.ResultDetails` y `quiz` (Task 7); `QuestionView` u `optionTexts` (Tasks 6 y 1).
- Produces:
  - `QuizReview({ result }: { result: GameResult })`;
  - en `ResultView`, `game.ResultDetails` se renderiza debajo de las estadísticas;
  - en `PlayScreen`, «Volver» y la salida sin historial van a `game.quiz ? '/quiz' : '/games'`.
- **Textos:**
  - `quiz.review.title`: `Repasa tus errores` / `Review your mistakes`.
  - `quiz.review.none`: `¡Sin errores en esta ronda!` / `No mistakes this round!`
  - `quiz.review.yourAnswer`: `Tu respuesta: {{answer}}` / `Your answer: {{answer}}`.
  - `quiz.review.noAnswer`: `Sin respuesta` / `No answer`.
  - `quiz.review.correctAnswer`: `Respuesta correcta: {{answer}}` / `Correct answer: {{answer}}`.
  - Para «No sé» se reutiliza `quiz.dontKnow`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('lists only missed questions with your answer, the right one and the explanation', ...); // items: 1 wrong, 1 skipped, 1 timeout, 7 correct → 3 artículos
  test('says there were no mistakes when every answer was right', ...);
  test('ResultView renders a game ResultDetails block', ...);         // fakeGame con ResultDetails de prueba
  test('Back from a quiz result goes to the Quiz tab', ...);          // PlayScreen con un juego de preguntas → pathname '/quiz'
  ```
- [ ] **Step 2: Run** `npx vitest run src/games/quiz/QuizReview.test.tsx src/screens`. Expected: FAIL.
- [ ] **Step 3: Implement.** El repaso es una `section` con `h2`. Cada fallo es un `article` con el enunciado, «Tu
  respuesta» (o «Sin respuesta» / «No sé»), «Respuesta correcta», la explicación y `asOf`, todo en el idioma
  actual.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): review missed questions on the result screen"`

---

### Task 10: Progreso — bloque Preguntas y métricas solo de entrenamiento

**Files:**
- Create: `src/screens/progress/QuizProgress.tsx`
- Modify: `src/screens/ProgressScreen.tsx`, `src/screens/ProgressScreen.test.tsx`, `src/i18n/*.json`

**Interfaces:**
- Consumes: `TRAINING_GAMES` y `QUIZ_GAMES` (Task 7); `masteryByCategory` y `seenCounts` (Task 5); `seenFor`
  (Task 8); `listResults`.
- Produces: `QuizProgress({ results, now }: { results: StoredResult[]; now: Date })`.
- **Textos:**
  - `progress.quizTitle`: `Preguntas` / `Quiz`.
  - `progress.mastery`: `Dominio (últimos 30 días)` / `Mastery (last 30 days)`.
  - `progress.quizLine`: `Vistas: {{seen}} de {{total}} · Mejor marca: {{best}}` / `Seen: {{seen}} of {{total}} ·
    Best: {{best}}`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('days trained and per-game charts ignore quiz games', ...);   // un día solo con trivia-history → 'Días entrenados: 1' (no 2); sin tarjeta 'Historia' en 'Por juego'
  test('shows mastery per category including mix answers', ...);    // respuestas de history guardadas desde trivia-mix → meter con value 50 y '50 %'
  test('hides the quiz block when there are no quiz games', ...);
  ```
- [ ] **Step 2: Run** `npx vitest run src/screens/ProgressScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - En `ProgressScreen`:
    - `areaScores(results, TRAINING_GAMES, now)`;
    - «Por juego» recorre `TRAINING_GAMES`;
    - `daysTrained` cuenta solo resultados de esos ids.
  - Debajo va `<QuizProgress>`. Muestra `h2` = `progress.quizTitle` y, por bloque, `h3` y una fila por categoría
    con datos, con este formato: etiqueta, `meter` (0–100) con `aria-labelledby`, `N %` y `progress.quizLine`. La
    mejor marca es la del juego de una sola categoría, o `—` si no hay.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(quiz): quiz mastery in Progress; training metrics count training games only"`

---

### Task 11: Pruebas de punta a punta y documentación

**Files:**
- Create: `e2e/quiz.spec.ts`
- Modify: `e2e/helpers.ts`, `e2e/touch-targets.spec.ts`, `e2e/offline.spec.ts`, `e2e/i18n.spec.ts`, `README.md`

**Interfaces:**
- Consumes: la app completa (Tasks 1–10) y los bancos iniciales de Task 2.
- Produces: `finishQuizRound(page: Page): Promise<void>` en `e2e/helpers.ts`. Para cada una de las 10
  preguntas:
  1. espera `Pregunta N de 10`;
  2. espera 200 ms (más que `MIN_RT_MS`);
  3. pulsa el botón cuyo nombre empieza por `1 `;
  4. pulsa `Siguiente` o `Ver resultado`.

- [ ] **Step 1: Write the e2e tests:**
  ```ts
  test('plays a quiz round from the Quiz tab to the review', ...);
  // Preguntas → «Historia» → Comenzar → finishQuizRound → visible «Jugar de nuevo» y
  // («Repasa tus errores» o «¡Sin errores en esta ronda!»); «Volver» → URL termina en '#/quiz'
  test('a quiz round works offline after the first visit', ...); // patrón de offline.spec.ts; luego Preguntas → Ciencias → Comenzar → 'Pregunta 1 de 10'
  test('quiz controls are at least 44 px tall on a 320 px screen', ...); // setViewportSize 320×640: pestañas, tarjetas, opciones y «No sé»
  test('shows the Quiz tab in English', ...);                    // locale en-US → la pestaña 'Quiz'
  ```
  `offline.spec.ts` sigue esperando 5 tarjetas en Juegos.
- [ ] **Step 2: Run** `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`. Expected: PASS, incluidas las
  pruebas previas (daily, i18n, offline y touch-targets).
- [ ] **Step 3: Documentar en `README.md`.**
  - En la descripción, mencionar la sección Preguntas.
  - En «Estructura», agregar `quiz/  bancos de preguntas (un JSON por categoría) y su validación`.
  - Agregar la sección **«Cómo agregar preguntas»**:
    - editar `src/quiz/banks/<categoría>.json` con el id siguiente;
    - actualizar `manifest.ts`;
    - `npm run quiz:stats` y `npm test`;
    - remitir a `docs/quiz/guia-de-contenido.md`.
  - Repetir la regla de aplicar la migración antes de unir a `main`.
- [ ] **Step 4: Commit.** `git commit -m "test(quiz): end-to-end round, offline and touch targets; docs"`

---

### Tasks 12–15 y 17–24: Completar cada banco a 100 preguntas

Hay una tarea por categoría y cada una es independiente de las demás. Las **contables van primero** (12–15), para
que el equipo pueda revisar (Task 16) mientras se escribe la trivia (17–24).

| Task | Categoría | Enfoque (además de spec §3.1) |
|---|---|---|
| 12 | `concepts` | Ecuación contable; débitos y créditos por tipo de cuenta; causación vs. caja; ajustes (anticipados, causados, diferidos); depreciación (línea recta, saldos decrecientes, unidades); inventarios (PEPS/FIFO, promedio ponderado; UEPS no permitido en NIIF); balance de prueba y cierre; los 4 estados financieros; razones (liquidez corriente, prueba ácida, endeudamiento, márgenes, rotación de cartera) |
| 13 | `colombia` | Clases del PUC 1–9 (Decreto 2650 de 1993); Ley 1314 de 2009 y Decreto 2420 de 2015; grupos 1, 2 y 3 y NIIF para pymes; IVA: tarifa general del 19 % (Ley 1819 de 2016, con `asOf`), exento vs. excluido; retención en la fuente (agente retenedor, autorretención); ICA municipal; RUT y NIT; factura electrónica, documento soporte y nómina electrónica; revisor fiscal; libros oficiales. **Nunca** el valor de la UVT ni tarifas de retención por concepto |
| 14 | `us` | FASB, US GAAP vs. IFRS (p. ej., LIFO permitido en US GAAP); ASC 606 (los 5 pasos), ASC 842 y ASC 326/CECL; SEC, 10-K y 10-Q; usos de 1099-NEC, 1099-MISC, 1099-INT, W-9, W-2 y W-4; formularios 1120, 1120-S, 1065 y Schedule K-1; sales tax vs. use tax y nexus; QuickBooks: plan de cuentas, conciliar, *Undeposited Funds*, asientos de diario, clases y A/R Aging. **Nunca** topes en dólares ni tarifas anuales |
| 15 | `lending` | Capital e interés; interés simple vs. compuesto; amortización de cuota fija y tabla de amortización; tasa nominal, APR y APY; payoff e interés diario (*per diem*); prepago y penalidad; balloon e interest-only; LTV, DTI y DSCR; aging 30/60/90 y más de 90; mora vs. *default*; no causación (*non-accrual*); castigo y recuperaciones; provisión / *allowance* y CECL; servicing, escrow y cargos por mora; bases 30/360, actual/365 y actual/360; comisiones de originación; garantía y prelación de gravamen; vencimiento, extensión, *forbearance* y modificación |
| 17 | `history` | Antigüedad a siglo XX; América Latina e independencias; Colombia. Fechas y protagonistas, sin política actual |
| 18 | `science` | Física, química (tabla periódica), biología, astronomía y cuerpo humano |
| 19 | `geography` | Capitales, ríos, montañas, continentes y océanos; América Latina y Colombia; sin «el más poblado» cuando cambie con el tiempo |
| 20 | `math` | Conceptos, geometría, fracciones y porcentajes, series sencillas, matemáticos famosos; cálculos que se resuelvan de cabeza en 20 s |
| 21 | `arts` | Pintura y escultura, literatura universal y latinoamericana, música clásica, mitología grecorromana |
| 22 | `entertainment` | Cine, música y televisión con datos fijos (año de estreno, autor, ganadores de un año concreto); sin taquillas ni récords vigentes |
| 23 | `sports` | Mundiales y Olímpicos de años concretos, reglas, medidas de canchas y número de jugadores; sin récords vigentes |
| 24 | `technology` | Inventos e inventores, historia de la computación e internet, conceptos básicos (bit, byte, CPU, HTTP) |

**Files** (en cada tarea): Modify `src/quiz/banks/<categoría>.json` y `src/quiz/banks/manifest.ts`.

**Interfaces:**
- Consumes: el formato, `validateBank`, `npm run quiz:stats` y la guía de contenido (Tasks 1 y 2).
- Produces: el banco de la categoría con **exactamente 100 preguntas**: 40 de dificultad 1, 40 de dificultad 2 y
  20 de dificultad 3, con 25 o menos de verdadero/falso. Ids hasta `<cat>-0100`.

Pasos de cada tarea:
- [ ] **Step 1: Redactar** las 88 preguntas que faltan, en lotes de 50 como máximo por sesión de redacción.
  - Siguen `docs/quiz/guia-de-contenido.md` y el enfoque de la tabla.
  - Antes de escribir, se revisan las 12 existentes para no repetir el mismo hecho.
- [ ] **Step 2: Run** `npm run quiz:stats && npx vitest run src/quiz`. Expected: la línea de la categoría dice
  `total 100  fácil 40  media 40  difícil 20  v/f ≤25`, y las pruebas PASS (con el manifiesto actualizado a 100).
- [ ] **Step 3: Verificación independiente.** Un revisor nuevo, que no escribió el lote, revisa **cada pregunta**
  contra la lista de la guía:
  - dato correcto, con el conocimiento disponible y sin inventar fuentes;
  - una sola respuesta defendible;
  - distractores incorrectos pero creíbles;
  - dificultad bien asignada;
  - ES = EN;
  - sin datos que caduquen ni datos de empresas.

  En `colombia`, `us` y `lending` revisa además que no haya cifras anuales y que `asOf` aparezca donde haga falta.
  Entrega la lista de ids cambiados con su motivo.
- [ ] **Step 4: Aplicar las correcciones y repetir Step 2.** Expected: igual que en Step 2.
- [ ] **Step 5: Commit.** `git commit -m "content(quiz): complete the <category> bank (100 questions)"`

---

### Task 16: Hoja de revisión para el equipo contable

**Files:**
- Create (fuera del repositorio, en el directorio scratchpad de la sesión): `quiz-review.py` y
  `revision-preguntas-contables.xlsx`

**Interfaces:**
- Consumes: los bancos `concepts`, `colombia`, `us` y `lending` completos (Tasks 12–15).
- Produces: un `.xlsx` con una hoja por subcategoría y una fila por pregunta (400 en total).

- [ ] **Step 1: Generar el Excel** con Python y `openpyxl`. Si falta: `pip install openpyxl`, solo en la sesión.
  - Columnas: `id`, `subcategoría`, `dificultad`, `tipo`, `pregunta ES`, `respuesta correcta ES`,
    `otras opciones ES`, `explicación ES`, las mismas cuatro en EN, `vigente a (asOf)`, `OK / corrección` (vacía) y
    `comentario` (vacía).
  - Encabezado fijo, ajuste de texto y anchos legibles.
- [ ] **Step 2: Comprobar** que cada hoja tenga 100 filas de datos y que el id de cada fila exista en su banco.
  Run: `python3 quiz-review.py --check`. Expected: `concepts 100, colombia 100, us 100, lending 100`.
- [ ] **Step 3: Entregar la hoja al usuario** (con SendUserFile) y explicarle cómo diligenciarla: «OK» o la
  corrección propuesta en la columna `OK / corrección`. **La ejecución sigue con las Tasks 17–24 mientras el
  equipo revisa.**

---

### Task 25: Cierre del contenido

**Files:**
- Modify: `src/quiz/banks.test.ts`

**Interfaces:**
- Consumes: los 12 bancos completos (Tasks 12–15 y 17–24).

- [ ] **Step 1: Write the launch test:**
  ```ts
  test.each(ALL_CATEGORIES)('%s has the launch size: 100 questions, 40/40/20', (c) => {
    const qs = files[path(c)].questions;
    expect(qs).toHaveLength(100);
    expect(countBy(qs, 'difficulty')).toEqual({ 1: 40, 2: 40, 3: 20 });
  });
  test('the quiz launches with 1,200 questions', () => expect(Object.values(BANK_SIZES).reduce((a, b) => a + b, 0)).toBe(1200));
  ```
- [ ] **Step 2: Run** `npm test && npm run lint && npm run typecheck && npm run build`. Expected: todo PASS.
  `dist/sw.js` sigue listando los 12 bancos (repetir la comprobación de Task 2, Step 8).
- [ ] **Step 3: Commit.** `git commit -m "test(quiz): pin the launch size of every bank"`

---

### Task 26: Correcciones del equipo y preparación para publicar

**Files:**
- Modify: `src/quiz/banks/{concepts,colombia,us,lending}.json` según la hoja devuelta

**Interfaces:**
- Consumes: la hoja diligenciada por el equipo (Task 16).

- [ ] **Step 1: Aplicar las correcciones.**
  - Si una pregunta se corrige, conserva su id.
  - Si se descarta, se reemplaza por otra nueva con el id siguiente (nunca se reutiliza el borrado), de la misma
    dificultad, para mantener el reparto 40/40/20.
  - Las preguntas nuevas pasan por una verificación independiente (como en el Step 3 de las tareas de contenido)
    y vuelven al equipo en una hoja corta, solo con esas filas.
- [ ] **Step 2: Run** `npm test && npm run lint && npm run typecheck`, y con Supabase local
  `npm run db:reset && npm run db:test && npm run test:integration`, y luego
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`. Expected: todo PASS.
- [ ] **Step 3: Commit.** `git commit -m "content(quiz): apply the accounting team's review"`
- [ ] **Step 4: Lista de publicación**, para entregar al usuario. No la ejecuta Claude sin su permiso:
  1. Aplicar `supabase/migrations/20261102000000_quiz_games.sql` en el proyecto real (`SETUP.md`, paso 2).
  2. Abrir el pull request de esta rama contra `main`, solo cuando el usuario lo pida.
  3. Unir el pull request. La publicación en GitHub Pages es automática.

## Después de este plan

Queda pendiente, si el equipo lo pide:
- más preguntas, con el mismo proceso: guía de contenido → verificación → revisión contable;
- un botón «Reportar pregunta»;
- un modo sin tiempo;
- publicar la trivia antes que la parte contable (spec §8).
