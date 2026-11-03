# Estilo Luz para los juegos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los cinco juegos y a sus pantallas (presentación, partida, pausa y resultado) el estilo «Luz»: siempre de noche, un color por área, marco común con barra de tiempo y controles abajo, y reacción visible, sonora y vibratoria al acertar y fallar.

**Architecture:** Un ámbito `LuzScope` envuelve `PlayScreen` y fija los tokens oscuros y el color del área; un `FeedbackProvider` dentro de él reparte las reacciones (sonido, vibración, señal visual). Un marco común `GameFrame` reemplaza a `GameHud` en los cinco juegos; luego `PlayScreen` deja su barra superior al marco, la pausa gana cuenta regresiva y el resultado, conteo y celebración. Los motores (`engine.ts`) no cambian.

**Tech Stack:** React 19.3.1, TypeScript 6.0.3, CSS Modules + una hoja global limitada a `[data-luz]`, Vitest 5.0.5 + Testing Library, Playwright 1.64.1, `@fontsource-variable/sora` 5.3.0 (nuevo), vite-plugin-pwa 2.0.0.

**Spec:** `docs/superpowers/specs/2026-11-02-light-estilo-luz-design.md`

## Global Constraints

- Tokens de Luz exactos: `--luz-bg #090b19`, `--luz-text #eef1ff`, `--luz-muted #8e94b8`, `--luz-ok #4dffa6`, `--luz-bad #ff5d7a`, `--luz-ink #0b0d1a`; vidrio `rgba(255,255,255,.045)` con borde interior `rgba(255,255,255,.09)`.
- Colores por área (`--game`): memory `#ffb52e`, attention `#3fd4ff`, speed `#ff5fd2`, flexibility `#a98bff`, math `#8dff6a`.
- Las pantallas de juego son oscuras aunque la app o el teléfono estén en modo claro; el resto de la app no cambia (salvo el interruptor de vibración).
- Reglas, puntajes, niveles, tiempos y sincronización no cambian; ningún `engine.ts` se modifica.
- Vibración: acierto `12` ms; error y tiempo agotado `[30, 50, 30]`; nunca falla si `navigator.vibrate` no existe.
- `prefers-reduced-motion: reduce` (o `matchMedia` ausente, como en jsdom): sin sacudidas, sin números volando, sin rayos ni chispas y sin conteo; solo cambian colores.
- Los controles siguen siendo `<button>` con sus nombres accesibles actuales; `useGameKeys` sigue funcionando; objetivos táctiles ≥ 44 px.
- Se conservan los contratos que usan las pruebas existentes: el atributo `data-game` en la sección de la partida (e2e), el par `dt`«Puntos» → `dd` con solo el número (pruebas de juegos), el botón ✕ con nombre «Salir del juego», y los `data-testid` actuales (`symbol-card`, `rule-banner`, `stimulus`, `target-left`, `target-right`, `problem`, `answer`).
- Todo texto nuevo en ES y EN (sigue vigente la prueba de paridad).
- Mensajes de commit en inglés; identificadores en inglés; cada commit termina con las líneas de coautoría de la sesión.

## Review Focus

