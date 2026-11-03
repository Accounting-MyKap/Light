# Guardagujas (Switchyard) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a Light el sexto juego, «Guardagujas»: enrutar trenes de colores por cambios de vía hasta la estación de su color, 90 s, área Atención.

**Architecture:** Geometría y mapas puros (planos a mano compilados a tramos, cambios y estaciones), un motor puro que avanza el tiempo en pasos de ≤ 20 ms, y un tablero SVG por capas con botones HTML encima de cada cambio. El componente corre un bucle `requestAnimationFrame` sobre el reloj del juego (`useGameClock`), así la pausa congela trenes y humo.

**Tech Stack:** React 19.3.1, TypeScript 6.0.3, CSS Modules, SVG, Vitest 5.0.5 + Testing Library (temporizadores falsos, que incluyen `requestAnimationFrame`), Playwright 1.64.1, Supabase (migración SQL + pgTAP).

**Spec:** `docs/superpowers/specs/2026-11-03-light-guardagujas-design.md`

## Global Constraints

- id `switchyard`; área `attention`; `GAME_DURATION_MS` propio de 90 000; `referenceScore` 900; `maxScore` 2000.
- Intervalo `round(4000 − (L−1)·2400/9)` ms; velocidad `70 + (L−1)·60/9` u/s; puntos `10 + 2·(L−1)`; primer tren a 1000 ms.
- Estaciones por nivel inicial: `3 + floor((clampLevel(L) − 1) / 2)` (3…7). Lienzo 360 × 500 u.
- Colores y formas de las estaciones, en este orden (el cian `#3fd4ff` queda para los cambios, color del área):
  rojo `#ff5a5a` círculo, amarillo `#ffd23f` cuadrado, verde `#4ddc84` triángulo, violeta `#b48cff` rombo,
  naranja `#ff9a3c` estrella, rosa `#ff6fcf` corazón, azul `#5b8cff` cruz.
- Fallo de llegada → `feedback('timeout')`; acierto → `feedback('correct')`; nunca `'wrong'` (sacude).
- Movimiento reducido: sin humo, sin faro, sin giro animado, anillos sin crecer; los trenes se mueven igual.
- Objetivos táctiles ≥ 44 px; sin desplazamiento horizontal a 320 px.
- Todo texto nuevo en ES y EN; identificadores y commits en inglés; commits con las líneas de coautoría de la sesión.

## Review Focus

