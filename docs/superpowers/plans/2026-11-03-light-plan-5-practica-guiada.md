# Plan 5: práctica guiada en cada juego — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada juego enseña con una práctica guiada la primera vez. La práctica también se abre desde «¿Cómo se juega?» y desde la pausa, y reemplaza la pantalla de pasos y los ejemplos animados.

**Architecture:**
- Un marco común en `src/games/shared/practice/`: `PracticeFrame` y `usePracticeRounds`, más la reacción de acierto/error extraída de `GameFrame` para compartirla.
- Cada juego aporta `Practice.tsx`, con sus rondas fijas, reusando sus piezas visuales.
- `PlayScreen` agrega las fases de práctica y el estado de pausa `practice`.
- Los juegos reales no cambian.

**Tech Stack:** React 19, TypeScript, CSS Modules, i18next, Vitest + Testing Library (fake timers), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-light-practica-guiada-design.md`

## Global Constraints

- **Textos:** español e inglés con las mismas claves (`src/i18n/i18n.test.ts`). Sin afirmaciones médicas. Los textos de §4 del spec van **literales**.
- **Juegos reales intactos:** no cambian sus motores, su puntuación, su tiempo ni su `Component`.
- **La práctica no escribe nada:** ni resultados, ni nivel, ni plan diario, ni sincronización. Solo la marca de visto (`settings.seenInstructions`), y la escribe `PlayScreen`, no la práctica.
- **Estilo:** la práctica vive dentro del ámbito Luz del juego (siempre oscuro), con sus tokens `--luz-*` y `--game`.
- **Tamaños y movimiento:** objetivos táctiles ≥ 44 px; sin desplazamiento lateral a 320 px; con «reducir movimiento» no hay sacudida (igual que `GameFrame`).
- **Dependencias:** ninguna nueva.
- **Antes de cada commit:** `npm run lint`, `npm run typecheck` y `npm test`, todos en verde.
- **Capturas de cada tarea visible:**
  - Se guardan en `/tmp/claude-0/-home-user-Light/ae7f1af7-7d9e-5ccc-a0af-2f96f2ceacbb/scratchpad/p5/`, nunca en `test-results/` (Playwright lo borra).
  - Servidor: `npm run build && (setsid npm run preview -- --port 4173 --strictPort > /dev/null 2>&1 &)`.
  - Detenerlo con `fuser -k 4173/tcp`. **Nunca** `pkill -f "vite preview"`.
  - Chromium está en `/opt/pw-browsers/chromium`. Los scripts importan `/home/user/Light/node_modules/playwright/index.mjs`.
- **Mientras no exista la integración (Tarea 7)**, una práctica se ve en un navegador montándola en una página de prueba temporal, o con una prueba de Vitest que renderice y guarde el HTML. No se hace commit de archivos temporales.

## Review Focus

1. **Toques repetidos durante el «¡Bien!».** Dos toques rápidos no deben saltar dos rondas, y una respuesta durante la espera se ignora. Prueba en la Tarea 1.
2. **Saltar o salir durante la espera de ~700 ms.** No debe llamarse a `onComplete` después de desmontar, ni quedar un aviso de React. Prueba en la Tarea 1.
3. **La práctica desde la pausa no toca el juego congelado.** Las teclas de la práctica (por ejemplo ← → sobre Flechas) no responden al juego de abajo, y al volver el tiempo y los puntos son los mismos. Prueba E2E en la Tarea 8.
4. **Secuencia de luces:**
   - Tocar mientras se encienden las casillas no cuenta.
   - Un toque equivocado a mitad de la secuencia la repite desde el principio.

   Prueba en la Tarea 6.
5. **Entrenamiento diario la primera vez:** la práctica, luego el juego y luego el resultado guardado como diario, con el siguiente juego del plan. Prueba en la Tarea 7.

---

### Task 1: Marco común de práctica

**Files:**
- Create:
  - `src/games/shared/reaction.tsx`, que extrae de `GameFrame` el destello, la sacudida y el filtro de la señal «vieja».
  - `src/games/shared/practice/types.ts`
  - `src/games/shared/practice/usePracticeRounds.ts`
  - `src/games/shared/practice/PracticeFrame.tsx`
  - `src/games/shared/practice/PracticeFrame.module.css`
- Test:
  - `src/games/shared/practice/usePracticeRounds.test.tsx`
  - `src/games/shared/practice/PracticeFrame.test.tsx`
- Modify:
  - `src/games/shared/GameFrame.tsx`, para usar `reaction.tsx` sin cambiar su comportamiento.
  - `src/games/types.ts`: `Practice?: ComponentType<PracticeProps>`. Es opcional hasta la Tarea 7.
  - `src/i18n/es.json`, `src/i18n/en.json`: claves `practice.*`.

**Interfaces:**
- Produces:
  - `PracticeProps { onComplete: () => void; onSkip: () => void }`, en `types.ts`.
  - `PRACTICE_NEXT_MS = 700`.
  - `usePracticeRounds(total: number, onComplete: () => void): { round: number; status: 'asking' | 'right' | 'wrong'; answer: (correct: boolean) => void }`.
    - `round` empieza en 0.
    - `answer` se ignora mientras `status === 'right'`.
    - Llama a `useFeedback()` con `'correct'` o `'wrong'`.
    - Tras un acierto espera `PRACTICE_NEXT_MS`, y entonces pasa a la siguiente ronda o llama a `onComplete` si era la última. El temporizador se limpia al desmontar.
    - Tras un error queda en `'wrong'` y la ronda sigue activa.
  - `PracticeFrame({ round, total, message, tone, onSkip, controls, children })`:
    - `round` empieza en 1, para el texto.
    - `tone?: 'hint' | 'ok'`.
    - Arriba muestra `practice.progress` y un botón `practice.skip`. Debajo, la burbuja del guía con `aria-live="polite"` y `data-tone`. Luego la zona `data-zone="stage"`, con el destello compartido, y la zona `data-zone="controls"`.
    - La disposición y las medidas copian las de `GameFrame.module.css` (zona de juego que crece y controles abajo).
  - `reaction.tsx` exporta `useReactionSignal(stageRef)` y `Flash`:
    - `useReactionSignal(stageRef)` devuelve la señal a dibujar (sin la que ya existía al montar) y aplica la sacudida al fallar, salvo con movimiento reducido.
    - `Flash` es el componente que hoy vive dentro de `GameFrame`.
  - Textos `practice.*`:

    | Clave | es | en |
    |---|---|---|
    | `intro` | Vamos a practicar un poco: sin reloj y sin puntos. | Let's practice a little: no clock, no points. |
    | `start` | Empezar práctica | Start practice |
    | `skip` | Saltar práctica | Skip practice |
    | `progress` | Práctica {{n}} de {{total}} | Practice {{n}} of {{total}} |
    | `nice` | ¡Bien! | Nice! |
    | `doneTitle` | ¡Listo! Ahora va en serio | Done! Now for real |

- [ ] **Step 1: Write the failing tests.**
  - `usePracticeRounds.test.tsx`: renderiza un componente de prueba dentro de `FeedbackProvider` (y `useSettings` fijado, como en `feedback.test.tsx`), con `vi.useFakeTimers()`.
    - `answer(true)` deja `status 'right'`. Tras 700 ms, `round` es 1 y `status` es `'asking'`.
    - `answer(false)` deja `'wrong'` en la misma ronda. Un `answer(true)` posterior avanza.
    - En la última ronda, un acierto llama a `onComplete` una vez tras 700 ms.
    - Review Focus 1: dos `answer(true)` seguidos avanzan solo una ronda.
    - Review Focus 2: desmontar durante la espera no llama a `onComplete` y no deja avisos en la consola.
  - `PracticeFrame.test.tsx`:
    - Muestra «Práctica 2 de 4» con `round=2`, `total=4`.
    - El botón «Saltar práctica» llama a `onSkip`.
    - El mensaje está en una región `aria-live="polite"` con `data-tone` según `tone`.
    - Tiene `data-zone="stage"` y `data-zone="controls"`.
  - Las pruebas actuales de `GameFrame` deben seguir pasando sin cambios.

- [ ] **Step 2: Run** `npx vitest run src/games/shared`. Expected: las nuevas FALLAN.

- [ ] **Step 3: Implement.**
  - Extrae `reaction.tsx` y haz que `GameFrame` lo use. La lógica se mueve, no se duplica.
  - Escribe `usePracticeRounds`, `PracticeFrame` y sus estilos, y agrega las claves de texto.
  - Estilo de la burbuja: cristal Luz (`rgba(255,255,255,.06)` con borde `rgba(255,255,255,.1)`, radio 16px y texto `--luz-text`).
    - `data-tone='ok'`: borde y texto de acento `--luz-ok`.
    - `data-tone='hint'`: borde `--game` y texto `--luz-text`.
  - «Saltar práctica»: botón de texto con `min-height: 44px` y color `--luz-soft`.

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "feat(practice): shared practice frame and round logic"`.