1. **Volver a la app tras jugar:** al salir de un juego (también de un juego diario al siguiente, o tras un error que muestre el `ErrorBoundary`) la página y la barra del teléfono deben recuperar exactamente su color anterior. → prueba en Task 1 (desmontaje, doble montaje tipo StrictMode y dos ámbitos seguidos).
2. **Respuestas muy rápidas:** dos aciertos o errores seguidos deben reiniciar el destello y mostrar el último «±N», sin acumular elementos. → prueba en Task 3.
3. **Pantallas angostas e idioma inglés:** con 320 px de ancho y títulos largos («Same or different?») no debe haber desplazamiento horizontal en la partida. → prueba e2e en Task 11.
4. **Salir de la app durante la cuenta 3, 2, 1:** al volver debe verse la hoja de pausa, con el juego aún detenido. → prueba en Task 9.
5. **Movimiento reducido real:** con `reducedMotion: 'reduce'` el puntaje del resultado aparece completo de inmediato y no hay números flotando visibles. → prueba e2e en Task 11.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/games/shared/luz/luz.css` (nuevo) | Tokens de Luz, colores por `data-area`, remapeo de los tokens de la app dentro de `[data-luz]`, letra Sora, fondo de `html[data-luz-active]`. |
| `src/games/shared/luz/LuzScope.tsx` (nuevo) | Contenedor `data-luz` + `data-area`; marca la raíz y cambia `theme-color` mientras está montado; incluye `FeedbackProvider`. |
| `src/core/motion.ts` (nuevo) | `prefersReducedMotion()`. |
| `src/core/vibrate.ts` (nuevo) | Patrones y llamada segura a `navigator.vibrate`. |
| `src/games/shared/feedback.tsx` (reemplaza `feedback.ts`) | `FeedbackProvider`, `useFeedback`, `useFeedbackSignal`. |
| `src/games/shared/GameFrame.tsx` + `GameFrame.module.css` (nuevos) | Marco común: barra superior, tiempo o rondas, zona de juego, controles, reacción visual y «±N». Reemplaza `GameHud`. |
| `src/games/shared/playChrome.ts` (nuevo) | `PlayChromeContext` (título, pausa, reporte de puntos y tiempo). |
| `src/games/<juego>/*` | Cada juego pasa a `GameFrame` y a su estilo Luz; `Example.tsx` animado. |
| `src/screens/PlayScreen.tsx`, `src/screens/play/*` | Integración, presentación, pausa con cuenta regresiva y resultado. |
| `src/data/settings.ts`, `src/screens/SettingsScreen.tsx` | Ajuste `vibration`. |

---

### Task 1: Base Luz — ámbito, tokens, letra y contraste

**Files:**
- Create: `src/games/shared/luz/luz.css`, `src/games/shared/luz/LuzScope.tsx`, `src/games/shared/luz/LuzScope.test.tsx`
- Modify: `src/screens/PlayScreen.tsx` (envolver cada fase de `PlaySession` en `LuzScope`), `src/app/contrast.test.ts`, `vite.config.ts` (`test.css.include` y `workbox.globPatterns`), `package.json`
- Test: `src/games/shared/luz/LuzScope.test.tsx`, `src/app/contrast.test.ts`

**Interfaces:**
- Produces: `LuzScope({ area, children }: { area: Area; children: ReactNode }): JSX.Element` — renderiza `<div className="luz" data-luz="" data-area={area}>`. `LUZ_THEME_COLOR = '#090b19'`.

- [ ] **Step 1: Instalar la letra.** `npm install --save-exact @fontsource-variable/sora@5.3.0`.

- [ ] **Step 2: Pruebas que fallan** en `LuzScope.test.tsx` (con un `<meta name="theme-color" content="#0E0F1A">` agregado al `document.head` en `beforeEach`):

```tsx
test('marks the page and darkens the browser bar while mounted, then restores them', () => {
  const { unmount, container } = render(<LuzScope area="attention"><p>x</p></LuzScope>);
  expect(container.querySelector('[data-luz][data-area="attention"]')).not.toBeNull();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(true);
  expect(themeColor()).toBe('#090b19');
  unmount();
  expect(document.documentElement.hasAttribute('data-luz-active')).toBe(false);
  expect(themeColor()).toBe('#0E0F1A');
});
test('a double mount (StrictMode) and two scopes in a row still restore the original color', () => { /* <StrictMode> + luego rerender con otra área y unmount → '#0E0F1A' y sin data-luz-active */ });
test('works without a theme-color meta', () => { /* quitar el meta → render/unmount sin lanzar */ });
```

  En `contrast.test.ts`, agregar un bloque que lea `luz.css?raw` y compruebe: `luz-text` y `luz-muted` sobre `luz-bg` ≥ 4,5; cada `--game` (bloques `[data-area='…']`) sobre `luz-bg` ≥ 3; `luz-ink` sobre cada `--game` ≥ 4,5; `luz-ok` y `luz-bad` sobre `luz-bg` ≥ 3.

- [ ] **Step 3: Verificar que fallan.** Run: `npx vitest run src/games/shared/luz src/app/contrast.test.ts`. Expected: FAIL (módulo inexistente).

- [ ] **Step 4: Implementar.**
  - `luz.css` (importado por `LuzScope.tsx`; `@import` de `@fontsource-variable/sora`): define los tokens de Global Constraints en `[data-luz]`, un bloque `[data-luz][data-area='<área>'] { --game: … }` por área (hex de seis dígitos, para que la prueba los lea), y dentro de `[data-luz]` remapea los tokens de la app (`--bg`, `--surface`, `--text`, `--text-muted`, `--accent` → `--game`, `--accent-text` → `--luz-ink`, `--glow`, `--border`, `--danger`, `--success`) para que las pantallas aún sin migrar se lean en oscuro. Fondo: resplandor radial del `--game` (≈28 %, hasta el 60 % de la altura) sobre `--luz-bg`; `min-height: 100dvh`; `color-scheme: dark`; `font-family: 'Sora Variable', system-ui, …`. `html[data-luz-active] { background: #090b19; }`.
  - `LuzScope`: en un efecto de montaje guarda el `content` actual del meta `theme-color` (si existe), lo cambia a `LUZ_THEME_COLOR` y pone `data-luz-active` en `<html>`; la limpieza restaura el valor guardado y quita el atributo.
  - `PlayScreen`: `PlaySession` envuelve lo que devuelve en `<LuzScope area={game.area}>`.
  - `vite.config.ts`: `test.css.include: [/theme\.css/, /luz\.css/]`; `workbox.globPatterns` agrega `woff2`.

- [ ] **Step 5: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -m "feat(luz): dark game scope with area colors, Sora font and contrast checks"`

---

### Task 2: Reacción compartida y ajuste de vibración

**Files:**
- Create: `src/core/motion.ts`, `src/core/vibrate.ts`, `src/games/shared/feedback.tsx` (reemplaza `src/games/shared/feedback.ts`), `src/games/shared/feedback.test.tsx`
- Modify: `src/games/shared/luz/LuzScope.tsx` (envuelve sus hijos en `FeedbackProvider`), `src/data/settings.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/SettingsScreen.test.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/shared/feedback.test.tsx`, `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Produces:
  - `prefersReducedMotion(): boolean` — `true` si `window.matchMedia` no existe o `'(prefers-reduced-motion: reduce)'` coincide.
  - `type FeedbackKind = 'correct' | 'wrong' | 'timeout'`; `interface FeedbackSignal { kind: FeedbackKind; id: number }` (`id` crece en cada emisión).
  - `FeedbackProvider({ children })`; `useFeedback(): (kind: FeedbackKind) => void`; `useFeedbackSignal(): FeedbackSignal | null`.
  - `VIBRATION: Record<FeedbackKind, number | number[]>` = `{ correct: 12, wrong: [30, 50, 30], timeout: [30, 50, 30] }`; `vibrate(pattern: number | number[]): void`.
  - `Settings.vibration: boolean` (por defecto `true`).

- [ ] **Step 1: Pruebas que fallan** (`feedback.test.tsx`; `vi.mock('../../core/sound')` y `navigator.vibrate` como `vi.fn()` definido con `Object.defineProperty`):

```tsx
test('correct plays the correct tone and a short vibration', async () => { /* settings por defecto → playTone('correct'), vibrate(12) */ });
test('wrong and timeout play the wrong tone and a double vibration', async () => { /* playTone('wrong'), vibrate([30,50,30]) para ambos */ });
test('sound and vibration follow their own switches', async () => { /* updateSettings({ sound: false }) → sin playTone pero con vibrate; { vibration: false } → al revés */ });
test('no navigator.vibrate is not an error', async () => { /* borrar navigator.vibrate → feedback('wrong') no lanza */ });
test('each call publishes a new signal to the provider', async () => { /* componente sonda con useFeedbackSignal: dos 'correct' seguidos → ids distintos, kind 'correct' */ });
test('without a provider the sound still plays and nothing breaks', async () => { /* renderHook(useFeedback) sin provider */ });
```

  En `SettingsScreen.test.tsx`: `test('vibration can be turned off')` (casilla «Vibración», marcada por defecto; al desmarcar, `(await getSettings()).vibration` es `false`) y que se ve la nota «Solo en teléfonos que lo permiten».

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/shared/feedback.test.tsx src/screens/SettingsScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `useFeedback` lee `useSettings()`; `timeout` usa el tono `'wrong'`. La señal vive en un estado del provider. `getSettings` devuelve `vibration: stored?.vibration ?? true`. Textos: `settings.vibration` «Vibración» / «Vibration»; `settings.vibrationHint` «Solo en teléfonos que lo permiten» / «Only on phones that support it». Los cinco juegos siguen llamando `feedback('correct' | 'wrong')` sin cambios en esta tarea.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): shared feedback with vibration and its own setting"`

