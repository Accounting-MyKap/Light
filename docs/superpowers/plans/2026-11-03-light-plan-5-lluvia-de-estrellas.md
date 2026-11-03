# Plan 5: juego «Lluvia de estrellas» — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a Light el juego de Matemáticas «Lluvia de estrellas» (`star-shower`). Caen estrellas con operaciones, se responde escribiendo el resultado, el cometa dorado despeja la pantalla y la partida termina al perder 3 estrellas.

**Architecture:** Un motor puro (`engine.ts`) calcula todo en función del tiempo del juego: nacimientos, alturas, aterrizajes, pausas y fin. La pantalla corre un ciclo `requestAnimationFrame` sobre el reloj de juego existente (`useGameClock`). En cada cuadro llama a `advance` y escribe la altura de cada estrella directamente en su elemento; React solo vuelve a dibujar cuando el motor devuelve un estado nuevo. La escala de operaciones y el teclado en pantalla de Cálculo relámpago pasan a piezas compartidas. `GameFrame` aprende a mostrar vidas.

**Tech Stack:** React 19, TypeScript, CSS Modules, i18next, Vitest + Testing Library (jsdom; `vi.useFakeTimers()` también controla `requestAnimationFrame`, ya comprobado), Playwright, Supabase (pgTAP).

**Spec:** `docs/superpowers/specs/2026-11-03-light-lluvia-de-estrellas-design.md`

## Global Constraints

- Valores del spec (en `engine.ts`, exportados): 3 columnas; 3 vidas; pausa tras estrella perdida de 1500 ms; tope de 300 000 ms; cometa con probabilidad 0,1 y nunca dos a la vez; intervalo entre estrellas de 3200 → 1400 ms y caída de 9000 → 6000 ms, lineales en los primeros 150 000 ms de ritmo y fijos después; hasta 50 intentos para un resultado único y, si no, aplazar 200 ms; respuesta de hasta 3 cifras; puntos por estrella = 10 + su nivel; `STAR_SHOWER_REFERENCE_SCORE = 600`; `STAR_SHOWER_MAX_SCORE = 4000`. El 1 s de espera al final lo maneja `Game.tsx`.
- Un número equivocado **no resta puntos**. Perder una estrella **no toca la escalera de nivel**.
- Textos en español e inglés con las mismas claves; `src/i18n/i18n.test.ts` y `src/games/registry.test.ts` lo comprueban. Sin afirmaciones médicas.
- Sin dependencias nuevas. Sin canvas ni librerías de animación.
- Los otros cinco juegos se ven y funcionan igual. Las pruebas de Cálculo relámpago siguen pasando, salvo las de operaciones, que se mueven de archivo sin cambiar.
- Objetivos táctiles de al menos 44 px. Sin desplazamiento lateral a 320 px de ancho.
- Con `prefers-reduced-motion: reduce`, las estrellas siguen cayendo, pero sin estelas, chispas, sacudidas ni destellos, y el fondo no titila (spec §4.3).
- No se toca el proyecto real de Supabase del dueño: la migración solo se agrega al repositorio.
- Antes de cada commit: `npm run lint`, `npm run typecheck` y `npm test`, todos en verde.
- Toda tarea con cambios visibles termina con capturas propias a 390×844 de lo que tocó, guardadas en `test-results/star-dev/` (ignorado por git). El implementador las mira y las nombra en su reporte.
  - Servidor: `npm run build && (setsid npm run preview -- --port 4173 --strictPort > /dev/null 2>&1 &)`.
  - Para detenerlo: `fuser -k 4173/tcp`. **Nunca** `pkill -f "vite preview"`, que mata la propia terminal.
  - Chromium está en `/opt/pw-browsers/chromium`. Los scripts importan `/home/user/Light/node_modules/playwright/index.mjs` y lanzan con `executablePath: '/opt/pw-browsers/chromium'`.
  - La app vive en `http://localhost:4173/Light/#/play/star-shower`.

## Rulings sobre el spec

- **Sin `nextEventAt`.** `advance(state, now, rng)` devuelve **el mismo objeto** de estado (y sin eventos) cuando no venció nada, y la pantalla lo llama en cada cuadro. Así se cumple lo que pedía `nextEventAt` (redibujar solo con eventos) con una función menos.
- **El primer nacimiento ocurre en el tiempo 0**: `createStarShower` deja `nextSpawnAt = 0` y el primer `advance` crea la estrella.
- **Tiempo de ritmo de un nacimiento** = tiempo del nacimiento − `breakMs`, el total de las pausas ya terminadas. No nacen estrellas durante una pausa, así que no hace falta más.
- **Responder primero avanza el motor.** La acción de enviar llama a `advance(state, now)` antes de `submitAnswer(state)`. Así, una estrella que ya tocó el horizonte en ese instante cuenta como perdida y no se puede responder. Por eso `submitAnswer` no recibe `now`.
- **Enviar sin estrellas en pantalla, o con la partida terminada, no hace nada**: `outcome` es `null` y la respuesta escrita se conserva. Esto incluye la pausa tras una pérdida y el cielo vacío después de un cometa.
- **Altura en pantalla:** cada estrella va en `top: <altura × 100>%` del cielo, anclada por su borde inferior (`transform: translate(-50%, -100%)`), así que con altura 1 toca el horizonte. El ciclo de animación escribe `style.top`.
- **La espera de 1 s al final se mide con el reloj del juego** dentro del ciclo de animación, así que la pausa también la detiene.
- **Los estallidos y destellos son solo visuales.** `Game.tsx` los guarda en su estado local y los quita con un `setTimeout` real de 600 ms. El motor no sabe de ellos.
- **`starShowerResult(state)`** exige `endedAt !== null`, y `durationMs = endedAt`.