### Task 2: Práctica de Flechas

**Files:**
- Create: `src/games/arrows/Practice.tsx`, `src/games/arrows/Practice.test.tsx`.
- Modify: `src/games/arrows/index.ts` (agrega `Practice`), `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces:**
- Consumes: `PracticeFrame`, `usePracticeRounds`, `PracticeProps` (Tarea 1); `ArrowRow`, `ArrowIcon`, `useGameKeys`, `arrows.module.css`.
- Produces: `ArrowsPractice(props: PracticeProps)`.
- Rondas (`ArrowTrial`):
  1. `{ direction: 'right', congruent: true }`
  2. `{ direction: 'left', congruent: true }`
  3. `{ direction: 'right', congruent: false }`
  4. `{ direction: 'left', congruent: false }`
- Textos `games.arrows.practice.*`:

  | Clave | es | en |
  |---|---|---|
  | `center` (rondas 1–2) | Toca hacia dónde apunta la flecha del centro | Tap the way the middle arrow points |
  | `trick` (rondas 3–4) | Ojo: las de los lados quieren engañarte. Solo cuenta la del centro | Careful: the side arrows try to trick you. Only the middle one counts |
  | `hintRight` | La del centro apunta a la derecha | The middle one points right |
  | `hintLeft` | La del centro apunta a la izquierda | The middle one points left |
  | `recap` | Tienes 60 segundos. Cada error resta 20 puntos: responde rápido, pero sin adivinar. | You have 60 seconds. Each mistake costs 20 points: be quick, but don't guess. |

- [ ] **Step 1: Write the failing tests** (`Practice.test.tsx`, con `FeedbackProvider`, fake timers e i18n en `es`):
  - Responder bien las 4 rondas, avanzando 700 ms tras cada una, llama a `onComplete` una vez. El progreso pasa por «Práctica 1 de 4» … «4 de 4».
  - En la ronda 3, «Izquierda» muestra «La del centro apunta a la derecha», y la fila sigue siendo la de la ronda 3 (`data-direction="right"`).
  - Las teclas ← y → responden igual que los botones.
  - «Saltar práctica» llama a `onSkip`.

- [ ] **Step 2: Run** `npx vitest run src/games/arrows/Practice.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** `ArrowsPractice`.
  - El mensaje es `practice.nice` cuando `status === 'right'`, la pista según la dirección cuando es `'wrong'`, y si no, `center` o `trick` según la ronda.
  - Los controles son los mismos dos botones del juego (`ArrowIcon` + `games.arrows.left/right`), con su CSS.
  - La fila va con `key` por ronda y la clase `appear`.

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** Rondas 1 y 3, y la pista, en 390×844 y 320×640, guardadas en la carpeta `p5`. Míralas.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): guided practice for Arrows"`.