---

### Task 3: Marco común `GameFrame`

**Files:**
- Create: `src/games/shared/playChrome.ts`, `src/games/shared/GameFrame.tsx`, `src/games/shared/GameFrame.module.css`, `src/games/shared/GameFrame.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/shared/GameFrame.test.tsx`

**Interfaces:**
- Consumes: `useFeedbackSignal`, `prefersReducedMotion` (Task 2).
- Produces:

```ts
// playChrome.ts
export interface PlayHud { score: number; remainingMs: number | null }
export interface PlayChrome { title: string; onPause: () => void; reportHud: (hud: PlayHud) => void }
export const PlayChromeContext: React.Context<PlayChrome | null>;
// GameFrame.tsx
export interface GameFrameProps {
  score: number;
  level: number;
  time?: { remainingMs: number; totalMs: number };   // juegos con tiempo
  rounds?: { current: number; total: number };      // Secuencia de luces
  controls?: ReactNode;                              // zona inferior
  children: ReactNode;                               // zona de juego
}
export function GameFrame(props: GameFrameProps): JSX.Element;
```

- [ ] **Step 1: Pruebas que fallan** (`GameFrame.test.tsx`, dentro de `FeedbackProvider`):

```tsx
test('points are a dt/dd pair whose dd holds only the number', () => { /* score 120 → getByText('Puntos').nextElementSibling.textContent === '120' */ });
test('level shows as "Nivel 3"', () => { /* dt «Nivel» + dd «3» */ });
test('the time bar tells screen readers the seconds left', () => {
  /* time {remainingMs: 41_200, totalMs: 60_000} → getByRole('progressbar', { name: 'Tiempo' })
     con aria-valuetext 'Quedan 42 s', aria-valuemax 60, aria-valuenow 42 */
});
test('the last 10 seconds mark the bar as urgent', () => { /* remainingMs 10_000 → data-urgent="true"; 10_001 → "false" */ });
test('rounds render as 8 dots with an accessible label', () => { /* rounds {current: 3, total: 8} → getByRole('list', { name: 'Ronda 3 de 8' }) con 8 items; 2 con data-state="done", 1 "now" */ });
test('a score change floats the real difference; no change floats nothing', () => {
  /* rerender 0 → 10: aparece '+10'; 10 → 0: '−10' (U+2212); mismo score: sin nuevo flotante */
});
test('two quick changes keep only the latest float', () => { /* 0 → 10 → 30 → solo '+20' en el DOM */ });  // Review Focus #2
test('feedback signals draw a flash of their kind and restart on each one', () => {
  /* emitir 'correct' → [data-flash="correct"]; luego 'wrong' → un único [data-flash="wrong"]; luego 'timeout' → [data-flash="timeout"] */
});
test('with a play chrome it shows the title and a pause button, and reports the hud', () => {
  /* PlayChromeContext con title 'Flechas', onPause spy, reportHud spy → heading 'Flechas'; click en botón 'Salir del juego' → onPause;
     reportHud llamado con { score: 120, remainingMs: 41_200 } */
});
test('without a chrome there is no title and no pause button', () => { /* sin provider → queryByRole('button', { name: 'Salir del juego' }) null */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/shared/GameFrame.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - Estructura (columna a altura completa `100dvh` con márgenes de zona segura): barra superior (✕ con `aria-label` `t('play.exit')`, título `<h1>` del chrome con `<dl>` de nivel debajo, píldora de puntos `<dl>` con `dt` visualmente oculto) → progreso (barra `role="progressbar"` con `aria-label` `t('game.hud.time')`, o lista de puntitos) → zona de juego (`flex: 1`) → controles.
  - Barra: `transform: scaleX(remaining/total)` con `transition: transform 100ms linear`; `data-urgent` cuando `remainingMs <= 10_000` (tinte hacia `--luz-bad` y latido).
  - «±N»: elemento `aria-hidden` hermano del `dd` (nunca dentro), con `key` por cambio; se muestra el último. Signo menos «−» (U+2212).
  - Reacción: un `<span data-flash={kind} aria-hidden="true">` con `key={signal.id}` sobre la zona de juego (destello verde que sale del centro; pulso rojo). Si `kind === 'wrong'` y no hay movimiento reducido, sacudida de la zona de juego con `element.animate` (si existe), sin volver a montar a los hijos.
  - Con movimiento reducido (media query en el CSS del marco), el «±N» no se desplaza y el destello no escala: solo cambia el color.
  - `reportHud` en un efecto cuando cambian `score` o `remainingMs`.
  - Textos nuevos: `game.hud.secondsLeft` «Quedan {{count}} s» / «{{count}} s left»; `game.hud.round` «Ronda {{n}} de {{total}}» / «Round {{n}} of {{total}}».

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): common game frame with time bar, rounds, score float and feedback flash"`