## Review Focus

1. **Un salto grande de tiempo** (un teléfono lento, un cuadro atrasado, el reloj falso de las pruebas). `advance` debe procesar nacimientos, aterrizajes, pausas y el tope **en orden cronológico**, de modo que llamar `advance` una vez de 0 a 40 000 ms dé el mismo estado que avanzar de 16 en 16 ms. Prueba: Tarea 4.
2. **Escribir durante la pausa o con el cielo vacío tras un cometa.** Enter no hace nada, el número escrito queda y no cuenta como equivocado. Prueba: Tarea 3.
3. **Resultado 0 y ceros a la izquierda.** El nivel 2 puede dar `5 − 5 = 0`. Escribir «0» y Enter revienta esa estrella; «0» seguido de «7» queda «7». Prueba: Tarea 3.
4. **Pausar justo cuando se pierde la tercera estrella o durante el segundo final.** `onFinish` se llama una sola vez y solo después de continuar. Y una estrella pausada a media caída sigue desde la misma altura. Prueba: Tarea 5.
5. **La operación más larga (`20 + 9 × 9`) en un teléfono de 320 px**, en una de las 3 columnas: no sale del cielo ni crea desplazamiento lateral. Prueba: E2E de la Tarea 8, con el nivel inicial puesto en 10.

---

### Task 1: Operaciones y teclado compartidos

**Files:**
- Create: `src/games/shared/arithmetic.ts`, `src/games/shared/arithmetic.test.ts`
- Create: `src/games/shared/Keypad.tsx`, `src/games/shared/Keypad.module.css`
- Modify: `src/games/quick-math/engine.ts` (quitar `Op`, `Problem`, `makeProblem`, `formatProblem` y las funciones auxiliares `add`, `sub`, `mul`; importarlas)
- Modify: `src/games/quick-math/engine.test.ts` (quitar las pruebas de tabla de niveles y de `formatProblem`, con `evaluate`, `inRange` y `RULES`)
- Modify: `src/games/quick-math/Game.tsx` (importar `formatProblem` y `Keypad` de `../shared`)
- Modify: `src/games/quick-math/quick-math.module.css` (quitar `.keypad`, `.key`, `.key:active`, `.ok` y la regla `.key:active` del bloque de movimiento reducido)
- Delete: `src/games/quick-math/Keypad.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**
- Produces:
  - `src/games/shared/arithmetic.ts`: `type Op = '+' | '-' | '×' | '÷' | '+×'`; `interface Problem { a: number; b: number; c?: number; op: Op; answer: number }`; `makeProblem(level: number, rng: Rng): Problem`; `formatProblem(p: Problem): string`. Mismo código que hoy en Cálculo relámpago.
  - `src/games/shared/Keypad.tsx`: `Keypad({ onDigit, onDelete, onSubmit }: { onDigit: (digit: number) => unknown; onDelete: () => unknown; onSubmit: () => unknown })`. Mismo marcado que hoy; la etiqueta de ⌫ es `t('game.keypad.delete')` y el texto de OK es `t('game.keypad.ok')`.
  - Claves i18n `game.keypad.delete` («Borrar» / «Delete») y `game.keypad.ok` («OK» / «OK»), copiadas de `games.quick-math.delete|ok`, que se borran.

- [ ] **Step 1: Mover las pruebas de operaciones**

Crea `src/games/shared/arithmetic.test.ts` con las pruebas que hoy están en `src/games/quick-math/engine.test.ts`: `inRange`, `evaluate`, `RULES`, `test.each(... 'level %d problems respect the table')` y `test('formatProblem')`, sin cambios, importando de `./arithmetic`. Quítalas de `engine.test.ts`.

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run src/games/shared/arithmetic.test.ts`
Expected: FAIL, porque no se encuentra `./arithmetic`.

- [ ] **Step 3: Mover el código**

Mueve los tipos y funciones a `src/games/shared/arithmetic.ts`. El motor y la pantalla de Cálculo relámpago los importan desde ahí. Mueve también `Keypad` y sus estilos a `src/games/shared/`, cambia las claves de texto y borra `src/games/quick-math/Keypad.tsx`. En `Keypad.module.css` va el bloque de movimiento reducido para `.key:active` que antes estaba en `quick-math.module.css`.