### Task 3: Práctica de ¿Igual o distinto?

**Files:**
- Create: `src/games/same-different/Practice.tsx`, `src/games/same-different/Practice.test.tsx`.
- Modify: `src/games/same-different/index.ts`, `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces:**
- Consumes: Tarea 1, `SymbolGlyph`, `INTRO_MS` (de `Game.tsx`), `useGameKeys` y el CSS del juego.
- Produces: `SameDifferentPractice(props: PracticeProps)`.
- Pasos:
  - **Paso 0:** muestra `star` y el mensaje `remember`. Los botones Sí/No están `disabled`. Pasa solo al paso 1 tras `INTRO_MS`, y no cuenta en el progreso.
  - **Rondas** (`total = 3`): `star` → Sí; `heart` → No; `heart` → Sí.
  - **Teclas:** ← = No y → = Sí, como en el juego.
- Textos `games.same-different.practice.*`:

  | Clave | es | en |
  |---|---|---|
  | `remember` | Recuérdala | Remember it |
  | `question` (ronda 1) | ¿Es igual a la anterior? | Is it the same as the one before? |
  | `andThis` (ronda 2) | ¿Y esta? | And this one? |
  | `compare` (ronda 3) | Compara siempre con la que vino justo antes | Always compare with the one just before |
  | `hint1` | Antes había una estrella: es igual | Before there was a star: it's the same |
  | `hint2` | Antes había una estrella y ahora un corazón: es distinto | Before there was a star, now a heart: it's different |
  | `hint3` | Antes había un corazón: es igual | Before there was a heart: it's the same |
  | `recap` | Tienes 60 segundos. Las rachas multiplican tus puntos; cada error resta 10 y reinicia la racha. | You have 60 seconds. Streaks multiply your points; each mistake costs 10 and resets the streak. |

- [ ] **Step 1: Write the failing tests:**
  - Al inicio, «Sí» y «No» están deshabilitados y se ve «Recuérdala». Tras `INTRO_MS` se ve «¿Es igual a la anterior?» y «Práctica 1 de 3».
  - Responder Sí, No y Sí (con 700 ms tras cada uno) llama a `onComplete`.
  - En la ronda 2, «Sí» muestra `hint2` y sigue en la ronda 2.
  - «Saltar práctica» funciona durante el paso 0.

- [ ] **Step 2: Run** `npx vitest run src/games/same-different/Practice.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** La tarjeta del símbolo se ve como en el juego, con `key` por paso y la clase `appear`. No hay racha.

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** El paso 0, la ronda 2 y una pista, guardados en `p5`.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): guided practice for Same or different"`.