---

### Task 4: Flechas en Luz

**Files:**
- Modify: `src/games/arrows/Game.tsx`, `src/games/arrows/ArrowRow.tsx`, `src/games/arrows/Example.tsx`, `src/games/arrows/arrows.module.css`, `src/games/arrows/Game.test.tsx`
- Test: `src/games/arrows/Game.test.tsx`

**Interfaces:**
- Consumes: `GameFrame` (Task 3), `useFeedback` con `'timeout'` (Task 2).

- [ ] **Step 1: Prueba que falla** (render dentro de `FeedbackProvider`):

```tsx
test('a missed arrow is a timeout, not a wrong answer', () => { /* dejar vencer la ventana → [data-flash="timeout"] y Puntos sin cambio */ });
test('the center arrow is marked as the target', () => { /* exactamente un elemento con data-target="true" en la fila */ });
```

- [ ] **Step 2: Verificar que falla.** Run: `npx vitest run src/games/arrows`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `ArrowsGame` usa `<GameFrame score level time={{ remainingMs, totalMs: GAME_DURATION_MS }} controls={…botones…}>` con la fila en la zona de juego; el vencimiento llama `feedback('timeout')`. Estilo §4.2: fila sobre tarjeta de vidrio, flecha central `data-target="true"` en `--game` con halo, laterales en `--luz-text`; botones grandes con contorno luminoso. `Example.tsx`: la flecha central late en bucle (CSS, quieta con movimiento reducido).

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS (también las pruebas existentes de Flechas).

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): Arrows in the Luz style"`