- [ ] **Step 4: Ver que todo pasa**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS. Las pruebas de `src/games/quick-math/Game.test.tsx` siguen encontrando «Borrar» y «OK», y `src/i18n/i18n.test.ts` confirma que las claves coinciden en ambos idiomas.

- [ ] **Step 5: Commit**

```bash
git add -A src/games/shared src/games/quick-math src/i18n
git commit -m "refactor(games): share the arithmetic scale and the keypad"
```

---

### Task 2: Vidas en el marco y dorado de Luz

**Files:**
- Modify: `src/games/shared/GameFrame.tsx`, `src/games/shared/GameFrame.module.css`
- Modify: `src/games/shared/luz/luz.css` (bloque `[data-luz]`)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (`game.hud.lives`)
- Test: `src/games/shared/GameFrame.test.tsx`, `src/app/contrast.test.ts`

**Interfaces:**
- Produces:
  - En `GameFrameProps`, la opción nueva `lives?: { left: number; total: number }`. Se dibuja en la fila de progreso, donde van `TimeBar` y `RoundDots`, como `<ol role="list" aria-label={t('game.hud.lives', { left, total })}>` con `total` elementos `<li data-state="on|off">`. Los primeros `left` van `on`.
  - El token `--luz-gold: #ffd34d` en el bloque `[data-luz]`.
  - `game.hud.lives`: «Vidas: {{left}} de {{total}}» / «Lives: {{left}} of {{total}}».

- [ ] **Step 1: Escribir las pruebas que fallan**

En `GameFrame.test.tsx`:

```tsx
test('lives: one item per life, the lost ones off, with an accessible count', () => {
  render(frame({ lives: { left: 2, total: 3 } }));
  const list = screen.getByRole('list', { name: 'Vidas: 2 de 3' });
  const states = Array.from(list.querySelectorAll('li')).map((li) => li.dataset.state);
  expect(states).toEqual(['on', 'on', 'off']);
});
```

En `contrast.test.ts`, dentro del `describe` de Luz:

```ts
test('--luz-gold on --luz-bg meets 3:1', () => {
  expect(contrast(luz['luz-gold'], luz['luz-bg'])).toBeGreaterThanOrEqual(3);
});
test('--luz-ink on --luz-gold meets WCAG AA (4.5:1)', () => {
  expect(contrast(luz['luz-ink'], luz['luz-gold'])).toBeGreaterThanOrEqual(4.5);
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/games/shared/GameFrame.test.tsx src/app/contrast.test.ts`
Expected: FAIL. No existe la lista «Vidas: 2 de 3» y `luz['luz-gold']` es `undefined`.

- [ ] **Step 3: Implementar**

Agrega `Lives`, que se dibuja como `RoundDots`. Cada `li` es una estrellita de 12 px del color `--game` con halo si está `on`, o solo un contorno `rgba(255,255,255,.25)` si está `off`. Agrega el token y los textos.

- [ ] **Step 4: Ver que pasan**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/shared src/app/contrast.test.ts src/i18n
git commit -m "feat(games): lives in the game frame and the Luz gold token"
```

---

### Task 3: Motor — estrellas, ritmo y respuestas

**Files:**
- Create: `src/games/star-shower/engine.ts`
- Test: `src/games/star-shower/engine.test.ts`

**Interfaces:**
- Consumes: `makeProblem`, `Problem` (Task 1); `createStaircase`, `stepStaircase`, `Staircase` (`src/core/difficulty.ts`); `Rng`, `pick` (`src/core/rng.ts`); `accuracyOf` (`src/games/shared/scoring.ts`).
- Produces (`src/games/star-shower/engine.ts`):

```ts
export const LANES = 3;
export const LIVES = 3;
export const BREAK_MS = 1500;
export const MAX_GAME_MS = 300_000;
export const COMET_CHANCE = 0.1;
export const PACE_RAMP_MS = 150_000;
export const MAX_INPUT_DIGITS = 3;
export const UNIQUE_TRIES = 50;
export const RETRY_SPAWN_MS = 200;
export const STAR_SHOWER_MAX_SCORE = 4000;
export const STAR_SHOWER_REFERENCE_SCORE = 600;

export interface Star {
  id: number;
  problem: Problem;
  level: number;   // nivel con el que se creó; vale 10 + level puntos
  lane: number;    // 0..LANES-1
  bornAt: number;  // ms de tiempo del juego
  fallMs: number;
  comet: boolean;
}

export interface StarShowerState {
  stars: Star[];
  nextId: number;
  nextSpawnAt: number;
  lastLane: number | null;
  lives: number;
  breakUntil: number | null;  // fin de la pausa en curso
  breakMs: number;            // total de pausas terminadas
  staircase: Staircase;
  input: string;
  score: number;
  correct: number;
  wrong: number;
  lost: number;
  endedAt: number | null;
}