### Task 4: Práctica de Cambio de regla

**Files:**
- Create: `src/games/rule-switch/Practice.tsx`, `src/games/rule-switch/Practice.test.tsx`.
- Modify: `src/games/rule-switch/index.ts`, `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces:**
- Consumes: Tarea 1; `CardView`, `RuleIcon` y el CSS del juego (`banner`, `switched`, `stimulus`, `targets`); `useGameKeys`.
- Produces: `RuleSwitchPractice(props: PracticeProps)`.
- Rondas (regla, centro, izquierda, derecha, correcta):
  1. color · círculo azul · cuadrado azul · círculo naranja · izquierda
  2. color · triángulo morado · triángulo naranja · cuadrado morado · derecha
  3. shape · círculo naranja · círculo azul · cuadrado naranja · izquierda
  4. shape · triángulo azul · cuadrado azul · triángulo morado · derecha
- En la ronda 3, el cartel lleva la clase `switched`, como en el juego. Las teclas ← y → eligen la carta izquierda o derecha.
- Textos `games.rule-switch.practice.*`:

  | Clave | es | en |
  |---|---|---|
  | `round1` | La regla dice COLOR: busca la carta del mismo color | The rule says COLOR: find the card with the same color |
  | `round2` | Sigue siendo COLOR: no te fijes en la forma | Still COLOR: ignore the shape |
  | `round3` | ¡Cambió la regla! Ahora busca la misma FORMA | The rule changed! Now find the same SHAPE |
  | `round4` | Fíjate siempre en el cartel de arriba | Always check the sign on top |
  | `hintColor` | La regla es COLOR y el centro es {{color}} | The rule is COLOR and the middle card is {{color}} |
  | `hintShape` | La regla es FORMA y el centro es un {{shape}} | The rule is SHAPE and the middle card is a {{shape}} |
  | `recap` | Tienes 60 segundos. Cada error resta 20 puntos: responde rápido, pero sin adivinar. | You have 60 seconds. Each mistake costs 20 points: be quick, but don't guess. |

  `{{color}}` y `{{shape}}` salen de las claves existentes `games.rule-switch.colors.*` y `shapes.*`.

- [ ] **Step 1: Write the failing tests:**
  - Completar eligiendo izquierda, derecha, izquierda y derecha llama a `onComplete`.
  - En la ronda 1, «derecha» muestra «La regla es COLOR y el centro es azul».
  - El cartel (`data-testid="rule-banner"`) tiene `data-rule="shape"` desde la ronda 3.
  - Las teclas ← y → funcionan.

- [ ] **Step 2: Run** `npx vitest run src/games/rule-switch/Practice.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** Rondas 1 y 3 y una pista, guardadas en `p5`.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): guided practice for Rule switch"`.