---

### Task 5: ¿Igual o distinto? en Luz

**Files:**
- Modify: `src/games/same-different/Game.tsx`, `src/games/same-different/symbols.tsx`, `src/games/same-different/Example.tsx`, `src/games/same-different/same-different.module.css`, `src/games/same-different/Game.test.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/same-different/Game.test.tsx`

**Interfaces:**
- Consumes: `GameFrame`, `useFeedback`; `streakMultiplier(streak)` y `game.streak` del motor existente.

- [ ] **Step 1: Pruebas que fallan:**

```tsx
test('the streak pill appears at ×2 and goes away after a mistake', () => {
  /* responder bien 5 veces seguidas → getByText('Racha ×2'); un error → queryByText(/Racha/) null */
});
test('no streak pill below ×2', () => { /* 4 aciertos → sin 'Racha' */ });
test('a timeout is not a wrong answer', () => { /* vencer el tiempo de respuesta → [data-flash="timeout"] */ });
test('symbols are drawn as outlines', () => { /* el svg del símbolo tiene fill="none" y stroke="currentColor" */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/same-different`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `GameFrame` con `time`; la tarjeta del símbolo en la zona de juego, «No»/«Sí» en `controls`. `symbols.tsx`: figuras con `fill="none"`, `stroke="currentColor"`, `strokeWidth="6"`, `strokeLinejoin="round"`; el punto de las figuras con punto sigue relleno. Símbolo en `--game` con halo; la tarjeta conserva `key` por ensayo y entra deslizándose desde la derecha (con movimiento reducido, solo aparece). Píldora `games.same-different.streak` «Racha ×{{n}}» / «Streak ×{{n}}», solo con multiplicador ≥ 2, salta al subir. Vencimiento → `feedback('timeout')`. `Example.tsx`: dos símbolos alternando con el deslizamiento.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): Same or Different in the Luz style with streak pill"`

---

### Task 6: Cambio de regla en Luz