1. **El teléfono se bloquea o el navegador frena los cuadros** (salto de varios segundos entre cuadros): los trenes no deben atravesar cambios ni estaciones de forma distinta a como lo harían con cuadros normales. → Task 3: `advanceSwitchyard(s, t+5000)` ≡ 250 avances de 20 ms.
2. **Alternar un cambio justo cuando pasa un tren**: la decisión es del instante en que la punta cruza el punto; alternar después no lo desvía. → Task 3.
3. **Pantalla angosta (320 px) o baja (horizontal)**: el tablero cabe sin desplazamiento horizontal y los cambios miden ≥ 44 px. → Task 7 (e2e).
4. **Pausa con trenes en camino**: al pausar no se mueven trenes ni humo y al seguir continúan desde el mismo lugar. → Task 6.
5. **Teclas de número sin cambio** (p. ej. `7` en un mapa de 3 estaciones): se ignoran y no anulan la acción del navegador. → Task 6.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/games/switchyard/geometry.ts` | `Point`, polilínea redondeada, largo acumulado, `poseAt`, `offsetPolyline`, `segmentsIntersect`. |
| `src/games/switchyard/maps.ts` | Planos (5), `compileMap`, `mirrorMap`, `mapForLevel`, `STATION_STYLES`, árboles. |
| `src/games/switchyard/engine.ts` | Estado, parámetros por nivel, `toggleSwitch`, `advanceSwitchyard`, `trainPose`, resultado. |
| `src/games/switchyard/smoke.ts` | `Puff`, `emitPuffs`, `agePuffs`. |
| `src/games/switchyard/art.tsx` | SVG de tren, estación, túnel, forma, árbol. |
| `src/games/switchyard/Board.tsx` | Tablero por capas + botones de cambios. |
| `src/games/switchyard/Game.tsx`, `Example.tsx`, `index.ts`, `switchyard.module.css` | Juego, ejemplo, definición, estilos. |
| `src/games/shared/GameFrame.tsx` | Prop `stageFlash`. |
| `src/games/registry.ts`, `src/i18n/{es,en}.json` | Registro y textos. |
| `supabase/migrations/20261103000000_switchyard.sql`, `supabase/tests/01_core_schema.test.sql` | Fila del juego y prueba. |
| `e2e/touch-targets.spec.ts`, `e2e/luz.spec.ts` | Objetivos táctiles, pantalla angosta, captura de revisión. |

---

### Task 1: Geometría

**Files:** Create `src/games/switchyard/geometry.ts`, `src/games/switchyard/geometry.test.ts`

**Interfaces — Produces:**
```ts
export interface Point { x: number; y: number }
export interface Polyline { points: Point[]; cumulative: number[]; length: number }
export interface Pose { x: number; y: number; angle: number }   // angle en grados, 0 = hacia +x, 90 = hacia +y
export function roundCorners(points: Point[], radius: number, step?: number): Point[]  // arcos muestreados cada ≤ step (3)
export function polyline(points: Point[]): Polyline
export function poseAt(line: Polyline, distance: number): Pose     // limita a [0, length]
export function offsetPolyline(points: Point[], offset: number): Point[]  // normal izquierda (+) / derecha (−)
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean // cruce propio (extremos compartidos no cuentan)
export function headingName(angle: number): 'right'|'down-right'|'down'|'down-left'|'left'|'up-left'|'up'|'up-right'
```

- [ ] **Step 1: Pruebas que fallan** — `polyline([(0,0),(30,40)]).length === 50`; `poseAt` a 25 → `(15,20)`, ángulo ≈ 53,13°; `poseAt` a −5 y 999 se limita a los extremos; `roundCorners` de una L de 100 + 100 con radio 20 conserva el primer y el último punto, su largo es 160 + 10π ± 1 y ningún tramo del arco mide más de 3,01; `offsetPolyline` de una recta hacia +x con offset 3 queda en y = 3 (normal = (−dy, dx)); `segmentsIntersect` en X verdadero, en T por extremo compartido falso, paralelos falso; `headingName(90) === 'down'`, `headingName(135) === 'down-left'`.
- [ ] **Step 2:** `npx vitest run src/games/switchyard/geometry.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar. Esquina: puntos de tangencia a `min(radius, mitad de cada lado)` de la esquina, arco circular muestreado.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit `feat(switchyard): track geometry`.

### Task 2: Mapas

**Files:** Create `src/games/switchyard/maps.ts`, `src/games/switchyard/maps.test.ts`

**Interfaces — Consumes:** Task 1. **Produces:**
```ts
export const BOARD = { width: 360, height: 500 } as const;
export const TUNNEL: Point;                         // boca del túnel (180, 34)
export type Shape = 'circle'|'square'|'triangle'|'diamond'|'star'|'heart'|'cross';
export const STATION_STYLES: readonly { color: string; shape: Shape }[];   // 7, orden de Global Constraints
export interface TrackSegment { id: number; line: Polyline; from: 'tunnel' | { switch: number }; end: { switch: number } | { station: number } }
export interface TrackSwitch { id: number; at: Point; exits: [number, number]; exitAngles: [number, number] }
export interface TrackStation { id: number; at: Point; style: number; route: [number, 0|1][]; approachAngle: number }
export interface TrackMap { key: string; segments: TrackSegment[]; switches: TrackSwitch[]; stations: TrackStation[]; trees: { x: number; y: number; r: number }[] }
export function compileMap(blueprint: Blueprint, key: string): TrackMap
export function mirrorMap(map: TrackMap): TrackMap
export function stationCountForLevel(level: number): number
export function mapFor(stationCount: number, mirrored: boolean): TrackMap
export const ALL_MAPS: readonly TrackMap[];         // 5 × {normal, espejo}
```
`Blueprint` = `{ points: Point[]; to: { station: number } | { left: Blueprint; right: Blueprint } }` (la rama raíz empieza en `TUNNEL`; cada rama hija empieza en el punto final de su padre).