### Task 5: Práctica de Cálculo relámpago

**Files:**
- Create: `src/games/quick-math/Practice.tsx`, `src/games/quick-math/Practice.test.tsx`.
- Modify: `src/games/quick-math/index.ts`, `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces:**
- Consumes:
  - Tarea 1.
  - De Cálculo relámpago: `Keypad`, `formatProblem`, `MAX_INPUT_DIGITS`, el CSS del juego (`display`, `operation`, `problem`, `equals`, `answer`, `skip`) y `useGameKeys`.
- Produces: `QuickMathPractice(props: PracticeProps)`.
- Rondas (`Problem`):
  1. `{ a: 2, b: 3, op: '+', answer: 5 }`
  2. `{ a: 7, b: 4, op: '−', answer: 3 }`
  3. `{ a: 6, b: 7, op: '×', answer: 42 }`

  Usa el valor de `op` que espera el motor para cada signo (revisa el tipo `Op`).
- Respuesta escrita:
  - Es estado local: hasta `MAX_INPUT_DIGITS` cifras, con Borrar.
  - OK o Enter con la respuesta vacía no hace nada.
  - Al fallar se borra la respuesta.
- «Saltar» solo se muestra en la ronda 3, y allí cuenta como acierto (`answer(true)`).
- Teclas: los dígitos, Backspace y Enter, como en el juego.
- Textos `games.quick-math.practice.*`:

  | Clave | es | en |
  |---|---|---|
  | `round1` | Escribe el resultado y toca OK | Type the answer and tap OK |
  | `round2` | ¡Así! Otra | Like that! Another one |
  | `round3` | Si una se te complica, puedes tocar Saltar | If one is too hard, you can tap Skip |
  | `hint` | Casi: {{problem}} = {{answer}}. Inténtalo otra vez | Close: {{problem}} = {{answer}}. Try again |
  | `recap` | Tienes 60 segundos. Cada acierto suma, cada error resta 10 y saltar no resta. | You have 60 seconds. Each right answer scores, each mistake costs 10, and skipping costs nothing. |

- [ ] **Step 1: Write the failing tests:**
  - Escribir 5 y OK, 3 y Enter, y luego «Saltar» llama a `onComplete`.
  - En la ronda 1, escribir 6 y OK muestra «Casi: 2 + 3 = 5. Inténtalo otra vez» y deja la respuesta vacía («?»).
  - «Saltar» no está en las rondas 1 y 2.
  - OK con la respuesta vacía no cambia nada.
  - En la ronda 3, la respuesta 42 también completa la práctica.

- [ ] **Step 2: Run** `npx vitest run src/games/quick-math/Practice.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** Las rondas 1 y 3 y una pista, a 390×844 y 320×640, guardadas en `p5`.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): guided practice for Quick math"`.