**Files:**
- Modify: `src/games/rule-switch/Game.tsx`, `src/games/rule-switch/Card.tsx`, `src/games/rule-switch/Example.tsx`, `src/games/rule-switch/rule-switch.module.css`, `src/games/rule-switch/Game.test.tsx`
- Test: `src/games/rule-switch/Game.test.tsx`

- [ ] **Step 1: Pruebas que fallan:**

```tsx
test('the two options sit in the controls area, below the stimulus', () => { /* target-left y target-right dentro del elemento de controles del marco; stimulus fuera */ });
test('a timeout is not a wrong answer', () => { /* [data-flash="timeout"], Puntos sin cambio */ });
```

  La prueba existente de que el cartel no se acumula al cambiar de regla debe seguir pasando sin cambios.

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/rule-switch`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `GameFrame` con `time`; cartel y carta central en la zona de juego; las dos opciones en `controls`. Cartel: píldora rellena de `--game` con texto `--luz-ink`; al cambiar (`justSwitched`, mismas `key` de hoy) gira como cartel y destella. Carta central con halo de `--game`. Las cartas conservan colores de estímulo y tramas de `COLOR_STYLE`; el contorno usa `--luz-text`. Vencimiento → `feedback('timeout')`. `Example.tsx`: el cartel alterna COLOR/FORMA con el giro.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): Rule Switch in the Luz style"`

---

### Task 7: Cálculo relámpago en Luz

**Files:**
- Modify: `src/games/quick-math/Game.tsx`, `src/games/quick-math/Keypad.tsx`, `src/games/quick-math/Example.tsx`, `src/games/quick-math/quick-math.module.css`, `src/games/quick-math/Game.test.tsx`
- Test: `src/games/quick-math/Game.test.tsx`

- [ ] **Step 1: Pruebas que fallan:**

```tsx
test('skipping is a timeout, not a wrong answer', () => { /* click 'Saltar' → [data-flash="timeout"], Puntos sigue en 0 */ });
test('a new problem replaces the old one with an entering animation hook', () => { /* tras acertar, el contenedor de la operación tiene una key nueva y data-enter="true" */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/quick-math`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `GameFrame` con `time`; la operación grande en la zona de juego con la respuesta en una ranura de subrayado luminoso (`data-testid="answer"` sin cambios); teclado de vidrio y «Saltar» (texto pequeño) en `controls`; OK relleno de `--game` con `--luz-ink`. «Saltar» llama `feedback('timeout')`. La operación nueva entra desde abajo (key por problema). `Example.tsx`: se escribe la respuesta y destella.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS (incluye las pruebas de Enter sobre OK y Saltar).

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): Quick Math in the Luz style"`

---

### Task 8: Secuencia de luces en Luz y retiro de `GameHud`

**Files:**
- Modify: `src/games/sequence-lights/Game.tsx`, `src/games/sequence-lights/Board.tsx`, `src/games/sequence-lights/Example.tsx`, `src/games/sequence-lights/sequence-lights.module.css`, `src/games/sequence-lights/Game.test.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Delete: `src/games/shared/GameHud.tsx`, `src/games/shared/GameHud.module.css`
- Test: `src/games/sequence-lights/Game.test.tsx`

- [ ] **Step 1: Pruebas que fallan:**

```tsx
test('rounds show as dots', () => { /* getByRole('list', { name: 'Ronda 1 de 8' }) */ });
test('a correct round lights the whole path together', () => {
  /* completar la ronda bien → durante la fase de resultado de ronda, cada celda de esa secuencia tiene data-lit="true" */
});
test('the round message says ¡Perfecto!', () => { /* tras acertar → getByText('¡Perfecto!') */ });
```

  Actualizar las aserciones existentes de «¡Bien!» a «¡Perfecto!».

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/sequence-lights`. Expected: FAIL.

- [ ] **Step 3: Implementar.** `GameFrame` con `rounds={{ current: Math.min(game.round + 1, ROUNDS), total: ROUNDS }}`; el texto de estado en la zona de juego y el tablero en `controls` (zona del pulgar). Tras un acierto, durante `FEEDBACK_MS` (600, sin cambiar) se encienden todas las celdas de la secuencia recién completada (guardarla antes de `pressCell`). Casilla encendida: `--game` con halo y borde interior claro; tocada: se hunde. Copia: `games.sequence-lights.correct` «¡Perfecto!» / «Perfect!»; se elimina `games.sequence-lights.round` (lo reemplaza `game.hud.round`). Borrar `GameHud` (ya no lo usa nadie). `Example.tsx`: tres casillas se encienden en orden.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint && grep -rn "GameHud" src`. Expected: PASS y grep sin resultados.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): Sequence Lights in the Luz style; remove GameHud"`