- [ ] **Step 1: Pruebas que fallan** (para cada mapa de `ALL_MAPS`): N estaciones y N − 1 cambios (N = 3…7, y `stationCountForLevel` 1→3, 2→3, 3→4, 9→7, 10→7); todos los puntos de vías en [14, 346] × [14, 486]; ningún par de tramos se cruza (`segmentsIntersect` sobre sus polilíneas, ignorando pares que comparten nodo cerca del nodo); cambios a ≥ 70 u entre sí y de estaciones y túnel; estaciones a ≥ 64 u entre sí; `style` sin repetir; seguir `route` desde el túnel lleva a esa estación; `exitAngles` coincide con `poseAt` de cada salida a 18 u; árboles a ≥ 30 u de vías/estaciones/cambios/túnel y dentro del lienzo; `mirrorMap` refleja x y conserva rutas; `mapFor` es determinista.
- [ ] **Step 2:** `npx vitest run src/games/switchyard/maps.test.ts` → FAIL.
- [ ] **Step 3:** Implementar los 5 planos a mano (vías rectas y a 45°, esquinas redondeadas con radio 26) y la compilación; árboles con `createRng(seedFromString(key))`, candidatos en rejilla con jitter.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit `feat(switchyard): hand-drawn track maps`.

### Task 3: Motor

**Files:** Create `src/games/switchyard/engine.ts`, `src/games/switchyard/engine.test.ts`

**Interfaces — Consumes:** Tasks 1–2, `Staircase`/`createStaircase`/`stepStaircase`/`clampLevel`, `Rng`, `accuracyOf`. **Produces:**
```ts
export const SWITCHYARD_DURATION_MS = 90_000, SWITCHYARD_REFERENCE_SCORE = 900, SWITCHYARD_MAX_SCORE = 2000;
export const FIRST_TRAIN_MS = 1000, STEP_MS = 20, TRAIN_LENGTH = 52;
export function spawnIntervalMs(level: number): number; export function trainSpeed(level: number): number; export function arrivalPoints(level: number): number;
export interface Train { id: number; station: number; route: number[]; distance: number; arrived: boolean }
export interface Arrival { trainId: number; station: number; target: number; correct: boolean; points: number; at: number }
export interface SwitchyardState { map: TrackMap; switches: (0|1)[]; trains: Train[]; nextTrainId: number; nextSpawnAt: number; recentStations: number[]; staircase: Staircase; score: number; correct: number; total: number; now: number }
export function createSwitchyardGame(startLevel: number, rng: Rng, now: number): SwitchyardState
export function toggleSwitch(state: SwitchyardState, index: number): SwitchyardState   // índice fuera de rango → mismo estado
export function advanceSwitchyard(state: SwitchyardState, to: number, rng: Rng): { state: SwitchyardState; arrivals: Arrival[] }
export function trainPose(map: TrackMap, train: Train, back: number): Pose   // back = distancia hacia atrás desde la punta
export function switchyardResult(state: SwitchyardState, durationMs: number): GameResult
```

- [ ] **Step 1: Pruebas que fallan:** parámetros (4000/1600 ms, 70/130 u/s, 10/28 puntos); nada sale antes de 1000 ms, uno sale a 1000 y el siguiente a 1000 + intervalo; con la ruta de su estación el primer tren llega y suma `arrivalPoints(nivel)` y `correct` 1; con otra ruta, `correct` 0 y puntaje igual; alternar después de que la punta pasó el cambio no cambia su destino, alternar antes sí; nunca 3 estaciones iguales seguidas en 500 trenes; separación ≥ 112 u entre trenes del mismo tramo durante 90 s con cambios y aciertos al azar; `advance(t+5000)` ≡ 250 × 20 ms (mismo estado); `switchyardResult` = `{score, accuracy: correct/total, levelReached: maxLevel, durationMs}` con trenes en camino sin contar; el tren desaparece cuando su cola entra a la estación (`distance ≥ largo + TRAIN_LENGTH`).
- [ ] **Step 2:** `npx vitest run src/games/switchyard/engine.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (pasos de `STEP_MS`; mapa con `mapFor(stationCountForLevel(startLevel), rng() < 0.5)`; cambios iniciales al azar).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(switchyard): game engine`.

### Task 4: Humo

**Files:** Create `src/games/switchyard/smoke.ts`, `src/games/switchyard/smoke.test.ts`