export type StarShowerEvent =
  | { kind: 'spawn'; star: Star }
  | { kind: 'lost'; star: Star; cleared: Star[] }
  | { kind: 'over'; reason: 'lives' | 'time' };

export type Outcome =
  | { kind: 'hit'; popped: Star[]; points: number }
  | { kind: 'comet'; popped: Star[]; points: number }
  | { kind: 'wrong' };

export function paceAt(paceMs: number): { intervalMs: number; fallMs: number };
export function createStarShower(startLevel: number, rng: Rng): StarShowerState;
export function advance(state: StarShowerState, now: number, rng: Rng): { state: StarShowerState; events: StarShowerEvent[] };
export function starHeight(star: Star, now: number): number;   // entre 0 y 1
export function typeDigit(state: StarShowerState, digit: number): StarShowerState;
export function deleteDigit(state: StarShowerState): StarShowerState;
export function submitAnswer(state: StarShowerState): { state: StarShowerState; outcome: Outcome | null };
export function starShowerResult(state: StarShowerState): GameResult;
```

La Tarea 3 implementa `advance` solo para los nacimientos. La Tarea 4 le agrega aterrizajes, pausas y tope, sin cambiar la firma.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `engine.test.ts`, define una ayuda `star(partial: Partial<Star>): Star`, que completa una estrella con `problem: { a: 1, b: 1, op: '+', answer: 2 }`, `level: 1`, `lane: 0`, `bornAt: 0`, `fallMs: 9000` y `comet: false`, y una ayuda `typed(state, text)` que llama a `typeDigit` por cada cifra. Pruebas:

```ts
test('pace: 3200/9000 at start, 2300/7500 halfway, 1400/6000 from 150 s on', () => {
  expect(paceAt(0)).toEqual({ intervalMs: 3200, fallMs: 9000 });
  expect(paceAt(75_000)).toEqual({ intervalMs: 2300, fallMs: 7500 });
  expect(paceAt(150_000)).toEqual({ intervalMs: 1400, fallMs: 6000 });
  expect(paceAt(400_000)).toEqual({ intervalMs: 1400, fallMs: 6000 });
});

test('the first star is born at 0, the next one an interval later', () => {
  const rng = createRng(1);
  const first = advance(createStarShower(1, rng), 0, rng);
  expect(first.state.stars).toHaveLength(1);
  expect(first.state.stars[0]).toMatchObject({ bornAt: 0, fallMs: 9000, level: 1 });
  expect(first.events.map((e) => e.kind)).toEqual(['spawn']);
  expect(advance(first.state, 3199, rng).state).toBe(first.state); // nada venció: el mismo objeto
  expect(advance(first.state, 3200, rng).state.stars[1].bornAt).toBe(3200);
});

test('over many spawns: lane never repeats, answers on screen are unique, at most one comet, ~10 % comets', () => {
  // Simula 20 semillas × 150 s desde el nivel 1, con pasos de 100 ms, respondiendo todas las estrellas cada 2 s.
  // Revisa cada evento 'spawn': lane !== lane anterior, 0 <= lane < 3.
  // Revisa en cada paso: respuestas únicas y como mucho un cometa.
  // Con más de 1000 nacimientos, los cometas son entre el 5 % y el 15 %.
});

test('a spawn that cannot get a unique answer waits 200 ms', () => {
  // Pantalla con 17 estrellas cuyas respuestas son 2..18 (todas las del nivel 1), nextSpawnAt 5000.
  // advance(s, 5000): no nace ninguna (siguen 17) y nextSpawnAt === 5200.
});

test('a right answer pops its star and scores 10 + its level', () => {
  const s = { ...createStarShower(1, createRng(1)), stars: [star({ id: 1, level: 3, problem: { a: 4, b: 3, op: '+', answer: 7 } })] };
  const { state, outcome } = submitAnswer(typed(s, '7'));
  expect(outcome).toEqual({ kind: 'hit', popped: [s.stars[0]], points: 13 });
  expect(state).toMatchObject({ stars: [], score: 13, correct: 1, input: '' });
});

test('the comet pops every star and scores each one', () => {
  // Pantalla: un cometa (respuesta 9, nivel 2) y dos estrellas (niveles 1 y 4).
  // Al escribir 9: outcome 'comet', se revientan las 3, puntos (12 + 11 + 14) = 37, correct = 1, stars = [].
});

test('a wrong number costs nothing, clears the input and counts for accuracy and the staircase', () => {
  // Una estrella con respuesta 7. Escribir 8 y enviar: outcome { kind: 'wrong' }, score sin cambio,
  // input '', wrong = 1, la estrella sigue ahí.
  // Dos equivocados seguidos desde el nivel 3 bajan a 2.
});

test('Enter does nothing with an empty input, an empty sky or a finished game', () => {
  // Sin respuesta escrita: outcome null y el mismo estado.
  // Con '7' escrito y stars = []: outcome null, input sigue '7', wrong sigue 0.
  // Con endedAt !== null: outcome null.
});