---

### Task 9: `PlayScreen`: marco con título y pausa, presentación y pausa con cuenta regresiva

**Files:**
- Create: `src/screens/play/resumeTiming.ts`, `src/screens/play/ResumeCountdown.tsx`
- Modify: `src/screens/PlayScreen.tsx`, `src/screens/play/Instructions.tsx`, `src/screens/play/PauseOverlay.tsx`, `src/screens/play/Play.module.css`, `src/test/fakeGame.tsx`, `src/screens/PlayScreen.test.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `PlayChromeContext`, `PlayHud` (Task 3).
- Produces: `RESUME_STEP_MS = 1000` (en `resumeTiming.ts`, para que las pruebas lo reemplacen con `vi.mock`); `PauseOverlay({ onContinue, onExit, hud }: { onContinue: () => void; onExit: () => void; hud: PlayHud })`; `ResumeCountdown({ onDone }: { onDone: () => void })` muestra 3, 2, 1 (un `RESUME_STEP_MS` cada uno) y llama `onDone`.

- [ ] **Step 1: Pruebas que fallan** (`vi.mock('./play/resumeTiming', () => ({ RESUME_STEP_MS: 5 }))`; el juego falso pasa a renderizar `<GameFrame score={0} level={1}>…</GameFrame>`):

```tsx
test('the frame shows the game title and its ✕ opens the pause sheet with points', async () => {
  /* Comenzar → heading 'Juego falso' dentro de [data-game]; click 'Salir del juego' → 'Pausado' y 'puntos' con '0' */
});
test('continue counts down before the game runs again', async () => {
  /* pausa → Continuar → todavía 'paused:true' → findByText('paused:false') */
});
test('hiding the app during the countdown returns to the pause sheet', async () => {  // Review Focus #4
  /* Continuar → setHidden(true) antes de terminar → 'Pausado' visible y 'paused:true'; setHidden(false) */
});
test('the intro shows the area label', async () => { /* primera visita de 'fake' (área memory) → getByText('Memoria') */ });
```

  Actualizar `hidden tab pauses the game` para esperar la cuenta (`findByText('paused:false')`).

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/screens/PlayScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `PlaySession` provee `PlayChromeContext` con `title`, `onPause: () => setPaused(true)` y `reportHud` (guarda en un `ref`); en la fase `playing` desaparece su barra superior y queda `<section data-game={game.id}>` con el juego.
  - Pausa: la hoja (§5.2) muestra `t('play.paused')`, los segundos que quedan (si `remainingMs !== null`) con `play.timeLeft` «quedan» / «left» y los puntos con `play.points` «puntos» / «points»; botones «Continuar» y «Salir». El juego detrás queda oscurecido y desenfocado. «Continuar» pasa a un estado `resuming` (el juego sigue `paused`) con `ResumeCountdown`; al terminar, `paused = false`. `visibilitychange` oculto durante `resuming` → vuelve a la hoja.
  - `ResumeCountdown`: `aria-hidden="true"` (§7.2); números grandes en `--game` con halo; con movimiento reducido no escala.
  - Presentación (§5.1): etiqueta del área `t('areas.<área>')` con contorno y punto de `--game`, título grande, pasos numerados, ejemplo en tarjeta de vidrio, «Comenzar» como píldora rellena abajo; la versión de quien ya jugó conserva descripción y «¿Cómo se juega?».

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): play screen chrome, intro and pause with a 3-2-1 countdown"`

---

### Task 10: Resultado con conteo y celebración