**Interfaces — Produces:**
```ts
export const PUFF_EVERY_MS = 80, PUFF_LIFE_MS = 1100;
export interface Puff { id: string; x: number; y: number; born: number; dx: number; dy: number }
export interface SmokeState { puffs: Puff[]; lastEmit: Map<number, number> }
export function emitPuffs(smoke: SmokeState, sources: { trainId: number; x: number; y: number }[], now: number, rng: Rng): SmokeState
export function agePuffs(smoke: SmokeState, now: number): SmokeState
export function puffLook(puff: Puff, now: number): { x: number; y: number; r: number; opacity: number }  // r 2,5→10, opacity 0,5→0
```
- [ ] **Step 1: Pruebas que fallan:** una fuente durante 800 ms emite 10 bocanadas (una cada 80); `agePuffs` descarta las de edad ≥ 1100; `puffLook` en 0 → r 2,5 y opacidad 0,5, en 1100 → r 10 y 0; ids únicos.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npx vitest run src/games/switchyard/smoke.test.ts`).
- [ ] **Step 5:** Commit `feat(switchyard): locomotive smoke`.

### Task 5: Marco sin destello

**Files:** Modify `src/games/shared/GameFrame.tsx`, `src/games/shared/GameFrame.test.tsx`
**Interfaces — Produces:** `GameFrameProps.stageFlash?: boolean` (por defecto `true`).
- [ ] **Step 1:** Prueba: con `stageFlash={false}` y una señal `correct`, no hay `[data-flash]`; sin la prop sigue habiendo.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npx vitest run src/games/shared/GameFrame.test.tsx`).
- [ ] **Step 5:** Commit `feat(frame): games can draw their own answer reactions`.

### Task 6: Tablero, juego, ejemplo y registro

**Files:** Create `art.tsx`, `Board.tsx`, `Game.tsx`, `Example.tsx`, `index.ts`, `switchyard.module.css`, `Game.test.tsx` en `src/games/switchyard/`; Modify `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`.

**Interfaces — Consumes:** Tasks 1–5. **Produces:** `switchyardGame: GameDefinition`; `Board({ state, now, puffs, arrivals, onToggle, interactive, reducedMotion })`. DOM para pruebas: `[data-train][data-station]`, `[data-station-id][data-route="s:o s:o"]`, botones de cambio `[data-switch][data-option]`, `[data-arrival="correct"|"wrong"]`.

Textos (`games.switchyard`): `title` «Guardagujas»/«Switchyard»; `description`; ≥ 3 `instructions`; `switch` «Cambio {{n}}: {{direction}}»; `directions.*` (8 rumbos); `exampleAnswer`; `board` (nombre del tablero).

- [ ] **Step 1: Pruebas que fallan:** hay N − 1 botones «Cambio n: …»; clic alterna `data-option` y el nombre; la tecla `1` alterna el cambio 1 y una tecla sin cambio (`9`) no hace nada; en pausa ni clic ni tecla alternan y los trenes no se mueven (misma `transform` tras 2 s); termina una sola vez a los 90 s con `durationMs: 90000`; enrutar el primer tren según `data-route` de su estación suma puntos y muestra `[data-arrival="correct"]`; sin `[data-flash]`.
- [ ] **Step 2:** `npx vitest run src/games/switchyard` → FAIL.
- [ ] **Step 3:** Implementar arte, tablero (capas de la spec §5.3), juego (bucle rAF sobre `clock.now()`, humo con `prefersReducedMotion()`), ejemplo (tablero de 3 estaciones quieto, un tren antes del primer cambio, el cambio con faro), registro y textos.
- [ ] **Step 4:** `npx vitest run` completo → PASS (incluye la prueba del registro y la paridad de textos).
- [ ] **Step 5:** Commit `feat(switchyard): playable board with smoke and clear switches`.

### Task 7: Supabase, e2e y pulido visual

**Files:** Create `supabase/migrations/20261103000000_switchyard.sql`; Modify `supabase/tests/01_core_schema.test.sql` (6 juegos, conteo 6), `e2e/touch-targets.spec.ts`, `e2e/luz.spec.ts`, `README.md` (lista de juegos si aplica).
- [ ] **Step 1:** Migración `insert into public.games (id, area, max_score) values ('switchyard', 'attention', 2000);` y pgTAP actualizado.
- [ ] **Step 2:** e2e: cambios de vía ≥ 44 px; a 320 px sin desplazamiento horizontal; captura de revisión de una partida en curso (trenes, humo, cambios).
- [ ] **Step 3:** Revisar las capturas a 390 × 844, 320 × 640 y 1280 × 800 y pulir el arte hasta que se vea bien.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npx vitest run && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` → todo verde.
- [ ] **Step 5:** Commit `feat(switchyard): database row, e2e checks and polish`.