### Task 6: Práctica de Secuencia de luces

**Files:**
- Create: `src/games/sequence-lights/Practice.tsx`, `src/games/sequence-lights/Practice.test.tsx`.
- Modify: `src/games/sequence-lights/index.ts`, `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces:**
- Consumes: Tarea 1; `Board`, `SHOW_MS`, `GAP_MS` y el CSS del juego (`status`).
- Produces: `SequenceLightsPractice(props: PracticeProps)`.
- Rondas en un tablero 3×3, con índices desde 0: `[1, 5]`, `[6, 4, 2]` y `[0, 4, 8, 5]`. Son las casillas 2-6, 7-5-3 y 1-5-9-6 del spec.
- Fases por ronda:
  - `show`: se enciende cada casilla con `SHOW_MS`/`GAP_MS`, como en el juego. Tocar no cuenta.
  - `input`: cada toque se compara con la casilla siguiente.
    - Un toque equivocado llama a `answer(false)`; tras ~800 ms se vuelve a `show` con la misma secuencia desde el principio.
    - Completar la secuencia llama a `answer(true)`.
  - Durante el «¡Bien!», la secuencia correcta queda encendida, como en el juego.
- Textos `games.sequence-lights.practice.*`:

  | Clave | es | en |
  |---|---|---|
  | `watch` | Mira qué casillas se encienden… | Watch which squares light up… |
  | `yourTurn` | Ahora tócalas en el mismo orden | Now tap them in the same order |
  | `grows` | Si aciertas, la secuencia se alarga | Get it right and the sequence grows longer |
  | `hint` | Casi. Mira otra vez | Almost. Watch again |
  | `recap` | Son 8 rondas. Si aciertas, la secuencia se alarga; si fallas, se acorta. | There are 8 rounds. Get one right and the sequence grows; miss and it shrinks. |

  En la ronda 3, durante `show`, el mensaje es `grows`.

- [ ] **Step 1: Write the failing tests** (con fake timers):
  - Tras el tiempo de mostrar, tocar «Casilla 2» y «Casilla 6» acierta la ronda 1.
  - Completar las tres rondas llama a `onComplete`.
  - Review Focus 4:
    - Un toque durante `show` no cuenta.
    - En la ronda 2, tocar «Casilla 7» y luego una casilla equivocada muestra «Casi. Mira otra vez» y vuelve a mostrar la secuencia desde la primera casilla.

- [ ] **Step 2: Run** `npx vitest run src/games/sequence-lights/Practice.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** La fase `show`, `input` y una pista, guardadas en `p5`.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): guided practice for Sequence lights"`.

### Task 7: Integración en la pantalla de juego y limpieza

**Files:**
- Create:
  - `src/screens/play/PracticeIntro.tsx`: entrada de la primera vez.
  - `src/screens/play/PracticeDone.tsx`: «¡Listo!» con su resumen.
- Modify:
  - `src/screens/PlayScreen.tsx`, `src/screens/play/PauseOverlay.tsx`, `src/screens/play/Play.module.css`.
  - `src/games/types.ts`: `Practice` pasa a ser obligatorio y se quita `Example`.
  - Los cinco `src/games/<id>/index.ts`: quitar `Example`.
  - `src/test/fakeGame.tsx`.
  - `src/games/registry.test.ts`, `src/games/penaltyCopy.test.ts`.
  - `src/i18n/es.json`, `src/i18n/en.json`.