test('answer 0 and leading zeros', () => {
  // Una estrella con respuesta 0. Escribir '0' y enviar: hit.
  // typed(s, '07').input === '7'; con '123' escrito, otra cifra se ignora (3 cifras como máximo);
  // deleteDigit quita la última.
});

test('four right answers in a row move the level up; new stars use it', () => {
  // Desde el nivel 1, cuatro aciertos dejan staircase.level === 2.
  // La siguiente estrella que nace tiene level 2.
});

test('result: accuracy over right + wrong + lost, duration = endedAt', () => {
  const s = { ...createStarShower(4, createRng(1)), correct: 6, wrong: 1, lost: 3, score: 90, endedAt: 42_000 };
  expect(starShowerResult(s)).toEqual({ score: 90, accuracy: 0.6, levelReached: 4, durationMs: 42_000 });
});
```

Las pruebas descritas con comentarios se escriben con esos datos y esas aserciones exactas.

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/games/star-shower/engine.test.ts`
Expected: FAIL, porque no se encuentra `./engine`.

- [ ] **Step 3: Implementar**

Un nacimiento en el tiempo `t`, con `pace = paceAt(t - breakMs)`:

1. Genera `makeProblem(staircase.level, rng)` hasta que su `answer` no esté en pantalla, con un máximo de `UNIQUE_TRIES` intentos. Si no lo logra, deja `nextSpawnAt = t + RETRY_SPAWN_MS` y no crea la estrella.
2. La columna es `pick(rng, columnas distintas de lastLane)`.
3. `comet = !stars.some((s) => s.comet) && rng() < COMET_CHANCE`.
4. `nextSpawnAt = t + pace.intervalMs`.

`submitAnswer` hace `stepStaircase(…, true)` una vez por acierto, también con el cometa, y `stepStaircase(…, false)` por cada número equivocado. `starHeight` = `(now - bornAt) / fallMs`, limitada entre 0 y 1.

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/games/star-shower/engine.test.ts && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/star-shower
git commit -m "feat(star-shower): engine for spawning, pace and answers"
```

---

### Task 4: Motor — estrellas perdidas, fin y cotas

**Files:**
- Modify: `src/games/star-shower/engine.ts` (`advance`)
- Test: `src/games/star-shower/engine.test.ts`

**Interfaces:**
- Consumes: todo lo de la Tarea 3.
- Produces: `advance` completo según la regla de abajo. Las firmas no cambian.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('a star reaching the horizon costs a life, clears the sky without points and opens a 1.5 s break', () => {
  // Nivel 1, semilla fija; avanzar hasta 9000 (la primera estrella llega al horizonte).
  // Eventos en ese advance: [..., { kind: 'lost', star: primera, cleared: [las otras dos] }].
  // Estado: lives 2, lost 1, stars [], score 0, wrong 0, breakUntil 10_500,
  // nivel sin cambio y rachas de la escalera sin cambio.
  // advance(…, 10_499): sin estrellas. advance(…, 10_500): nace una, con bornAt 10_500
  // y fallMs = paceAt(9000).fallMs (el ritmo sigue donde estaba).
});

test('the third lost star ends the game at that moment, with no break', () => {
  // Sin responder nada, avanzar hasta 60_000.
  // Hay exactamente 3 eventos 'lost' y luego { kind: 'over', reason: 'lives' }.
  // lives 0, breakUntil null, endedAt = bornAt + fallMs de la tercera.
  // No depende de la semilla: pérdidas en 9000, 19_320 y endedAt toBeCloseTo(29_463.6) (spec §6.1).
  // Un advance posterior devuelve el mismo objeto.
});

test('the 5-minute cap ends the game', () => {
  // Juego perfecto (responder cada estrella apenas nace) hasta 300_000:
  // evento { kind: 'over', reason: 'time' } y endedAt 300_000.
});

test('a perfect 5-minute game stays under the max score', () => {
  // Juego perfecto desde el nivel 10, pasos de 100 ms hasta el fin.
  // Nacimientos <= 176 y score <= STAR_SHOWER_MAX_SCORE.
});

// Review Focus #1
test('one big jump equals many small steps', () => {
  // Misma semilla y mismo nivel, sin responder.
  // advance(s0, 40_000, rngA) en una llamada contra advance cada 16 ms hasta 40_000 con rngB (misma semilla):
  // mismo estado final (toEqual) y la misma secuencia de tipos de evento.
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/games/star-shower/engine.test.ts`
Expected: FAIL. Hoy `advance` no registra pérdidas.

- [ ] **Step 3: Implementar el orden de eventos en `advance`**

Es el algoritmo que las firmas no determinan:

```ts
// Repite mientras endedAt === null:
//   landing  = el menor (bornAt + fallMs) de las estrellas en pantalla, o Infinity
//   breakEnd = breakUntil ?? Infinity
//   spawnAt  = breakUntil === null ? nextSpawnAt : Infinity
//   t = Math.min(landing, breakEnd, spawnAt, MAX_GAME_MS); si t > now, termina.
//   Con empate se procesa en este orden:
//   1. landing === t: lost + 1, lives - 1, stars = [], evento 'lost' (cleared = las demás).
//      Si lives === 0: endedAt = t y evento 'over' 'lives'. Si no: breakUntil = t + BREAK_MS.
//   2. breakEnd === t: breakMs += BREAK_MS, breakUntil = null, nextSpawnAt = t.
//   3. spawnAt === t: nacimiento en t (Tarea 3).
//   4. t === MAX_GAME_MS: endedAt = MAX_GAME_MS y evento 'over' 'time'.
// Devuelve el mismo objeto de estado si no se procesó nada.
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/games/star-shower/engine.test.ts && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/star-shower
git commit -m "feat(star-shower): lost stars, breaks, end of game and score bound"
```

---

### Task 5: Pantalla del juego

**Files:**
- Create: `src/games/star-shower/Game.tsx`, `src/games/star-shower/Sky.tsx`, `src/games/star-shower/star-shower.module.css`
- Test: `src/games/star-shower/Game.test.tsx`

**Interfaces:**
- Consumes: el motor (Tareas 3–4); `Keypad` y `formatProblem` (Tarea 1); `GameFrame` con `lives` (Tarea 2); `useGameClock`, `useGameKeys`, `useFeedback`, `createRng`, `randomSeed`, `prefersReducedMotion`.
- Produces:
  - `StarShowerGame(props: GameProps)` en `Game.tsx`. Constante `END_HOLD_MS = 1000`.
  - `Sky` en `Sky.tsx`, con estas propiedades:

```ts
interface Burst { key: number; star: Star; height: number; kind: 'pop' | 'clear' }
interface SkyFlash { key: number; kind: 'comet' | 'loss'; lane?: number }
interface SkyProps {
  stars: readonly Star[];
  now: number;                      // para la altura inicial de cada estrella
  bursts: readonly Burst[];
  flash: SkyFlash | null;
  input: string;
  wrongKey: number;                 // cambia con cada número equivocado (reinicia la sacudida)
  registerStar: (id: number, el: HTMLElement | null) => void;
}
```

  - Marcado que usan las pruebas:
    - Cada estrella es `<div data-testid="star" data-comet="true|false" data-lane={lane}>` y su texto es exactamente `formatProblem(problem)`. El cometa lleva además un ✦ con `aria-hidden`.
    - La ranura es `<span data-testid="answer" data-empty data-wrong>`.
    - El horizonte es `data-testid="horizon"`.
    - El cielo va con `aria-hidden="true"`, porque no se anuncia (spec §4.3).

- [ ] **Step 1: Escribir las pruebas que fallan**

Igual que en `quick-math/Game.test.tsx`: `initI18n('es')`, `vi.useFakeTimers()`, `renderGame()` dentro de `FeedbackProvider`, `advance = (ms) => act(() => vi.advanceTimersByTime(ms))` y `hud(label)`. Agrega una ayuda `solve(text)` para «a + b» (nivel 1).

```tsx
test('a star appears and falls', () => {
  renderGame();
  advance(50);
  const star = screen.getByTestId('star');
  const top0 = parseFloat(star.style.top);
  advance(4500);
  expect(parseFloat(star.style.top)).toBeGreaterThan(top0 + 40); // ~50 % del cielo a los 4,5 s
});

test('typing the answer on the keyboard pops the star and scores 11', () => {
  renderGame();
  advance(50);
  for (const d of String(solve(screen.getByTestId('star').textContent!))) fireEvent.keyDown(window, { key: d });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(hud('Puntos')).toBe('11');
  expect(screen.queryAllByTestId('star')).toHaveLength(0);
});

test('the on-screen keypad answers too', () => {
  // Lo mismo con los botones de cifras y «OK».
});

test('a wrong number keeps the score, empties the slot and marks it wrong', () => {
  // Escribe (respuesta + 1) y Enter: Puntos 0, answer '?', data-wrong cambia, la estrella sigue ahí.
});

test('paused: stars stop and no new ones are born', () => {
  // advance(1000) y rerender con paused = true; guarda top y número de estrellas.
  // advance(10_000): mismo top y mismo número. rerender con paused = false: vuelve a moverse desde ese top.
});

test('three lost stars end the game once, one second after the third', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(9100);
  expect(screen.getByRole('list', { name: 'Vidas: 2 de 3' })).toBeInTheDocument();
  advance(60_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 0, accuracy: 0, levelReached: 1 });
  expect(onFinish.mock.calls[0][0].durationMs).toBeCloseTo(29_463.6, 0);
});

// Review Focus #4
test('pausing during the last second delays the end until resumed', () => {
  // Juega hasta justo después de la tercera pérdida y antes de pasar END_HOLD_MS.
  // rerender con paused = true; advance(5000): onFinish no se llama.
  // rerender con paused = false; advance(1100): onFinish se llama una sola vez.
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/games/star-shower/Game.test.tsx`
Expected: FAIL, porque no se encuentra `./Game`.