**Files:**
- Create: `src/screens/play/useCountUp.ts`, `src/screens/play/useCountUp.test.ts`, `src/screens/play/ResultView.test.tsx`
- Modify: `src/screens/play/ResultView.tsx`, `src/screens/PlayScreen.tsx`, `src/screens/play/Play.module.css`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/play/useCountUp.test.ts`, `src/screens/play/ResultView.test.tsx`

**Interfaces:**
- Consumes: `prefersReducedMotion` (Task 2).
- Produces: `useCountUp(target: number, durationMs = 1200): number` (curva de desaceleración cúbica; `target` de inmediato con movimiento reducido); `ResultViewProps.daily` gana `progress: { done: number; total: number }`.

- [ ] **Step 1: Pruebas que fallan:**

```ts
// useCountUp.test.ts (matchMedia simulado que NO pide movimiento reducido; vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] }))
test('counts from 0 up to the target', () => { /* t=0 → 0; t=600 → entre 1 y 339; t=1200 → 340 */ });
test('reduced motion returns the target at once', () => { /* sin matchMedia → 340 en el primer render */ });
```

```tsx
// ResultView.test.tsx
test('the final score is available to screen readers at once', () => { /* getByText('Puntaje: 340') visualmente oculto */ });
test('a new best shows the celebration', () => { /* previousBest 100 → '¡Nueva mejor marca!' y [data-celebrate="true"] */ });
test('daily mode shows today’s progress', () => { /* progress {done: 2, total: 3} → 'Entrenamiento de hoy: 2 de 3' */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/screens/play`. Expected: FAIL.

- [ ] **Step 3: Implementar** según §5.3: puntaje visible `aria-hidden` con `useCountUp`, y `<p className="visually-hidden">{t('play.scoreValue', { score })}</p>` («Puntaje: {{score}}» / «Score: {{score}}»; reemplaza al `play.score` suelto, que se elimina si nada más lo usa); récord → rayos que giran y chispas (`data-celebrate="true"`, ocultos con movimiento reducido); precisión, nivel y mejor marca en tarjetas de vidrio; `play.dailyProgress` «Entrenamiento de hoy: {{done}} de {{total}}» / «Today's training: {{done}} of {{total}}»; botones como hoy. `PlaySession` calcula `progress` con `recorded.plan` (`completed.length`, `gameIds.length`).

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS (incluida `first visit … shows result with new best`, que busca '120').

- [ ] **Step 5: Commit.** `git commit -m "feat(luz): result screen with count-up, new-best celebration and daily progress"`

---

### Task 11: Pruebas en navegador y capturas para revisión

**Files:**
- Create: `e2e/luz.spec.ts`
- Modify: `e2e/touch-targets.spec.ts`
- Test: los mismos

- [ ] **Step 1: Pruebas e2e** (las que terminan partidas instalan `page.clock` y usan `finishCurrentGame` de `e2e/helpers.ts`, como `daily.spec.ts`; el idioma inglés se elige como en `i18n.spec.ts`):

```ts
test('games are dark even when the app is light', async ({ page }) => {
  /* colorScheme 'light' → ./#/play/arrows → getComputedStyle([data-luz]).backgroundColor contiene 'rgb(9, 11, 25)';
     volver a ./#/games → html sin data-luz-active y meta theme-color '#0E0F1A' */
});
test('no sideways scroll at 320 px in English', async ({ page }) => {  // Review Focus #3
  /* viewport 320×640, idioma en (ajuste), cada juego en partida → scrollWidth <= clientWidth */
});
test('reduced motion shows the final score at once', async ({ page }) => {  // Review Focus #5
  /* emulateMedia({ reducedMotion: 'reduce' }), terminar un juego con finishCurrentGame → el puntaje visible ya es el final sin esperar */
});
test('screenshots of the five games for review', async ({ page }) => {
  /* viewport 390×844: para cada juego, captura en partida y en resultado → test-results/luz/<juego>-{play,result}.png (sin aserciones visuales) */
});
```

  En `touch-targets.spec.ts`: `test('game controls are at least 44 px tall')` para los botones de Flechas en partida y las teclas de Cálculo relámpago.

- [ ] **Step 2: Ejecutar.** Run: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`. Expected: PASS; las capturas quedan en `test-results/luz/`.

- [ ] **Step 3: Verificación final.** Run: `npm run lint && npm run typecheck && npm test && npm run build`. Expected: PASS; `grep -c woff2 dist/sw.js` ≥ 1.

- [ ] **Step 4: Commit.** `git commit -m "test(luz): browser checks for the dark scope, narrow screens, reduced motion and review screenshots"`