- Delete:
  - `src/screens/play/Instructions.tsx`.
  - Los cinco `src/games/<id>/Example.tsx` y sus `Example.test.tsx`.
  - Las reglas CSS que solo usaban (`.steps`, `.example` y otras), tras comprobarlo con `grep`.
- Test:
  - `src/screens/PlayScreen.test.tsx`
  - `src/screens/play/PauseOverlay.test.tsx`

**Interfaces:**
- Consumes: `game.Practice` y `PracticeProps`. `FeedbackProvider` envuelve cada práctica que monta `PlayScreen`, para que sus señales no lleguen al `GameFrame` del juego en pausa.
- Produces:
  - Fases: `{ kind: 'intro'; firstTime: boolean }`, `{ kind: 'practice'; origin: 'first' | 'howTo' }` y `{ kind: 'practiceDone' }`. Las demás no cambian.
  - `Pause = 'off' | 'sheet' | 'practice' | 'resuming'`.
  - `PauseOverlay` gana la prop `onHowToPlay`.
  - `fakeGame.Practice`: renderiza dos botones, «Terminar práctica» (llama a `onComplete`) y «Saltar práctica» (llama a `onSkip`).
- Flujo (spec §3):
  - **Primera vez:** `PracticeIntro`, con `IntroHeader` (✕ y área), el título, `practice.intro`, «Empezar práctica» y «Saltar práctica».
    - Empezar → `practice/first`.
    - Saltar → marcar visto y empezar el juego.
  - **`practice/first`:** completar → marcar visto y `practiceDone`; saltar → marcar visto y empezar el juego.
  - **`practice/howTo`:** completar → `practiceDone`; saltar → `intro { firstTime: false }`.
  - **`practiceDone`:** `practice.doneTitle`, `games.<id>.practice.recap` y «Comenzar», que empieza el juego.
  - **Quien ya jugó:** «¿Cómo se juega?» → `practice/howTo`.
  - **Pausa:**
    - «¿Cómo se juega?» → `pause = 'practice'`.
    - La práctica se dibuja en una capa fija y opaca de Luz encima del juego atenuado e inerte, con el foco dentro.
    - Completar o saltar → `pause = 'sheet'`, y el foco va a «Continuar».
    - `visibilitychange` con la pausa en `'practice'` no cambia nada; en `'resuming'` sigue volviendo a la hoja.
  - **Marca de visto:** `markInstructionsSeen(game.id)` ya no se llama en `handleStart`; se llama en los casos marcados arriba.
- **Limpieza de textos:**
  - Quitar `games.<id>.instructions`, `games.<id>.exampleAnswer*`, `play.example` y cualquier clave que solo usaran los ejemplos (búscalo con `grep`).
  - `penaltyCopy.test.ts` pasa a leer `games.<id>.practice.recap`. Exige, en ES y EN:
    - la penalización exacta (`*_WRONG_PENALTY`);
    - en los juegos con reloj, los segundos (`GAME_DURATION_MS / 1000`);
    - en Secuencia de luces, las rondas (`ROUNDS`).
  - `registry.test.ts` exige `Practice` y `practice.recap` en cada juego, y deja de exigir `instructions`.

- [ ] **Step 1: Write the failing tests** (`PlayScreen.test.tsx`):
  - Primera visita:
    - Se ve «Vamos a practicar…»; «Empezar práctica» lleva a la práctica falsa.
    - «Terminar práctica» lleva a «¡Listo! Ahora va en serio», y «Comenzar» lleva al juego.
    - `seenInstructions` incluye `fake`.
  - «Saltar práctica» en la entrada lleva directo al juego y marca visto.
  - La ✕ de la entrada no marca visto.
  - Quien ya jugó: «¿Cómo se juega?» → práctica. «Saltar práctica» vuelve a la entrada; «Terminar práctica» lleva a «¡Listo!».
  - Pausa:
    - La ✕ del juego, luego «¿Cómo se juega?» y luego «Terminar práctica» vuelve a la hoja, que muestra el mismo tiempo y los mismos puntos y tiene el foco en «Continuar».
    - Ocultar la app durante la práctica no la cierra.
  - `PauseOverlay.test.tsx`: tres botones en orden: Continuar, ¿Cómo se juega?, Salir.
  - Review Focus 5: en modo diario, la primera visita → practicar → juego → «Terminar» → resultado con «Siguiente juego».
  - **Ajuste de las pruebas existentes:** las que hacen la primera visita y pulsan «Comenzar» pasan por «Saltar práctica», con un ayudante `startFirstVisit()` en el archivo. Las que comprobaban la pantalla de pasos se reemplazan por las nuevas.