- [ ] **Step 3: Implementar**

- **Estado.** El estado del motor vive en `useState` y se copia en una referencia para el ciclo de animación. Mientras `!paused` y la partida no haya avisado su fin, un efecto corre `requestAnimationFrame`. En cada cuadro:
  1. `now = clock.now()`.
  2. `advance(ref, now, rng)`. Si devolvió otro objeto, lo guarda (`setGame`) y atiende los eventos: un `'lost'` da `feedback('timeout')`, un destello `loss` en su columna y estallidos `clear` para `cleared`.
  3. Escribe `style.top` de cada estrella registrada.
  4. Si `endedAt !== null` y `now >= endedAt + END_HOLD_MS`, llama una sola vez a `onFinish(starShowerResult(state))` y se detiene.
- **Acciones.** Siguen el patrón de `quick-math/Game.tsx` (cada acción dice si usó la tecla). Enviar llama a `advance(now)` antes de `submitAnswer` (ver Rulings).
  - `hit` da `feedback('correct')` y estallidos `pop`.
  - `comet` da además un destello `comet`.
  - `wrong` da `feedback('wrong')` y aumenta `wrongKey`.
- **Marco.** `GameFrame` recibe `score`, `level = staircase.level`, `lives = { left: lives, total: LIVES }` y `controls = <Keypad …/>`.
- **Estilos** según spec §4.1–4.3:
  - Las 3 columnas centradas en 1/6, 3/6 y 5/6 del ancho del cielo.
  - Estrella: esfera `--game` con texto `--luz-ink`, `white-space: nowrap`, halo y estela con `::before`.
  - Cometa: `--luz-gold`, más grande, con estela larga.
  - Horizonte: línea luminosa con suelo oscuro.
  - Ranura: igual a la de Cálculo relámpago, con una sacudida y `--luz-bad` cuando `data-wrong` cambia.
  - Estallidos y destellos de 400–600 ms, y puntitos fijos de fondo con un titileo suave.
  - En `@media (prefers-reduced-motion: reduce)`: sin estela, sin chispas ni sacudida ni titileo; los estallidos solo se desvanecen.

- [ ] **Step 4: Ver que pasan**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/star-shower
git commit -m "feat(star-shower): game screen with falling stars, keypad and lives"
```

---

### Task 6: El juego en la app: ficha, ejemplo, miniatura y textos

**Files:**
- Create: `src/games/star-shower/Example.tsx`, `src/games/star-shower/Example.test.tsx`, `src/games/star-shower/Thumb.tsx`, `src/games/star-shower/index.ts`
- Modify: `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`
- Modify: `src/games/penaltyCopy.test.ts`, `src/screens/GamesScreen.test.tsx`

**Interfaces:**
- Consumes: `StarShowerGame` (Tarea 5); `GameThumb` (`src/games/shared/GameThumb.tsx`); las constantes de puntaje (Tarea 3).
- Produces:
  - `starShowerGame: GameDefinition = { id: 'star-shower', area: 'math', referenceScore: STAR_SHOWER_REFERENCE_SCORE, maxScore: STAR_SHOWER_MAX_SCORE, Component: StarShowerGame, Example: StarShowerExample, Thumb: StarShowerThumb }`. Se agrega a `GAMES` después de `quickMathGame`.
  - Los textos `games.star-shower.title|skill|description|instructions`, copiados tal cual de la tabla del spec §4.5. `instructions` es una lista de 3 frases.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `penaltyCopy.test.ts`:

```ts
test('star-shower instructions say a wrong number costs nothing (es and en)', () => {
  expect(dicts.es.games['star-shower'].instructions.join(' ')).toMatch(/no resta/);
  expect(dicts.en.games['star-shower'].instructions.join(' ')).toMatch(/costs no points/);
});
```

En `GamesScreen.test.tsx`, la primera prueba pasa de `toHaveLength(5)` a `toHaveLength(6)` en las tarjetas (`heading` de nivel 3). Las secciones (`h2s`) siguen siendo 5.

En `Example.test.tsx`, con `setReducedMotion` como en `src/games/quick-math/Example.test.tsx` (en jsdom no existe `matchMedia`, y sin simularlo `prefersReducedMotion()` da `true`):

```tsx
test('the example moves, and stays still with reduced motion', () => {
  // Sin movimiento reducido: el contenedor tiene data-animated="true" y muestra 2 estrellas y un cometa.
  // Con movimiento reducido: data-animated="false".
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/games/penaltyCopy.test.ts src/screens/GamesScreen.test.tsx src/games/star-shower/Example.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- **Ejemplo:** escena de cielo en bucle hecha solo con CSS (spec §4.4). Dos estrellas (`7 + 5` y `4 + 3`) y un cometa (`6 + 2`) caen; la ranura muestra `12`; la de `7 + 5` estalla y luego estalla todo. Usa las clases de `star-shower.module.css`. Con `prefersReducedMotion()` queda fija.
- **Miniatura:** `<GameThumb area="math">` con un SVG `viewBox="0 0 24 24"`: una estrella con estela en `currentColor` y un cometa pequeño con `fill="#ffd34d"`.

- [ ] **Step 4: Ver que pasan**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS. `registry.test.ts` confirma los textos en ambos idiomas y `GameThumb.test.tsx` confirma que la miniatura es decorativa.

- [ ] **Step 5: Capturas de desarrollo**

Con el servidor de las Global Constraints, a 390×844 y en español, guarda en `test-results/star-dev/`:
- `catalog.png`: la sección Matemáticas de `#/games`, con las dos tarjetas.
- `intro.png`: las instrucciones con el ejemplo.
- `play.png`: unos 5 s después de «Comenzar».
- `comet.png`, si sale un cometa durante esos 20 s.

Míralas y nómbralas en el reporte.

- [ ] **Step 6: Commit**

```bash
git add src/games src/i18n src/screens/GamesScreen.test.tsx
git commit -m "feat(star-shower): register the game with its example, thumbnail and texts"
```

---

### Task 7: Fila en Supabase

**Files:**
- Create: `supabase/migrations/20261103000100_star_shower.sql`
- Modify: `supabase/tests/01_core_schema.test.sql`

**Interfaces:**
- Produces: la fila `('star-shower', 'math', 4000)` en `public.games`, igual a `maxScore` del registro.

- [ ] **Step 1: Actualizar la prueba pgTAP**

En `01_core_schema.test.sql`:
- Agrega `('star-shower', 'math', 4000)` al `results_eq` de los juegos, en el orden `collate "C"`: va después de `sequence-lights`.
- Cambia el mensaje a `'games holds the 6 games with their score bounds'`.
- Cambia la cuenta de `'anon can read games'` de 5 a 6.

- [ ] **Step 2: Escribir la migración**

```sql
-- max_score matches maxScore in the game registry (src/games).
insert into public.games (id, area, max_score) values ('star-shower', 'math', 4000);
```

- [ ] **Step 3: Verificar contra el Supabase local**

Run, con Docker como dice el README:
`dockerd > /tmp/dockerd.log 2>&1 &`, luego `export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io && npm run db:start && npm run db:reset && npm run db:test && npm run test:integration`

Expected: todas las pruebas pgTAP pasan, y `the games table matches the registry` pasa. Si Docker o la red no permiten levantar Supabase en este entorno, dilo en el reporte con el error exacto. En ese caso, CI (trabajo `supabase`) es la verificación. No se toca el proyecto real.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat(db): add the Star Shower game row"
```

---

### Task 8: Pruebas de punta a punta

**Files:**
- Modify: `e2e/luz.spec.ts`, `e2e/touch-targets.spec.ts`

**Interfaces:**
- Consumes: el marcado de la Tarea 5 (`data-testid="star"`, `data-testid="answer"`, `[data-zone="controls"]`).

- [ ] **Step 1: Agregar el juego a las pruebas**

- **`e2e/luz.spec.ts`:**
  - Agrega `'star-shower'` a `GAMES`.
  - En `answerSome`, para `star-shower`, responde 3 estrellas. Lee el texto de la primera `getByTestId('star')`, resuélvelo con la ayuda `solve` existente (la del formato «a op b»), escribe con `page.keyboard.type` y pulsa Enter. Espera a que haya una estrella antes de cada respuesta.
  - `finishRunningGame` ya termina el juego, porque `runFor(61_000)` alcanza para las 3 pérdidas (unos 30 s más 1 s).
- **`e2e/touch-targets.spec.ts`:** agrega `'star-shower'` a la lista de `game controls are at least 44 px tall`.
- **Nueva prueba en `luz.spec.ts`** (Review Focus #5), en el `describe` de 320 px en inglés:

```ts
test('Star Shower at level 10 keeps its longest sums inside the sky at 320 px', async ({ page }) => {
  // Abre ./#/games para que exista la base, y pon el nivel 10 en IndexedDB:
  //   indexedDB.open('light') → transaction('gameLevels','readwrite') → put({ gameId: 'star-shower', startLevel: 10 })
  // Entra a ./#/play/star-shower, pulsa Start y espera 3 estrellas ([data-testid="star"]).
  // Para cada una: su caja queda dentro de la caja de [data-zone="stage"].
  // hasNoSidewaysScroll(page) === true.
});
```

- [ ] **Step 2: Correr las pruebas**

Run: `npm run build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`
Expected: todas pasan, incluidas `daily.spec.ts` (el plan del día puede elegir el juego nuevo), `offline.spec.ts` y las capturas de `test-results/luz/` con `star-shower-play.png` y `star-shower-result.png`.

- [ ] **Step 3: Mirar las capturas**

Abre `test-results/luz/star-shower-play.png` y `star-shower-result.png`. Comprueba que se vean las estrellas, el horizonte, las vidas, la ranura y el teclado, y nómbralas en el reporte.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): Star Shower in the Luz screenshots, touch targets and narrow screens"
```