- [ ] **Step 2: Run** `npx vitest run src/screens`. Expected: FAIL.

- [ ] **Step 3: Implement**, incluida la limpieza.

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS. Then `grep -rn "Instructions\|Example\|instructions\|exampleAnswer" src` shows nothing that is dead.

- [ ] **Step 5: Screenshots.**
  - Las de la primera visita de Flechas: la entrada de práctica, una ronda, «¡Listo!» y luego el juego.
  - La pausa con «¿Cómo se juega?» y la práctica encima del juego.
  - A 390×844 y 320×640, guardadas en `p5`.

- [ ] **Step 6: Commit**: `git commit -m "feat(practice): practice replaces the instructions, also from the intro and the pause"`.

### Task 8: E2E y capturas para el dueño

**Files:**
- Create: `e2e/practice.spec.ts`
- Modify: `e2e/helpers.ts` y cualquier spec que pulse «Comenzar» en una primera visita.

**Interfaces:**
- `finishCurrentGame(page)`: si está visible «Saltar práctica», lo pulsa (empieza el juego); si no, pulsa «Comenzar». Luego juega como hoy.
- Toda spec actual que abra un juego por primera vez y pulse «Comenzar» directamente pasa por ese ayudante o por «Saltar práctica».

- [ ] **Step 1: Write** `e2e/practice.spec.ts`:
  - **Flechas de principio a fin:** «Empezar práctica», responder las 4 rondas con los botones, «¡Listo! Ahora va en serio», «Comenzar», y comprobar que aparece `[data-game="arrows"]`.
  - **Review Focus 3:**
    - Empezar Flechas: saltar la práctica.
    - Contestar dos rondas del juego.
    - Pausar con la ✕ y anotar el tiempo y los puntos de la hoja.
    - «¿Cómo se juega?» y pulsar ← y → varias veces.
    - «Saltar práctica»: la hoja muestra los mismos puntos y tiempo.
  - **Objetivos táctiles ≥ 44 px:** los botones de la práctica de cada juego (zona de controles y «Saltar práctica»). Reusa el ayudante `expectTall` si está en `e2e/helpers.ts`.
  - **Sin desplazamiento lateral** a 320×640 en las cinco prácticas, en `es-CO` y `en-US`.
  - **Capturas** en `test-results/practice/` y copiadas a `/tmp/claude-0/-home-user-Light/ae7f1af7-7d9e-5ccc-a0af-2f96f2ceacbb/scratchpad/p5/final/`, a 390×844:
    - por juego, una ronda con el guía y una con la pista;
    - la entrada de práctica, «¡Listo!» y la pausa con la práctica.

    Antes de cada captura, mueve el ratón a (0, 0) y espera el h1 o el texto del guía propio de esa pantalla.

- [ ] **Step 2: Run** `fuser -k 4173/tcp; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`. Expected: todo PASS, lo nuevo y lo viejo. Si una prueba encuentra un error real de diseño, se arregla en el CSS con el cambio mínimo, nunca debilitando la prueba.

- [ ] **Step 3: Look** at the screenshots and list them in the report.

- [ ] **Step 4: Commit**: `git commit -m "test(practice): end-to-end practice, pause safety, sizes and screenshots"`.
