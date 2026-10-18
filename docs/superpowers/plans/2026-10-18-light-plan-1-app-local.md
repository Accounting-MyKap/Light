# Light — Plan 1: App local (juegos, entrenamiento diario y progreso) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar en GitHub Pages una PWA en español e inglés con los 5 juegos de la v1, entrenamiento diario, racha y progreso, guardando todo en el dispositivo (sin servidor).

**Architecture:** SPA React + TypeScript con `HashRouter` y base `/Light/`. Cada juego es un módulo independiente (motor puro + componente) registrado en `src/games/registry.ts`. IndexedDB (Dexie) es la fuente de verdad; las pantallas leen con `useLiveQuery`. La lógica de dominio es pura y vive en `src/core/`.

**Tech Stack:** Node 22.13+ (CI: Node 24), React 19.3.1, Vite 8.3.4, TypeScript 6.0.3, Vitest 5.0.5 + jsdom 29.1.1 + Testing Library, Dexie 4.4.6 + dexie-react-hooks 4.4.0, i18next 26.5.2 + react-i18next 17.1.0, react-router-dom 7.18.4, vite-plugin-pwa 2.0.0, Playwright 1.64.1, ESLint 10.13.0 + typescript-eslint 8.71.2.

**Spec:** `docs/superpowers/specs/2026-10-18-light-brain-training-design.md` — este plan cubre §2, §3, §4, §5.1, §6 (casos sin servidor), §7, §8 (unitarias, componentes, E2E, CI) y las etapas 1–3 de §11, más la publicación en Pages.

**Alcance:** este es el Plan 1 de 3. Plan 2: Supabase para invitados (§5.2, §5.3, §5.5, §5.6). Plan 3: cuentas (§5.4) y `SETUP.md` (§9). Al terminar este plan, la app ya es útil sin servidor.

## Global Constraints

- Versiones exactas (`npm install --save-exact`): las de *Tech Stack*, más `@vitejs/plugin-react@6.1.2`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`, `@testing-library/user-event@14.6.8`, `@testing-library/jest-dom@7.0.1`, `fake-indexeddb@6.2.6`, `workbox-window@7.4.1`, `@eslint/js@10.0.1`, `eslint-plugin-react-hooks@7.1.1`, `globals@17.13.0`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`. **No usar TypeScript 7** (typescript-eslint exige `<6.1.0`) **ni jsdom 30** (exige Node ≥22.22.2).
- Playwright usa el Chromium preinstalado si existe `PW_CHROMIUM_PATH` (en este entorno: `/opt/pw-browsers/chromium`); en CI se instala con `npx playwright install --with-deps chromium`.
- Todo texto visible sale de `src/i18n/es.json` y `src/i18n/en.json`, que tienen exactamente las mismas claves. Por juego: `games.<id>.title`, `games.<id>.description` y `games.<id>.instructions` (arreglo de 2–3 frases).
- Marca: nombre "Light"; lema "Ilumina tu cerebro" (ES) / "Light up your brain" (EN).
- Textos honestos: ninguna promesa médica o cognitiva (spec §2.2).
- Sin publicidad, analítica ni peticiones de red externas (fuentes del sistema; nada de CDNs).
- Rutas: `HashRouter`; Vite `base: '/Light/'`.
- Niveles 1–10. Entre partidas: precisión ≥ 0.85 → +1; < 0.60 → −1. Dentro de la partida (juegos con reloj): 4 aciertos seguidos → +1; 2 errores seguidos → −1.
- Juegos con reloj: 60 000 ms. "Secuencia de luces": 8 rondas.
- Resultados: `id = crypto.randomUUID()` e inmutables (nunca se editan).
- Plan diario: 3 juegos de áreas distintas; prioriza las áreas menos jugadas en los últimos 7 días; evita los juegos del plan de ayer cuando sea posible; una vez generado, no cambia.
- Racha por fecha local; el día actual sin completar no rompe la racha.
- Puntaje por área: `min(1000, round(1000 × mejor de 30 días / referenceScore))`; el área es el promedio de sus juegos con datos.
- Accesibilidad: zonas táctiles ≥ 44×44 px; el color nunca es la única pista; contraste WCAG AA; respetar `prefers-reduced-motion`; todo se puede usar con teclado.
- Identificadores en inglés; mensajes de commit en inglés (`feat:`, `test:`, `chore:`, `ci:`).

## Review Focus

1. **Claves de traducción faltantes o distintas entre ES y EN** (incluidas las de cada juego nuevo): la app debe mostrar el texto, nunca la clave. → Prueba de paridad en Task 2 y prueba de claves por juego en Task 6.
2. **Toques fuera de tiempo:** tocar casillas mientras se muestra la secuencia, o un doble toque que respondería sin querer el ensayo siguiente. → Task 8 ignora la entrada en fase de muestra; Tasks 9–11 ignoran respuestas con tiempo de reacción < 150 ms.
3. **Pestaña oculta a mitad de partida:** el tiempo no avanza y no se disparan tiempos agotados mientras está pausado. → Pruebas del reloj en Task 6 y de pausa en Task 7.
4. **Cambios de día:** medianoche, fin de mes o de año, año bisiesto y horario de verano. Una partida diaria se marca en el día de su plan. → Pruebas de fechas en Task 4 y de racha y plan en Task 13.
5. **Entrada por teclado y entradas raras en "Cálculo relámpago":** ceros a la izquierda, enviar vacío, más de 4 dígitos, respuesta "0". Además, todos los juegos se pueden jugar con teclado. → Task 12 y las pruebas de teclado de cada juego.

## Mapa de archivos

| Ruta | Responsabilidad |
|---|---|
| `src/main.tsx`, `src/app/App.tsx` | Arranque (i18n, ajustes, tema) y rutas |
| `src/app/Layout.tsx`, `ErrorBoundary.tsx`, `UpdatePrompt.tsx`, `SettingsEffects.tsx` | Marco visual, errores por pantalla, aviso de versión nueva, aplicar idioma y tema |
| `src/app/theme.css`, `global.css`, `theme.ts` | Tokens claro/oscuro y `applyTheme` |
| `src/i18n/` | `detectLanguage`, `initI18n`, `es.json`, `en.json` |
| `src/core/` | `rng`, `dates`, `difficulty`, `sound`, `dailyPlan`, `streak`, `areaScore` (todo puro salvo `sound`) |
| `src/data/` | Dexie: `db`, `results`, `levels`, `settings`, `dailyPlans` |
| `src/games/types.ts`, `registry.ts`, `shared/` | Contrato de juego, registro, reloj, puntaje común, HUD y sonido |
| `src/games/<id>/` | `engine.ts`, `Game.tsx`, `Example.tsx`, `index.ts`, `<id>.module.css` y pruebas |
| `src/play/recordGameResult.ts` | Guardar resultado, nivel siguiente y marca diaria |
| `src/screens/` | Hoy, Juegos, Partida (+`play/`), Progreso (+`progress/`), Ajustes |
| `src/test/` | `renderApp`, juego falso para pruebas |
| `e2e/`, `playwright.config.ts` | Pruebas de punta a punta |
| `.github/workflows/ci.yml`, `deploy.yml` | CI y publicación en Pages |

---

### Task 1: Proyecto base y CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `src/main.tsx`, `src/app/App.tsx`, `src/setupTests.ts`, `src/vite-env.d.ts`, `.github/workflows/ci.yml`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: scripts npm `dev`, `build` (`tsc --noEmit -p tsconfig.json && vite build`), `preview`, `test` (`vitest run`), `typecheck`, `lint` (`eslint .`), `e2e` (`playwright test`); `export function App(): JSX.Element`.

- [ ] **Step 1: Crear `package.json`** (`"type": "module"`, `"private": true`, `"engines": { "node": ">=22.13" }`, los scripts de arriba) e instalar las dependencias exactas de *Global Constraints* (runtime: react, react-dom, dexie, dexie-react-hooks, i18next, react-i18next, react-router-dom; el resto como dev).

- [ ] **Step 2: Configuración.**
  - `tsconfig.json`: `strict`, `noEmit`, `jsx: react-jsx`, `moduleResolution: bundler`, `resolveJsonModule: true`, `types: ["vite/client", "vitest/globals", "@testing-library/jest-dom"]`, `include: ["src"]`.
  - `vite.config.ts`: `base: '/Light/'`, plugin react, `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/setupTests.ts'] }`.
  - `src/setupTests.ts`: importa `@testing-library/jest-dom/vitest` y `fake-indexeddb/auto`.
  - `eslint.config.js`: `tseslint.config` con `js.configs.recommended`, `tseslint.configs.recommended` y las reglas recomendadas de `react-hooks`; ignora `dist`.
  - `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.

- [ ] **Step 3: Escribir la prueba que falla** en `src/app/App.test.tsx`:

```tsx
test('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Light' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Verificar que falla.** Run: `npm test` — Expected: FAIL (no existe `App`).

- [ ] **Step 5: Implementar** `App` (un `<h1>Light</h1>` provisional), `src/main.tsx` (`createRoot(...).render(<App />)`) e `index.html` con `<div id="root">` y `lang="es"`.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint && npm run build` — Expected: 1 prueba PASS, sin errores; existe `dist/index.html`.

- [ ] **Step 7: CI.** `.github/workflows/ci.yml`: en `push` y `pull_request`, un job `checks` en `ubuntu-latest` con Node 24 (`actions/setup-node`, `cache: npm`) que ejecuta `npm ci`, `npm run lint`, `npm run typecheck` y `npm test`. Usar la última versión mayor publicada de cada acción.

- [ ] **Step 8: Commit.** `git add -A && git commit -m "chore: scaffold Vite React TypeScript app with tests and CI"`

---

### Task 2: Traducciones y tema

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/es.json`, `src/i18n/en.json`, `src/app/theme.css`, `src/app/global.css`, `src/app/theme.ts`
- Test: `src/i18n/i18n.test.ts`, `src/app/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Language = 'es' | 'en'`
  - `detectLanguage(saved: Language | null, browserLanguages: readonly string[]): Language`
  - `initI18n(language: Language): Promise<void>` (i18next + `initReactI18next`, `fallbackLng: 'en'`, `escapeValue: false`; también fija `document.documentElement.lang`)
  - `type ThemeSetting = 'auto' | 'light' | 'dark'`
  - `applyTheme(theme: ThemeSetting): void`
  - Claves iniciales: `app.name`, `app.tagline`, `nav.today|games|progress|settings`, `areas.memory|attention|speed|flexibility|math|logic|language`, `common.start|continue|exit|back|playAgain|next|howToPlay`, `errors.generic|backHome|gameNotFound`.

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
// i18n.test.ts
test.each([
  [null, ['es-CO', 'en'], 'es'], [null, ['en-US'], 'en'], [null, ['pt-BR'], 'en'],
  [null, [], 'en'], ['en', ['es-ES'], 'en'], ['es', ['en-US'], 'es'],
])('detectLanguage(%s, %j) = %s', (saved, langs, expected) => {
  expect(detectLanguage(saved as Language | null, langs)).toBe(expected);
});
test('es and en have identical key sets', () => {
  expect(flattenKeys(es).sort()).toEqual(flattenKeys(en).sort());
});
test('no empty strings', () => {
  for (const v of [...flattenValues(es), ...flattenValues(en)]) expect(v.trim()).not.toBe('');
});
test('no medical or cognitive-benefit claims', () => {
  const banned = [/alzheimer/i, /demencia/i, /dementia/i, /mejora tu memoria/i, /improve your memory/i,
    /\bIQ\b/, /coeficiente intelectual/i, /cl[ií]nicamente/i, /clinically/i,
    /cient[ií]ficamente probado/i, /scientifically proven/i];
  for (const v of [...flattenValues(es), ...flattenValues(en)]) for (const re of banned) expect(v).not.toMatch(re);
});
// theme.test.ts
test('applyTheme', () => {
  applyTheme('dark'); expect(document.documentElement.dataset.theme).toBe('dark');
  applyTheme('auto'); expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});
```

`flattenKeys` y `flattenValues` son ayudantes locales de la prueba; los arreglos se aplanan con el índice en la clave (`a.0`).

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/i18n src/app/theme.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `detectLanguage`: `saved` si existe; si no, `'es'` cuando el primer idioma del navegador empieza por `es`; en otro caso, `'en'`.
  - JSON con las claves iniciales en ambos idiomas.
  - `theme.css` define estos tokens en `:root` (claro) y los redefine en `@media (prefers-color-scheme: dark)` sin `[data-theme]`, además de `[data-theme="light"]` y `[data-theme="dark"]`:

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#F7F7FB` | `#0E0F1A` |
| `--surface` | `#FFFFFF` | `#1A1C2B` |
| `--text` | `#14141F` | `#F2F2F7` |
| `--text-muted` | `#5B5B6E` | `#A3A3B8` |
| `--accent` | `#F5A300` | `#FFC233` |
| `--accent-text` | `#14141F` | `#14141F` |
| `--success` | `#1F9D55` | `#3DD68C` |
| `--danger` | `#D64545` | `#FF6B6B` |
| `--glow` | `rgba(245,163,0,.35)` | `rgba(255,194,51,.45)` |

  - `global.css`: fuente del sistema, `body { background: var(--bg); color: var(--text) }`, `:focus-visible` con contorno de `--accent`, y desactivar animaciones bajo `prefers-reduced-motion: reduce`.

- [ ] **Step 4: Verificar.** Run: `npx vitest run src/i18n src/app/theme.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -am "feat: add i18n (es/en) and light/dark theme tokens"` (con `git add` de los archivos nuevos).

---

### Task 3: Marco de la app (rutas, navegación y errores)

**Files:**
- Modify: `src/app/App.tsx`, `src/main.tsx`
- Create: `src/app/Layout.tsx`, `src/app/ErrorBoundary.tsx`, `src/screens/TodayScreen.tsx`, `GamesScreen.tsx`, `ProgressScreen.tsx`, `SettingsScreen.tsx`, `PlayScreen.tsx` (marcadores con un `<h1>` traducido), `src/test/renderApp.tsx`
- Test: `src/app/App.test.tsx` (reemplaza la de Task 1), `src/app/ErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `initI18n`, claves `nav.*`, `errors.*`.
- Produces:
  - `AppRoutes(): JSX.Element`: `/` Hoy, `/games`, `/progress`, `/settings`, `/play/:gameId`; cada pantalla va envuelta en `ErrorBoundary`.
  - `App` = `<HashRouter><AppRoutes/></HashRouter>`.
  - `renderApp(route: string): Promise<RenderResult>`: inicializa i18n en `'es'` y renderiza `AppRoutes` dentro de un `MemoryRouter`.
  - `ErrorBoundary({ children })`.
  - `Layout`: encabezado con `app.name` y `app.tagline`, y una barra inferior `<nav>` con 4 `NavLink`. La barra se oculta en `/play/*`.

- [ ] **Step 1: Escribir las pruebas que fallan.**

```tsx
test('bottom navigation switches screens', async () => {
  await renderApp('/');
  const nav = screen.getByRole('navigation');
  for (const name of ['Hoy', 'Juegos', 'Progreso', 'Ajustes']) expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
  await userEvent.click(within(nav).getByRole('link', { name: 'Juegos' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
});
test('play route hides bottom navigation', async () => {
  await renderApp('/play/anything');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
test('ErrorBoundary shows fallback with link home', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const Boom = () => { throw new Error('boom'); };
  // render <MemoryRouter><ErrorBoundary><Boom/></ErrorBoundary></MemoryRouter> con i18n en 'es'
  expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/app` — Expected: FAIL.

- [ ] **Step 3: Implementar** `AppRoutes`, `Layout`, `ErrorBoundary` (componente de clase; el fallback usa `useTranslation` en un hijo funcional) y las pantallas marcador. `main.tsx` llama a `initI18n(detectLanguage(null, navigator.languages))` antes de renderizar; Task 15 lo cambia para leer el idioma guardado. Importar `theme.css` y `global.css`.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add app shell with routes, bottom navigation and error boundary"`

---

### Task 4: Utilidades de dominio (azar, fechas, dificultad)

**Files:**
- Create: `src/core/rng.ts`, `src/core/dates.ts`, `src/core/difficulty.ts`
- Test: `src/core/rng.test.ts`, `dates.test.ts`, `difficulty.test.ts`

**Interfaces:**
- Produces:

```ts
// rng.ts
export type Rng = () => number;                                  // [0, 1)
export function createRng(seed: number): Rng;                     // mulberry32
export function randomSeed(): number;                             // crypto.getRandomValues → uint32
export function seedFromString(text: string): number;             // FNV-1a 32 bits
export function randInt(rng: Rng, min: number, max: number): number; // inclusivo
export function pick<T>(rng: Rng, items: readonly T[]): T;
export function shuffle<T>(rng: Rng, items: readonly T[]): T[];   // copia
// dates.ts — días como 'YYYY-MM-DD' en hora local
export function localDay(date: Date): string;
export function addDays(day: string, delta: number): string;      // aritmética con Date.UTC (inmune al horario de verano)
export function daysBetween(from: string, to: string): number;
// difficulty.ts
export const MIN_LEVEL = 1; export const MAX_LEVEL = 10;
export function clampLevel(level: number): number;
export function nextStartLevel(startLevel: number, accuracy: number): number;
export interface Staircase { level: number; maxLevel: number; correctStreak: number; wrongStreak: number }
export function createStaircase(startLevel: number): Staircase;
export function stepStaircase(s: Staircase, correct: boolean): Staircase;
```

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
test('rng is deterministic and in range', () => {
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 5 }, a);
  expect(Array.from({ length: 5 }, b)).toEqual(xs);
  xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
});
test('randInt covers inclusive range only', () => {
  const r = createRng(1); const seen = new Set(Array.from({ length: 1000 }, () => randInt(r, 1, 3)));
  expect([...seen].sort()).toEqual([1, 2, 3]);
});
test('seedFromString', () => {
  expect(seedFromString('2026-10-18')).toBe(seedFromString('2026-10-18'));
  expect(seedFromString('2026-10-18')).not.toBe(seedFromString('2026-10-19'));
});
test('shuffle is a permutation', () => { expect(shuffle(createRng(3), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]); });

test('localDay uses local time', () => { expect(localDay(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18'); });
test.each([
  ['2026-12-31', 1, '2027-01-01'], ['2026-03-01', -1, '2026-02-28'], ['2024-03-01', -1, '2024-02-29'],
  ['2026-03-08', 1, '2026-03-09'], ['2026-11-01', 1, '2026-11-02'], ['2026-10-18', -6, '2026-10-12'],
])('addDays(%s, %d) = %s', (d, n, e) => { expect(addDays(d, n)).toBe(e); });
test('daysBetween', () => { expect(daysBetween('2026-10-18', '2026-10-20')).toBe(2); expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1); });

test.each([[5, 0.85, 6], [5, 0.84, 5], [5, 0.6, 5], [5, 0.59, 4], [10, 1, 10], [1, 0, 1]])(
  'nextStartLevel(%d, %d) = %d', (l, a, e) => { expect(nextStartLevel(l, a)).toBe(e); });
test('staircase: 4 correct up, 2 wrong down, clamps, maxLevel monotonic', () => {
  let s = createStaircase(3);
  for (let i = 0; i < 4; i++) s = stepStaircase(s, true);
  expect(s).toMatchObject({ level: 4, maxLevel: 4, correctStreak: 0 });
  s = stepStaircase(stepStaircase(stepStaircase(s, true), true), true);
  s = stepStaircase(s, false); s = stepStaircase(s, true);           // la racha se reinició
  expect(s.level).toBe(4);
  s = stepStaircase(stepStaircase(s, false), false);
  expect(s).toMatchObject({ level: 3, maxLevel: 4 });
  let top = createStaircase(10); for (let i = 0; i < 4; i++) top = stepStaircase(top, true);
  expect(top.level).toBe(10);
  let low = createStaircase(1); low = stepStaircase(stepStaircase(low, false), false);
  expect(low.level).toBe(1);
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/core` — Expected: FAIL.

- [ ] **Step 3: Implementar** las firmas de arriba. Un cambio de nivel en la escalera reinicia ambas rachas.

- [ ] **Step 4: Verificar.** Run: `npx vitest run src/core` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add seeded rng, local-date helpers and difficulty staircase"`

---

### Task 5: Capa de datos local (IndexedDB)

**Files:**
- Create: `src/data/db.ts`, `src/data/results.ts`, `src/data/levels.ts`, `src/data/settings.ts`
- Test: `src/data/data.test.ts`

**Interfaces:**
- Consumes: `localDay`, `clampLevel`, `Language`, `ThemeSetting`.
- Produces:

```ts
// db.ts — Dexie 'light', versión 1:
//   results 'id, gameId, day, playedAt, synced'; dailyPlans 'day'; gameLevels 'gameId'; settings 'id'
export interface StoredResult {
  id: string; gameId: string; level: number; score: number; accuracy: number; durationMs: number;
  isDaily: boolean; playedAt: string /* ISO */; day: string /* local */; synced: 0 | 1;
}
export interface DailyPlan { day: string; gameIds: string[]; completed: string[] }
export interface GameLevel { gameId: string; startLevel: number }
export const db: Dexie & { results: EntityTable<StoredResult,'id'>; dailyPlans: EntityTable<DailyPlan,'day'>;
  gameLevels: EntityTable<GameLevel,'gameId'>; settings: EntityTable<{ id: 'settings' } & Settings,'id'> };
export function clearAllData(): Promise<void>;
// results.ts
export function addResult(input: { gameId: string; level: number; score: number; accuracy: number;
  durationMs: number; isDaily: boolean; playedAt?: Date }): Promise<StoredResult>;
export function listResults(filter?: { gameId?: string; sinceDay?: string }): Promise<StoredResult[]>; // por playedAt ascendente
export function bestScore(gameId: string): Promise<number | null>;
// levels.ts
export function getStartLevel(gameId: string): Promise<number>;   // 1 por defecto
export function setStartLevel(gameId: string, level: number): Promise<void>; // aplica clampLevel
// settings.ts
export interface Settings { language: Language | null; sound: boolean; theme: ThemeSetting; seenInstructions: string[] }
export const DEFAULT_SETTINGS: Settings; // { language: null, sound: true, theme: 'auto', seenInstructions: [] }
export function getSettings(): Promise<Settings>;
export function updateSettings(patch: Partial<Settings>): Promise<Settings>;
export function useSettings(): Settings;                 // useLiveQuery; DEFAULT_SETTINGS mientras carga
```

- [ ] **Step 1: Escribir las pruebas que fallan** (`beforeEach(clearAllData)`):

```ts
test('addResult stores immutable record with local day', async () => {
  const r = await addResult({ gameId: 'g', level: 2, score: 50, accuracy: 0.5, durationMs: 60000, isDaily: false, playedAt: new Date(2026, 9, 18, 23, 30) });
  expect(r.id).toMatch(/^[0-9a-f-]{36}$/); expect(r.synced).toBe(0); expect(r.day).toBe('2026-10-18');
  expect(await db.results.get(r.id)).toEqual(r);
});
test('listResults filters and sorts', async () => {
  await addResult({ ...base, gameId: 'a', playedAt: new Date(2026, 9, 18) });
  await addResult({ ...base, gameId: 'a', playedAt: new Date(2026, 9, 10) });
  await addResult({ ...base, gameId: 'b', playedAt: new Date(2026, 9, 17) });
  expect((await listResults({ gameId: 'a' })).map((r) => r.day)).toEqual(['2026-10-10', '2026-10-18']);
  expect((await listResults({ sinceDay: '2026-10-17' })).map((r) => r.day)).toEqual(['2026-10-17', '2026-10-18']);
});
test('bestScore', async () => {
  expect(await bestScore('a')).toBeNull();
  await addResult({ ...base, gameId: 'a', score: 10 }); await addResult({ ...base, gameId: 'a', score: 30 });
  expect(await bestScore('a')).toBe(30);
});
test('levels default, persist and clamp', async () => {
  expect(await getStartLevel('a')).toBe(1);
  await setStartLevel('a', 4); expect(await getStartLevel('a')).toBe(4);
  await setStartLevel('a', 11); expect(await getStartLevel('a')).toBe(10);
});
test('settings default and merge', async () => {
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  await updateSettings({ sound: false });
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false });
});
test('clearAllData empties every table', async () => {
  await addResult(base); await setStartLevel('a', 3); await updateSettings({ sound: false });
  await clearAllData();
  expect(await db.results.count()).toBe(0); expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/data` — Expected: FAIL.

- [ ] **Step 3: Implementar** las firmas de arriba. `clearAllData` limpia todas las tablas dentro de una transacción.

- [ ] **Step 4: Verificar.** Run: `npx vitest run src/data` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add IndexedDB data layer for results, levels and settings"`

---

### Task 6: Marco común de los juegos

**Files:**
- Create: `src/games/types.ts`, `src/games/registry.ts`, `src/games/shared/constants.ts`, `clock.ts`, `scoring.ts`, `feedback.ts`, `GameHud.tsx`, `src/core/sound.ts`
- Test: `src/games/shared/clock.test.tsx`, `scoring.test.ts`, `src/games/registry.test.ts`, `src/core/sound.test.ts`

**Interfaces:**
- Consumes: `useSettings`, `es.json`/`en.json`.
- Produces:

```ts
// types.ts
export type Area = 'memory' | 'attention' | 'speed' | 'flexibility' | 'math' | 'logic' | 'language';
export const V1_AREAS: readonly Area[];   // ['memory','attention','speed','flexibility','math']
export interface GameResult { score: number; accuracy: number; levelReached: number; durationMs: number }
export interface GameProps { startLevel: number; paused: boolean; onFinish: (result: GameResult) => void }
export interface GameDefinition {
  id: string; area: Area; referenceScore: number; maxScore: number;
  Component: ComponentType<GameProps>; Example: ComponentType;   // Example: ejemplo visual estático para las instrucciones
}
// registry.ts
export const GAMES: readonly GameDefinition[];            // vacío por ahora; Tasks 8–12 agregan una línea cada una
export function getGame(id: string): GameDefinition | undefined;
// shared/constants.ts
export const GAME_DURATION_MS = 60_000; export const MIN_RT_MS = 150;
// shared/clock.ts — tiempo "activo" (excluye pausas), basado en Date.now()
export interface GameClock { now(): number }
export function useGameClock(paused: boolean): GameClock;
export function useCountdown(clock: GameClock, durationMs: number, paused: boolean, onDone: () => void): number; // ms restantes; marca cada 100 ms
export function useTrialTimeout(clock: GameClock, trialStartedAt: number, windowMs: number | null, paused: boolean, onTimeout: () => void): void;
// shared/scoring.ts
export function speedBonus(rtMs: number, windowMs: number): number;  // clamp(round(10 × (1 − rt/window)), 0, 10)
export function accuracyOf(correct: number, total: number): number;  // 0 si total = 0
// shared/feedback.ts
export function useFeedback(): (kind: 'correct' | 'wrong') => void;  // respeta settings.sound
// shared/GameHud.tsx
export function GameHud(props: { remainingMs?: number; score: number; level: number }): JSX.Element;
// core/sound.ts
export function playTone(kind: 'correct' | 'wrong' | 'finish'): void; // Web Audio; no hace nada si no hay AudioContext
```

- [ ] **Step 1: Escribir las pruebas que fallan** (relojes con `vi.useFakeTimers()`, hooks con `renderHook`):

```ts
test('game clock excludes paused time', () => {
  const { result, rerender } = renderHook(({ p }) => useGameClock(p), { initialProps: { p: false } });
  act(() => vi.advanceTimersByTime(1000)); expect(result.current.now()).toBe(1000);
  rerender({ p: true }); act(() => vi.advanceTimersByTime(5000));
  rerender({ p: false }); act(() => vi.advanceTimersByTime(500));
  expect(result.current.now()).toBe(1500);
});
test('countdown calls onDone once after active duration, never while paused', () => { /* 3000 ms; pausado 10 000 ms → no llama; reanudado 3000 ms → 1 llamada */ });
test('trial timeout resumes with remaining time after a pause', () => {
  // ventana de 1000; pausa a los 600; 5000 ms pausado; reanuda → onTimeout NO a los 399 ms y SÍ a los 400 ms
});
test('trial timeout restarts when trialStartedAt changes', () => { /* rerender con nuevo trialStartedAt a los 900 → no dispara a los 1000 */ });
test.each([[0, 1000, 10], [500, 1000, 5], [1000, 1000, 0], [1500, 1000, 0]])('speedBonus(%d,%d)=%d', (rt, w, e) => {
  expect(speedBonus(rt, w)).toBe(e);
});
test('accuracyOf', () => { expect(accuracyOf(0, 0)).toBe(0); expect(accuracyOf(3, 4)).toBe(0.75); });
test('playTone is a no-op without AudioContext', () => { expect(() => playTone('correct')).not.toThrow(); });
test('registry entries are valid', () => {
  const ids = GAMES.map((g) => g.id); expect(new Set(ids).size).toBe(ids.length);
  for (const g of GAMES) {
    expect(V1_AREAS).toContain(g.area);
    expect(g.maxScore).toBeGreaterThan(g.referenceScore); expect(g.referenceScore).toBeGreaterThan(0);
    for (const dict of [es, en]) {
      expect(dict.games[g.id].title).toBeTruthy(); expect(dict.games[g.id].description).toBeTruthy();
      expect(dict.games[g.id].instructions.length).toBeGreaterThanOrEqual(2);
    }
  }
  expect(getGame('nope')).toBeUndefined();
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games src/core/sound.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar** las firmas de arriba. Nota: este contrato ajusta el orientativo de la spec (§3.3). Los títulos salen de la convención `games.<id>.*` en lugar de campos `*Key`, y la pausa llega al juego como prop `paused`, porque la salida la maneja la pantalla de partida (por eso no hay `onAbandon`). Se agrega `maxScore`, que el Plan 2 usa para la tabla `games`. `GameHud` muestra el tiempo restante en segundos (si existe), el puntaje y el nivel, con textos de `game.hud.time|score|level` (agregar a ES y EN). La prueba de claves en JSON requiere `games: {}` en ambos archivos.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add shared game contract, registry, pause-aware clock and feedback"`

---

### Task 7: Pantalla de partida

**Files:**
- Modify: `src/screens/PlayScreen.tsx`
- Create: `src/screens/play/Instructions.tsx`, `src/screens/play/PauseOverlay.tsx`, `src/screens/play/ResultView.tsx`, `src/play/recordGameResult.ts`, `src/test/fakeGame.tsx`
- Test: `src/play/recordGameResult.test.ts`, `src/screens/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `getGame`, `GameDefinition`, `GameResult`, `getStartLevel`, `setStartLevel`, `addResult`, `bestScore`, `nextStartLevel`, `useSettings`, `updateSettings`.
- Produces:

```ts
export function recordGameResult(args: { game: GameDefinition; startLevel: number; result: GameResult; daily: string | null }):
  Promise<{ stored: StoredResult; previousBest: number | null; newStartLevel: number }>;
// fakeGame.tsx: fakeGame: GameDefinition (id 'fake', area 'memory', referenceScore 100, maxScore 1000).
// Su Component muestra "paused:<true|false>" y un botón "Terminar" que llama a
// onFinish({ score: 120, accuracy: 0.9, levelReached: 2, durationMs: 60000 }).
// registerFakeGameTranslations(): agrega con i18n.addResourceBundle (es y en) las claves
// games.fake.title = "Juego falso", description e instructions (2 frases).
```

Flujo de `/play/:gameId?daily=<YYYY-MM-DD>` (el parámetro `daily` solo se usa desde Task 13):
1. Juego desconocido → `errors.gameNotFound` y enlace al inicio.
2. Si el juego no está en `settings.seenInstructions` → `Instructions` (título, frases de `games.<id>.instructions`, `<Example/>`, botón `common.start`); al empezar se agrega a `seenInstructions`. Si ya está → pantalla de inicio con el título, `common.start` y `common.howToPlay` (abre `Instructions`).
3. En juego: botón "X" (etiqueta `play.exit`) que pausa y abre `PauseOverlay`. `visibilitychange` con `document.hidden` también pausa. El overlay ofrece `common.continue` y `common.exit`; salir vuelve atrás (`navigate(-1)`, o `/games` si no hay historial) **sin guardar**.
4. `onFinish` → `recordGameResult` → `ResultView`: puntaje, mejor marca, `play.newBest` si `previousBest === null` o el puntaje la supera, precisión en %, nivel alcanzado. Botones en modo libre: `common.playAgain` (reinicia con el nivel nuevo) y `common.back` (a `/games`).

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
test('recordGameResult stores result and next start level', async () => {
  const first = await recordGameResult({ game: fakeGame, startLevel: 3, result: { score: 120, accuracy: 0.9, levelReached: 4, durationMs: 60000 }, daily: null });
  expect(first.previousBest).toBeNull(); expect(first.newStartLevel).toBe(4);
  expect(first.stored).toMatchObject({ gameId: 'fake', level: 4, score: 120, isDaily: false });
  expect(await getStartLevel('fake')).toBe(4);
  const second = await recordGameResult({ game: fakeGame, startLevel: 4, result: { score: 80, accuracy: 0.5, levelReached: 4, durationMs: 60000 }, daily: null });
  expect(second.previousBest).toBe(120); expect(second.newStartLevel).toBe(3);
});
// PlayScreen.test.tsx — vi.mock('../games/registry') → GAMES [fakeGame]; registerFakeGameTranslations(); renderApp('/play/fake')
test('first visit shows instructions, then plays and shows result with new best', async () => {
  expect(screen.getByRole('heading', { name: 'Juego falso' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  expect((await getSettings()).seenInstructions).toContain('fake');
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(await db.results.count()).toBe(1);
});
test('second visit skips instructions but offers how-to-play', async () => { /* seenInstructions ['fake'] → hay "¿Cómo se juega?" y no hay lista de instrucciones */ });
test('hidden tab pauses the game', async () => {
  // empezar; Object.defineProperty(document, 'hidden', { value: true, configurable: true }); dispatch 'visibilitychange'
  // → aparece "Pausado" y el texto "paused:true"; clic en "Continuar" → "paused:false"
});
test('exit from pause does not save', async () => { /* X → Salir → db.results.count() === 0 */ });
test('unknown game id', async () => { /* renderApp('/play/nope') → "No encontramos ese juego" + enlace al inicio */ });
```

(Los textos exactos en español salen de las claves nuevas `play.*`; agregarlas en ES y EN.)

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/play src/screens/PlayScreen.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implementar** las firmas y el flujo de arriba. La pantalla de partida ocupa toda la pantalla, sin barra inferior.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add play screen with instructions, pause, result and level progression"`

---

### Task 8: Juego "Secuencia de luces" (memoria)

**Files:**
- Create: `src/games/sequence-lights/engine.ts`, `Game.tsx`, `Example.tsx`, `index.ts`, `sequence-lights.module.css`
- Modify: `src/games/registry.ts` (+1 línea), `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/sequence-lights/engine.test.ts`, `Game.test.tsx`

**Interfaces:**
- Consumes: `Rng`, `createRng`, `randomSeed`, `GameProps`, `GameResult`, `useFeedback`, `GameHud`.
- Produces:

```ts
export const ROUNDS = 8; export const SHOW_MS = 600; export const GAP_MS = 250;
export const SEQUENCE_MAX_SCORE = 960; export const SEQUENCE_REFERENCE_SCORE = 600;
export function spanForLevel(level: number): number;               // nivel + 2 (3..12)
export function gridSizeForSpan(span: number): 3 | 4 | 5;          // 3–5 → 3, 6–8 → 4, 9–12 → 5
export function makeSequence(span: number, gridSize: number, rng: Rng): number[]; // sin la misma casilla dos veces seguidas
export interface SequenceState { level: number; maxLevel: number; round: number; gridSize: 3 | 4 | 5;
  sequence: number[]; input: number[]; score: number; correctRounds: number; finished: boolean }
export type PressOutcome = 'continue' | 'round-correct' | 'round-wrong';
export function createSequenceGame(startLevel: number, rng: Rng): SequenceState;
export function pressCell(state: SequenceState, cell: number, rng: Rng): { state: SequenceState; outcome: PressOutcome };
export function sequenceResult(state: SequenceState, durationMs: number): GameResult; // accuracy = correctRounds/8; levelReached = maxLevel
export const sequenceLightsGame: GameDefinition;                    // id 'sequence-lights', area 'memory'
```

- [ ] **Step 1: Escribir las pruebas del motor que fallan.**

```ts
test.each([[1, 3], [10, 12]])('spanForLevel(%d)=%d', (l, s) => expect(spanForLevel(l)).toBe(s));
test.each([[3, 3], [5, 3], [6, 4], [8, 4], [9, 5], [12, 5]])('gridSizeForSpan(%d)=%d', (s, g) => expect(gridSizeForSpan(s)).toBe(g));
test('makeSequence', () => {
  const seq = makeSequence(5, 3, createRng(7));
  expect(seq).toHaveLength(5); seq.forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(9); });
  seq.slice(1).forEach((c, i) => expect(c).not.toBe(seq[i]));
});
test('full correct input scores span×10 and levels up', () => {
  const rng = createRng(1); let s = createSequenceGame(1, rng); const seq = s.sequence; let out: PressOutcome = 'continue';
  for (const c of seq) ({ state: s, outcome: out } = pressCell(s, c, rng));
  expect(out).toBe('round-correct');
  expect(s).toMatchObject({ score: 30, level: 2, maxLevel: 2, round: 1, correctRounds: 1, input: [] });
  expect(s.sequence).toHaveLength(4);
});
test('wrong press ends round, drops level (min 1)', () => {
  const rng = createRng(2); let s = createSequenceGame(2, rng);
  const wrong = (s.sequence[0] + 1) % (s.gridSize * s.gridSize);
  const r = pressCell(s, wrong, rng);
  expect(r.outcome).toBe('round-wrong'); expect(r.state).toMatchObject({ level: 1, score: 0, round: 1, correctRounds: 0 });
  s = createSequenceGame(1, rng); expect(pressCell(s, (s.sequence[0] + 1) % 9, rng).state.level).toBe(1);
});
test('finishes after 8 rounds and ignores further presses', () => {
  /* 8 rondas con error → finished true; pressCell sobre el estado terminado devuelve el mismo objeto y 'continue' */
});
test('sequenceResult', () => { /* 2 rondas correctas de 8 → accuracy 0.25, levelReached = maxLevel */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/sequence-lights` — Expected: FAIL.

- [ ] **Step 3: Implementar el motor.**

- [ ] **Step 4: Escribir las pruebas del componente que fallan** (temporizadores falsos; cada casilla es un `<button>` con `aria-label` "Casilla N" y `data-lit="true"` mientras está encendida):
  - Mientras se muestra la secuencia, los clics no hacen nada: al terminar la muestra, `input` sigue vacío, sin efecto visible. *(Review Focus #2)*
  - Leer el orden de la secuencia avanzando `SHOW_MS + GAP_MS` por paso y anotando la casilla con `data-lit`; luego hacer clic en ese orden → aparece la retroalimentación de acierto.
  - Con 8 rondas falladas (un clic erróneo en cada una), `onFinish` se llama una vez con `accuracy: 0`.
  - Teclado: las casillas son botones y se activan con Enter.

- [ ] **Step 5: Implementar** `Game.tsx`: fase de muestra → fase de entrada → retroalimentación de 600 ms → siguiente ronda. Si se pausa durante la muestra, al reanudar la secuencia se muestra de nuevo desde el principio. La casilla encendida usa `--accent` y `--glow` (sin pulso con movimiento reducido). `durationMs` es el tiempo activo del reloj. `Example.tsx`: cuadrícula 3×3 estática con 3 casillas numeradas 1-2-3. Textos ES/EN: `games.sequence-lights.*` y `games.sequence-lights.cell` ("Casilla {{n}}" / "Cell {{n}}"). Registrar en `GAMES`.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS (también la prueba del registro de Task 6).

- [ ] **Step 7: Commit.** `git commit -m "feat: add Sequence Lights memory game"`

---

### Task 9: Juego "Flechas" (atención)

**Files:**
- Create: `src/games/arrows/engine.ts`, `Game.tsx`, `Example.tsx`, `index.ts`, `arrows.module.css`
- Modify: `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/arrows/engine.test.ts`, `Game.test.tsx`

**Interfaces:**
- Consumes: `Staircase`, `createStaircase`, `stepStaircase`, `speedBonus`, `accuracyOf`, `MIN_RT_MS`, `GAME_DURATION_MS`, `useGameClock`, `useCountdown`, `useTrialTimeout`.
- Produces:

```ts
export type Direction = 'left' | 'right';
export interface ArrowTrial { direction: Direction; congruent: boolean }
export const ARROWS_MAX_SCORE = 8000; export const ARROWS_REFERENCE_SCORE = 1400;
export function incongruentRatio(level: number): number;   // 0.30 + (level − 1) × 0.40/9
export function arrowWindowMs(level: number): number;      // round(2000 − (level − 1) × 1300/9)
export function makeArrowTrial(level: number, rng: Rng): ArrowTrial;
export interface ArrowsState { staircase: Staircase; trial: ArrowTrial; trialStartedAt: number; score: number; correct: number; total: number }
export function createArrowsGame(startLevel: number, rng: Rng, now: number): ArrowsState;
export function answerArrow(state: ArrowsState, answer: Direction, now: number, rng: Rng): { state: ArrowsState; correct: boolean | null }; // null = ignorada (rt < MIN_RT_MS)
export function timeoutArrow(state: ArrowsState, now: number, rng: Rng): ArrowsState;
export function arrowsResult(state: ArrowsState, durationMs: number): GameResult;
export const arrowsGame: GameDefinition;                    // id 'arrows', area 'attention'
```

- [ ] **Step 1: Escribir las pruebas del motor que fallan.**

```ts
test('level parameters', () => {
  expect(incongruentRatio(1)).toBeCloseTo(0.3); expect(incongruentRatio(10)).toBeCloseTo(0.7);
  expect(arrowWindowMs(1)).toBe(2000); expect(arrowWindowMs(10)).toBe(700);
});
test('incongruent frequency follows level', () => {
  const r = createRng(5); const n = 2000;
  const inc = Array.from({ length: n }, () => makeArrowTrial(10, r)).filter((t) => !t.congruent).length / n;
  expect(inc).toBeGreaterThan(0.65); expect(inc).toBeLessThan(0.75);
});
test('correct answer scores 10 + speed bonus', () => {
  const r = createRng(1); const s = createArrowsGame(1, r, 0);
  const { state, correct } = answerArrow(s, s.trial.direction, 1000, r);
  expect(correct).toBe(true); expect(state).toMatchObject({ score: 15, correct: 1, total: 1, trialStartedAt: 1000 });
});
test('wrong or late answers count as errors', () => {
  const r = createRng(1); const s = createArrowsGame(1, r, 0);
  const other = s.trial.direction === 'left' ? 'right' : 'left';
  expect(answerArrow(s, other, 500, r).state).toMatchObject({ score: 0, correct: 0, total: 1 });
  expect(answerArrow(s, s.trial.direction, 2001, r).correct).toBe(false);
});
test('answers faster than 150 ms are ignored (double tap)', () => {
  const r = createRng(1); const s = createArrowsGame(1, r, 0);
  const res = answerArrow(s, s.trial.direction, 149, r); expect(res.correct).toBeNull(); expect(res.state).toBe(s);
});
test('timeout counts as error and starts new trial', () => {
  const r = createRng(1); const s = timeoutArrow(createArrowsGame(1, r, 0), 2000, r);
  expect(s).toMatchObject({ total: 1, correct: 0, trialStartedAt: 2000 });
});
test('arrowsResult', () => { /* 3 de 4 → accuracy 0.75; levelReached = staircase.maxLevel */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/arrows` — Expected: FAIL.

- [ ] **Step 3: Implementar el motor.** Cada respuesta o tiempo agotado avanza la escalera; el ensayo siguiente usa el nivel nuevo.

- [ ] **Step 4: Escribir las pruebas del componente que fallan.** Las teclas `ArrowLeft`/`ArrowRight` responden; existen dos botones con etiquetas `games.arrows.left|right`; avanzar 60 000 ms llama a `onFinish` una vez con `durationMs: 60000`.

- [ ] **Step 5: Implementar** `Game.tsx`: fila de 5 flechas SVG (la central indica la respuesta; las laterales son iguales si es congruente y opuestas si no), `useTrialTimeout` con `arrowWindowMs(level)` y `GameHud`. `Example.tsx`: una fila incongruente con la flecha central resaltada. Textos ES/EN y registro.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat: add Arrows attention game"`

---

### Task 10: Juego "¿Igual o distinto?" (velocidad)

**Files:**
- Create: `src/games/same-different/engine.ts`, `symbols.tsx`, `Game.tsx`, `Example.tsx`, `index.ts`, `same-different.module.css`
- Modify: `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/same-different/engine.test.ts`, `Game.test.tsx`

**Interfaces:**
- Consumes: igual que Task 9.
- Produces:

```ts
export type SymbolId = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'cross'
  | 'tri-up' | 'tri-down' | 'tri-left' | 'tri-right' | 'diamond'
  | 'dot-tl' | 'dot-tr' | 'dot-bl' | 'dot-br' | 'dot-center' | 'dot-none';
export const SAME_DIFF_MAX_SCORE = 12000; export const SAME_DIFF_REFERENCE_SCORE = 1500;
export function symbolPool(level: number): readonly SymbolId[];
//   1–3: circle, square, triangle, star, heart, cross
//   4–7: tri-up, tri-down, tri-left, tri-right, diamond, square
//   8–10: dot-tl, dot-tr, dot-bl, dot-br, dot-center, dot-none (cuadrado con un punto en distinta posición)
export function timeLimitMs(level: number): number;         // round(3000 − (level − 1) × 2000/9)
export function streakMultiplier(streak: number): 1 | 2 | 3; // ≥10 → 3; ≥5 → 2; si no, 1
export function nextSymbol(previous: SymbolId, level: number, rng: Rng): SymbolId; // 50 % igual; si no, otro del pool del nivel
export interface SameDiffState { staircase: Staircase; previous: SymbolId; current: SymbolId; trialStartedAt: number;
  score: number; streak: number; correct: number; total: number }
export function createSameDiffGame(startLevel: number, rng: Rng, now: number): SameDiffState;
export function answerSameDiff(state: SameDiffState, answer: 'same' | 'different', now: number, rng: Rng): { state: SameDiffState; correct: boolean | null };
export function timeoutSameDiff(state: SameDiffState, now: number, rng: Rng): SameDiffState;
export function sameDiffResult(state: SameDiffState, durationMs: number): GameResult;
export function SymbolGlyph(props: { id: SymbolId; label: string }): JSX.Element; // symbols.tsx, SVG
export const sameDifferentGame: GameDefinition;              // id 'same-different', area 'speed'
```

- [ ] **Step 1: Escribir las pruebas del motor que fallan.**

```ts
test('pools and time limits by level', () => {
  expect(symbolPool(3)).toContain('heart'); expect(symbolPool(4)).toContain('tri-up'); expect(symbolPool(8)).toContain('dot-tl');
  expect(timeLimitMs(1)).toBe(3000); expect(timeLimitMs(10)).toBe(1000);
});
test.each([[4, 1], [5, 2], [9, 2], [10, 3]])('streakMultiplier(%d)=%d', (s, m) => expect(streakMultiplier(s)).toBe(m));
test('nextSymbol is same ~50% and different never equals previous', () => {
  const r = createRng(9); let same = 0;
  for (let i = 0; i < 2000; i++) { const n = nextSymbol('circle', 2, r); if (n === 'circle') same++; else expect(symbolPool(2)).toContain(n); }
  expect(same / 2000).toBeGreaterThan(0.45); expect(same / 2000).toBeLessThan(0.55);
});
test('streak multiplies points and resets on error', () => {
  /* 5 respuestas correctas (cada una 200 ms después del inicio de su ensayo) → puntos 10,10,10,10,20 → score 60;
     luego una incorrecta → streak 0, score 60 */
});
test('after answering, previous becomes old current', () => { /* state.previous === s.current; trialStartedAt === now */ });
test('timeout is an error; answers under 150 ms are ignored', () => { /* timeout → total+1, streak 0; rt 100 → correct null y mismo estado */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/same-different` — Expected: FAIL.

- [ ] **Step 3: Implementar el motor.**

- [ ] **Step 4: Escribir las pruebas del componente que fallan.** Primero se muestra el símbolo inicial durante 1500 ms, sin botones activos. Después, `ArrowLeft` = "No" (distinto) y `ArrowRight` = "Sí" (igual) responden. A los 60 000 ms activos se llama a `onFinish` una vez.

- [ ] **Step 5: Implementar** `symbols.tsx` (SVG simples con `--text` y `aria-label` traducido en `games.same-different.symbols.<id>`), `Game.tsx` (intro de 1500 ms; la ventana del primer ensayo empieza cuando aparece `current`) y `Example.tsx` (dos símbolos iguales con la respuesta "Sí" marcada). Textos ES/EN y registro.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat: add Same or Different speed game"`

---

### Task 11: Juego "Cambio de regla" (flexibilidad)

**Files:**
- Create: `src/games/rule-switch/engine.ts`, `Card.tsx`, `Game.tsx`, `Example.tsx`, `index.ts`, `rule-switch.module.css`
- Modify: `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/rule-switch/engine.test.ts`, `Game.test.tsx`

**Interfaces:**
- Consumes: igual que Task 9, más `randInt`.
- Produces:

```ts
export type Shape = 'circle' | 'square' | 'triangle'; export type CardColor = 'blue' | 'orange' | 'purple';
export type Rule = 'color' | 'shape'; export type Side = 'left' | 'right';
export interface Card { shape: Shape; color: CardColor }
export const COLOR_STYLE: Record<CardColor, { hex: string; pattern: 'solid' | 'stripes' | 'dots' }>;
//   blue #3D7BFF solid · orange #FF9F1C stripes · purple #B05CFF dots
export const RULE_SWITCH_MAX_SCORE = 10000; export const RULE_SWITCH_REFERENCE_SCORE = 1400;
export interface RuleTrial { stimulus: Card; left: Card; right: Card; correctSide: Side }
export function makeRuleTrial(rule: Rule, rng: Rng): RuleTrial;   // un objetivo coincide solo en color y el otro solo en forma
export function baseSwitchInterval(level: number): number;        // round(6 − (level − 1) × 4/9) → 6..2
export function switchInterval(level: number, rng: Rng): number;  // max(1, base + randInt(−1, 1))
export function ruleWindowMs(level: number): number;              // round(3000 − (level − 1) × 1800/9) → 3000..1200
export interface RuleSwitchState { staircase: Staircase; rule: Rule; trialsUntilSwitch: number; justSwitched: boolean;
  trial: RuleTrial; trialStartedAt: number; score: number; correct: number; total: number }
export function createRuleSwitchGame(startLevel: number, rng: Rng, now: number): RuleSwitchState;
export function answerRule(state: RuleSwitchState, side: Side, now: number, rng: Rng): { state: RuleSwitchState; correct: boolean | null };
export function timeoutRule(state: RuleSwitchState, now: number, rng: Rng): RuleSwitchState;
export function ruleSwitchResult(state: RuleSwitchState, durationMs: number): GameResult;
export const ruleSwitchGame: GameDefinition;                       // id 'rule-switch', area 'flexibility'
```

- [ ] **Step 1: Escribir las pruebas del motor que fallan.**

```ts
test('trial invariants', () => {
  const r = createRng(3);
  for (let i = 0; i < 500; i++) for (const rule of ['color', 'shape'] as const) {
    const t = makeRuleTrial(rule, r); const sides = [t.left, t.right];
    const colorOnly = sides.filter((c) => c.color === t.stimulus.color && c.shape !== t.stimulus.shape);
    const shapeOnly = sides.filter((c) => c.shape === t.stimulus.shape && c.color !== t.stimulus.color);
    expect(colorOnly).toHaveLength(1); expect(shapeOnly).toHaveLength(1);
    const target = t.correctSide === 'left' ? t.left : t.right;
    expect(target).toBe(rule === 'color' ? colorOnly[0] : shapeOnly[0]);
  }
});
test('switch intervals', () => {
  expect(baseSwitchInterval(1)).toBe(6); expect(baseSwitchInterval(10)).toBe(2);
  const r = createRng(4); for (let i = 0; i < 200; i++) { const v = switchInterval(10, r); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(3); }
  expect(ruleWindowMs(1)).toBe(3000); expect(ruleWindowMs(10)).toBe(1200);
});
test('rule flips when countdown reaches zero and marks justSwitched', () => {
  /* crear estado con trialsUntilSwitch 1 → responder → rule cambia, justSwitched true; responder otra vez → justSwitched false */
});
test('scoring: 10 + speed bonus, +5 right after a switch', () => {
  /* rt 1500 con ventana 3000 → +15; con justSwitched → +20 */
});
test('timeout and fast answers', () => { /* timeout = error; rt 100 → correct null y mismo estado */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/rule-switch` — Expected: FAIL.

- [ ] **Step 3: Implementar el motor.** Tanto una respuesta como un tiempo agotado descuentan `trialsUntilSwitch`.

- [ ] **Step 4: Escribir las pruebas del componente que fallan.**
  - El cartel de la regla muestra "COLOR" o "FORMA" (`games.rule-switch.rule.color|shape`) junto a un ícono.
  - Cada carta tiene un `aria-label` del tipo "círculo azul".
  - El color de cada carta va acompañado de su patrón: `data-pattern` vale `solid`, `stripes` o `dots`.
  - `ArrowLeft` y `ArrowRight` eligen la carta de la izquierda o de la derecha.
  - A los 60 000 ms se llama a `onFinish`.

- [ ] **Step 5: Implementar** `Card.tsx` (forma SVG rellena con `COLOR_STYLE` y un patrón SVG), `Game.tsx` (estímulo arriba, dos objetivos abajo, cartel con breve animación al cambiar, sin animación con movimiento reducido) y `Example.tsx`. Textos ES/EN (formas, colores, reglas) y registro.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat: add Rule Switch flexibility game"`

---

### Task 12: Juego "Cálculo relámpago" (matemáticas)

**Files:**
- Create: `src/games/quick-math/engine.ts`, `Keypad.tsx`, `Game.tsx`, `Example.tsx`, `index.ts`, `quick-math.module.css`
- Modify: `src/games/registry.ts`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/games/quick-math/engine.test.ts`, `Game.test.tsx`

**Interfaces:**
- Consumes: `Staircase`, `createStaircase`, `stepStaircase`, `randInt`, `accuracyOf`, `GAME_DURATION_MS`, hooks de reloj.
- Produces:

```ts
export type Op = '+' | '-' | '×' | '÷' | '+×';
export interface Problem { a: number; b: number; c?: number; op: Op; answer: number }
export const QUICK_MATH_MAX_SCORE = 8000; export const QUICK_MATH_REFERENCE_SCORE = 500; export const MAX_INPUT_DIGITS = 4;
export function makeProblem(level: number, rng: Rng): Problem;
export function formatProblem(p: Problem): string;    // '7 + 5', '12 − 4', '6 × 7', '56 ÷ 8', '3 + 4 × 5'
export interface QuickMathState { staircase: Staircase; problem: Problem; input: string; score: number; correct: number; total: number }
export function createQuickMathGame(startLevel: number, rng: Rng): QuickMathState;
export function typeDigit(state: QuickMathState, digit: number): QuickMathState;
export function deleteDigit(state: QuickMathState): QuickMathState;
export function submitAnswer(state: QuickMathState, rng: Rng): { state: QuickMathState; correct: boolean | null }; // null = vacío, sin efecto
export function skipProblem(state: QuickMathState, rng: Rng): QuickMathState;   // cuenta como error
export function quickMathResult(state: QuickMathState, durationMs: number): GameResult;
export const quickMathGame: GameDefinition;              // id 'quick-math', area 'math'
```

Tabla de niveles (`makeProblem`; todas las respuestas son enteros ≥ 0):

| Nivel | Operación | Rangos |
|---|---|---|
| 1 | a + b | a, b ∈ 1..9 |
| 2 | a + b o a − b | a, b ∈ 1..9; resta con a ≥ b |
| 3 | a − b o a + b | resta: a ∈ 10..20, b ∈ 1..9; suma: a ∈ 10..20, b ∈ 1..9 |
| 4 | a × b | a, b ∈ 2..5 |
| 5 | a × b | a, b ∈ 2..9 |
| 6 | a + b | a, b ∈ 10..99 |
| 7 | a − b | a, b ∈ 10..99, a ≥ b |
| 8 | a × b | a ∈ 11..19, b ∈ 2..9 |
| 9 | a ÷ b exacta | b ∈ 2..9, cociente ∈ 2..12 (a = b × cociente) |
| 10 | a + b × c (precedencia) | a ∈ 1..20, b, c ∈ 2..9 |

Puntaje por acierto: `10 + nivel actual de la escalera`.

- [ ] **Step 1: Escribir las pruebas del motor que fallan.**

```ts
test.each(Array.from({ length: 10 }, (_, i) => i + 1))('level %d problems respect the table', (level) => {
  const r = createRng(level);
  for (let i = 0; i < 200; i++) {
    const p = makeProblem(level, r);
    expect(Number.isInteger(p.answer)).toBe(true); expect(p.answer).toBeGreaterThanOrEqual(0);
    // + aserciones de rango por nivel según la tabla (p. ej. nivel 9: p.op === '÷' && p.a % p.b === 0)
  }
});
test('formatProblem', () => {
  expect(formatProblem({ a: 3, b: 4, c: 5, op: '+×', answer: 23 })).toBe('3 + 4 × 5');
  expect(formatProblem({ a: 12, b: 4, op: '-', answer: 8 })).toBe('12 − 4');
});
test('input rules', () => {
  let s = createQuickMathGame(1, createRng(1));
  s = typeDigit(typeDigit(s, 0), 5); expect(s.input).toBe('5');             // sin ceros a la izquierda
  s = typeDigit(typeDigit(typeDigit(typeDigit(s, 1), 2), 3), 4); expect(s.input).toBe('5123'); // máximo 4 dígitos
  s = deleteDigit(deleteDigit(deleteDigit(deleteDigit(deleteDigit(s))))); expect(s.input).toBe('');
  expect(submitAnswer(s, createRng(1)).correct).toBeNull();                  // enviar vacío no cuenta
});
test('answer 0 is valid', () => {
  /* problema forzado { a: 5, b: 5, op: '-', answer: 0 } → typeDigit(0) → input '0' → submit correcto */
});
test('scoring and skip', () => {
  /* correcto en nivel 1 → +11, correct 1, total 1, input ''; incorrecto → total+1; skip → total+1, problema nuevo */
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/games/quick-math` — Expected: FAIL.

- [ ] **Step 3: Implementar el motor.**

- [ ] **Step 4: Escribir las pruebas del componente que fallan.**
  - El teclado en pantalla tiene los botones 0–9, `games.quick-math.delete`, `games.quick-math.ok` y `games.quick-math.skip`.
  - El teclado físico también funciona: dígitos, `Backspace` y `Enter`.
  - A los 60 000 ms se llama a `onFinish`.

- [ ] **Step 5: Implementar** `Keypad.tsx`, `Game.tsx` (el problema en grande, la respuesta escrita y `GameHud`) y `Example.tsx` ("7 + 5 = 12"). Textos ES/EN y registro.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat: add Quick Math game"`

---

### Task 13: Plan diario, racha y pantalla "Hoy"

**Files:**
- Create: `src/core/dailyPlan.ts`, `src/core/streak.ts`, `src/data/dailyPlans.ts`
- Modify: `src/screens/TodayScreen.tsx`, `src/play/recordGameResult.ts`, `src/screens/play/ResultView.tsx`, `src/screens/PlayScreen.tsx`, `src/i18n/*.json`
- Test: `src/core/dailyPlan.test.ts`, `streak.test.ts`, `src/data/dailyPlans.test.ts`, `src/screens/TodayScreen.test.tsx`, ampliar `src/play/recordGameResult.test.ts` y `src/screens/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `createRng`, `seedFromString`, `addDays`, `daysBetween`, `localDay`, `GAMES`, `listResults`, `db`, `DailyPlan`.
- Produces:

```ts
export const DAILY_GAME_COUNT = 3;
export function generateDailyPlan(input: { day: string; games: readonly { id: string; area: Area }[];
  recentPlays: readonly { gameId: string; day: string }[]; yesterdayPlan: readonly string[] | null }): string[];
export function computeStreak(completedDays: readonly string[], today: string): { current: number; best: number };
// data/dailyPlans.ts
export function getPlan(day: string): Promise<DailyPlan | undefined>;
export function getOrCreatePlan(day: string): Promise<DailyPlan>;   // recentPlays = listResults({ sinceDay: addDays(day, -6) }); yesterdayPlan = getPlan(addDays(day, -1))
export function markDailyGameDone(day: string, gameId: string): Promise<DailyPlan>; // idempotente; ignora juegos que no están en el plan
export function isPlanComplete(plan: DailyPlan): boolean;
export function completedDays(): Promise<string[]>;
```

Algoritmo de `generateDailyPlan` (determinista con `createRng(seedFromString(day))`):
1. Agrupar los juegos por área. Cada área se ordena de forma ascendente por la tupla `[todos sus juegos estuvieron en el plan de ayer ? 1 : 0, partidas de esa área en los últimos 7 días (día−6..día), desempate aleatorio]`.
2. Recorrer las áreas en ese orden y elegir un juego por área: se prefieren los que no estuvieron ayer; entre ellos, el menos jugado; si hay empate, al azar. Parar al llegar a `DAILY_GAME_COUNT`.
3. Con menos de 3 áreas o juegos, devolver los que haya.

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
const G = [{ id: 'm', area: 'memory' }, { id: 'a', area: 'attention' }, { id: 's', area: 'speed' },
           { id: 'f', area: 'flexibility' }, { id: 'q', area: 'math' }] as const;
test('deterministic, 3 distinct areas', () => {
  const input = { day: '2026-10-20', games: G, recentPlays: [], yesterdayPlan: null };
  const p = generateDailyPlan(input); expect(generateDailyPlan(input)).toEqual(p);
  expect(p).toHaveLength(3); expect(new Set(p.map((id) => G.find((g) => g.id === id)!.area)).size).toBe(3);
});
test('prefers least-played areas in last 7 days', () => {
  const recent = ['m', 'm', 'a', 'a', 's', 's'].map((gameId) => ({ gameId, day: '2026-10-19' }));
  expect(generateDailyPlan({ day: '2026-10-20', games: G, recentPlays: recent, yesterdayPlan: null }).slice(0, 2).sort()).toEqual(['f', 'q']);
});
test('plays older than 7 days do not count', () => { /* partidas el '2026-10-13' no afectan el orden del '2026-10-20' */ });
test('avoids yesterday when possible', () => {
  const p = generateDailyPlan({ day: '2026-10-20', games: G, recentPlays: [], yesterdayPlan: ['m', 'a', 's'] });
  expect(p).toEqual(expect.arrayContaining(['f', 'q']));
});
test('fewer games than 3', () => { expect(generateDailyPlan({ day: '2026-10-20', games: G.slice(0, 2), recentPlays: [], yesterdayPlan: null })).toHaveLength(2); });

test.each([
  [[], '2026-10-18', 0, 0],
  [['2026-10-16', '2026-10-17'], '2026-10-18', 2, 2],               // hoy pendiente no rompe
  [['2026-10-16', '2026-10-17', '2026-10-18'], '2026-10-18', 3, 3],
  [['2026-10-15', '2026-10-17', '2026-10-18'], '2026-10-18', 2, 2],
  [['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-17'], '2026-10-18', 1, 3],
  [['2026-09-30', '2026-10-01'], '2026-10-01', 2, 2],               // cambio de mes
  [['2026-12-31', '2027-01-01', '2027-01-01'], '2027-01-01', 2, 2],  // cambio de año y duplicados
  [['2026-10-15'], '2026-10-18', 0, 1],
])('computeStreak(%j, %s) = current %d, best %d', (days, today, current, best) => {
  expect(computeStreak(days, today)).toEqual({ current, best });
});
test('plan is stored once and marks are idempotent', async () => {
  const p1 = await getOrCreatePlan('2026-10-20');
  await addResult({ ...base, gameId: p1.gameIds[0] });            // cambiar el historial no cambia el plan guardado
  expect(await getOrCreatePlan('2026-10-20')).toEqual(p1);
  await markDailyGameDone('2026-10-20', p1.gameIds[0]); const p2 = await markDailyGameDone('2026-10-20', p1.gameIds[0]);
  expect(p2.completed).toEqual([p1.gameIds[0]]);
  expect((await markDailyGameDone('2026-10-20', 'not-in-plan')).completed).toEqual([p1.gameIds[0]]);
});
test('completedDays returns only complete plans', async () => { /* plan con 3/3 → incluido; 2/3 → no */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/core src/data` — Expected: FAIL.

- [ ] **Step 3: Implementar** `dailyPlan.ts`, `streak.ts` y `dailyPlans.ts`. `computeStreak` acepta entradas desordenadas o con duplicados; `best` es la serie consecutiva más larga.

- [ ] **Step 4: Escribir las pruebas de pantalla que fallan.**
  - **Pantalla Hoy** (fecha fija con `vi.useFakeTimers({ toFake: ['Date'] })` y `vi.setSystemTime(new Date(2026, 9, 20, 10))`; solo se falsea `Date` para que Dexie siga funcionando):
    - Muestra la racha (`today.streak`, "{{count}} días seguidos").
    - Muestra las 3 tarjetas en el orden del plan.
    - El enlace `common.start` apunta a `/play/<primero>?daily=2026-10-20`.
    - Con el primer juego hecho, el botón dice `common.continue` y apunta al segundo.
    - Con los 3 hechos, aparece el resumen `today.completed` con los puntajes diarios de hoy.
  - **`recordGameResult` con `daily: '2026-10-20'`:** guarda `isDaily: true` y marca el juego en el plan de ese día, aunque la fecha local ya sea otra. *(Review Focus #4)*
  - **Botones del resultado en modo diario:**
    - Si quedan juegos, `play.nextGame` lleva al siguiente sin hacer, con el mismo `daily`.
    - En el último, `play.seeSummary` lleva a `/`.

- [ ] **Step 5: Implementar** la pantalla Hoy, la lectura de `?daily=` en `PlayScreen` (se pasa a `recordGameResult`) y los botones diarios de `ResultView`. Textos ES/EN.

- [ ] **Step 6: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit.** `git commit -m "feat: add daily training plan, streak and Today screen"`

---

### Task 14: Catálogo de juegos y pantalla de progreso

**Files:**
- Create: `src/core/areaScore.ts`, `src/screens/progress/LineChart.tsx`
- Modify: `src/screens/GamesScreen.tsx`, `src/screens/ProgressScreen.tsx`, `src/i18n/*.json`
- Test: `src/core/areaScore.test.ts`, `src/screens/GamesScreen.test.tsx`, `src/screens/ProgressScreen.test.tsx`

**Interfaces:**
- Consumes: `GAMES`, `V1_AREAS`, `listResults`, `bestScore`, `completedDays`, `computeStreak`, `localDay`.
- Produces:

```ts
export function gameAreaScore(best: number, referenceScore: number): number;  // min(1000, round(1000 × best / ref))
export function areaScores(results: readonly { gameId: string; score: number; playedAt: string }[],
  games: readonly { id: string; area: Area; referenceScore: number }[], now: Date): Partial<Record<Area, number>>;
export function LineChart(props: { values: readonly number[]; label: string }): JSX.Element;
```

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
test('gameAreaScore', () => { expect(gameAreaScore(300, 600)).toBe(500); expect(gameAreaScore(1200, 600)).toBe(1000); });
test('areaScores uses best of last 30 days and averages per area', () => {
  const now = new Date('2026-10-20T12:00:00');
  const games = [{ id: 'x', area: 'memory', referenceScore: 100 }, { id: 'y', area: 'memory', referenceScore: 100 },
                 { id: 'z', area: 'math', referenceScore: 100 }] as const;
  const results = [
    { gameId: 'x', score: 40, playedAt: '2026-10-19T10:00:00.000Z' }, { gameId: 'x', score: 90, playedAt: '2026-09-01T10:00:00.000Z' }, // la de 90 queda fuera (>30 días)
    { gameId: 'y', score: 60, playedAt: '2026-10-18T10:00:00.000Z' },
  ];
  expect(areaScores(results, games, now)).toEqual({ memory: 500 });   // (400 + 600) / 2; math sin datos → ausente
});
```

  - **Pantalla Juegos:**
    - Un encabezado por área de la v1, en el orden de `V1_AREAS`.
    - Cada tarjeta tiene título, descripción, mejor marca ("—" si no hay) y enlace a `/play/<id>`.
  - **Pantalla Progreso:**
    - Sin datos: muestra `progress.empty`.
    - Con datos: un `<meter min=0 max=1000>` por área con datos y "—" en las áreas sin datos.
    - Muestra la racha actual y la mejor, y el total de días con alguna partida.
    - Por juego: su mejor marca y un `LineChart` con sus últimos 30 puntajes. El `aria-label` del gráfico resume el mínimo, el máximo y el último puntaje.

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/core/areaScore.test.ts src/screens` — Expected: FAIL.

- [ ] **Step 3: Implementar.** `LineChart` es un SVG con `polyline`, `role="img"` y `aria-label={label}`. Con menos de 2 valores muestra solo el texto `progress.notEnoughData`. Las pantallas usan `useLiveQuery`. Textos ES/EN.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add games catalog and progress screen with area scores"`

---

### Task 15: Ajustes

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`, `src/app/App.tsx`, `src/main.tsx`, `src/i18n/*.json`
- Create: `src/app/SettingsEffects.tsx`
- Test: `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `useSettings`, `updateSettings`, `clearAllData`, `applyTheme`, `detectLanguage`, `i18n.changeLanguage`.
- Produces:
  - `SettingsEffects(): null`, montado dentro de `AppRoutes` (así `renderApp` también lo incluye). Cuando cambian los ajustes, aplica `i18n.changeLanguage(detectLanguage(settings.language, navigator.languages))`, actualiza `document.documentElement.lang` y llama a `applyTheme(settings.theme)`.
  - `main.tsx` lee `getSettings()` antes de `initI18n`.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - Elegir "English" en el selector de idioma → aparece la etiqueta "Today" en la navegación y se guarda `settings.language === 'en'`.
  - Tema "Oscuro" → `document.documentElement.dataset.theme === 'dark'`; "Automático" quita el atributo.
  - Al desactivar el sonido se guarda `sound: false`.
  - La nota de privacidad es visible. ES: "Tu progreso se guarda solo en este dispositivo. Light no usa publicidad ni analítica." EN: "Your progress is stored only on this device. Light uses no ads or analytics."
  - "Borrar mis datos" pide una confirmación con un segundo botón, "Sí, borrar". Al confirmar, `db.results.count() === 0` y los ajustes vuelven a `DEFAULT_SETTINGS`. Si se cancela, no se borra nada.

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/screens/SettingsScreen.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implementar.** Los controles llevan etiquetas visibles; el idioma es un `<select>` con "Español" y "English"; el tema es un grupo de radios; el sonido es un checkbox con aspecto de interruptor. Textos ES/EN.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: add settings screen (language, theme, sound, privacy, delete data)"`

---

### Task 16: PWA y pruebas de punta a punta

**Files:**
- Modify: `vite.config.ts`, `src/app/App.tsx`, `src/vite-env.d.ts`, `.github/workflows/ci.yml`, `package.json` (script `icons`)
- Create: `public/icon.svg`, `scripts/make-icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `src/app/UpdatePrompt.tsx`, `playwright.config.ts`, `e2e/helpers.ts`, `e2e/daily.spec.ts`, `e2e/offline.spec.ts`, `e2e/i18n.spec.ts`
- Test: `src/app/UpdatePrompt.test.tsx`

**Interfaces:**
- Produces:
  - Manifest: `name` y `short_name` "Light"; `description` "Ilumina tu cerebro · Light up your brain"; `theme_color` y `background_color` `#0E0F1A`; `display: standalone`; `start_url` y `scope` `/Light/`; iconos 192, 512 y maskable 512.
  - `VitePWA({ registerType: 'prompt', ... })` con `workbox.globPatterns: ['**/*.{js,css,html,svg,png}']`.
  - `UpdatePrompt()` usa `useRegisterSW` de `virtual:pwa-register/react`. Si `needRefresh` es verdadero, muestra `update.available` y el botón `update.reload`, que llama a `updateServiceWorker(true)`.
  - `e2e/helpers.ts`: `finishCurrentGame(page: Page): Promise<void>`.

- [ ] **Step 1: Ícono.** `public/icon.svg`: un círculo `#FFC233` con rayos cortos alrededor sobre fondo `#0E0F1A` ("la luz"). La versión *maskable* deja un margen del 10 %. `scripts/make-icons.mjs` abre el SVG con Playwright (`executablePath: process.env.PW_CHROMIUM_PATH`), toma capturas a 192 y 512 px y genera los PNG. Run: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run icons` — Expected: se crean los 3 PNG.

- [ ] **Step 2: Escribir la prueba que falla de `UpdatePrompt`** (`vi.mock('virtual:pwa-register/react')` con `needRefresh` en verdadero): aparece "Nueva versión disponible" y el clic en "Recargar" llama a `updateServiceWorker(true)`.

- [ ] **Step 3: Verificar que falla e implementar** `UpdatePrompt` (montado en `Layout`) y la configuración de PWA. Agregar `/// <reference types="vite-plugin-pwa/react" />` a `vite-env.d.ts`. En `src/setupTests.ts`, simular globalmente `virtual:pwa-register/react` con `needRefresh: [false, () => {}]` para que las demás pruebas no registren un service worker; la prueba de `UpdatePrompt` sobrescribe esa simulación. Run: `npm test && npm run build` — Expected: PASS; `dist/sw.js` y `dist/manifest.webmanifest` existen.

- [ ] **Step 4: Configurar Playwright.**
  - `testDir: 'e2e'` y `use.baseURL: 'http://localhost:4173/Light/'`.
  - `use.launchOptions.executablePath: process.env.PW_CHROMIUM_PATH || undefined`.
  - `webServer`: comando `npm run build && npm run preview -- --port 4173 --strictPort`, URL `http://localhost:4173/Light/` y `reuseExistingServer: !process.env.CI`.

- [ ] **Step 5: Escribir las pruebas E2E.**
  - **`finishCurrentGame`:**
    1. Si aparece "Comenzar", hace clic.
    2. Lee `data-game` del contenedor del juego.
    3. Si es `sequence-lights`, repite hasta 16 veces: `page.clock.runFor(15_000)` y luego un clic en "Casilla 1", hasta que aparezca el resultado. Cada ronda termina en a lo sumo 2 clics, porque la secuencia nunca repite la misma casilla seguida.
    4. En cualquier otro juego: `page.clock.runFor(61_000)`.
  - **`daily.spec.ts`:**
    1. Fijar la fecha con `await page.clock.install({ time: new Date('2026-10-20T10:00:00') })` y abrir la app.
    2. Comprobar que hay 3 tarjetas del plan.
    3. Hacer clic en "Comenzar".
    4. Tres veces: `finishCurrentGame` y luego "Siguiente juego" o "Ver resumen".
    5. Esperar el resumen y "1 día seguido".
  - **`offline.spec.ts`:**
    1. Abrir la app y esperar a que el service worker controle la página (`await page.evaluate(() => navigator.serviceWorker.ready)` seguido de una recarga).
    2. Desconectar con `context.setOffline(true)` y recargar.
    3. Comprobar que se ven "Light" y la navegación, y que "Juegos" muestra las 5 tarjetas.
  - **`i18n.spec.ts`:** con `locale: 'en-US'` la navegación dice "Today"; con `locale: 'es-CO'`, "Hoy".

- [ ] **Step 6: Verificar.** Run: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` — Expected: 4 pruebas PASS.

- [ ] **Step 7: CI.** Agregar en `ci.yml` un job `e2e` (Node 24) con `npm ci`, `npx playwright install --with-deps chromium` y `npm run e2e`; si falla, sube `playwright-report` como artefacto.

- [ ] **Step 8: Commit.** `git commit -m "feat: make the app an installable offline PWA and add end-to-end tests"`

---

### Task 17: Publicación en GitHub Pages y README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: `deploy.yml`.**
  - Se dispara con `push` a `main` y con `workflow_dispatch`.
  - `permissions`: `contents: read`, `pages: write` e `id-token: write`; `concurrency: pages`.
  - Job `build`: checkout, Node 24, `npm ci`, `npm run build` y `actions/upload-pages-artifact` con `path: dist`.
  - Job `deploy`: `actions/deploy-pages`, con `environment: github-pages`.
  - Usar la última versión mayor de cada acción.

- [ ] **Step 2: `README.md`** (en español), con estas secciones:
  - Qué es Light y su lema.
  - Requisitos: Node 22.13 o superior.
  - Comandos: `npm run dev`, `test`, `e2e` (con la nota sobre `PW_CHROMIUM_PATH`), `build` e `icons`.
  - Cómo activar Pages: *Settings → Pages → Source: GitHub Actions*.
  - Cómo agregar un juego: carpeta en `src/games/<id>/`, una línea en `registry.ts` y claves `games.<id>.*` en ES y EN. La fila en la tabla `games` de Supabase llega con el Plan 2.
  - Estructura de carpetas.

- [ ] **Step 3: Verificación final.** Run: `npm run lint && npm run typecheck && npm test && npm run build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` — Expected: todo PASS. `dist/index.html` referencia sus recursos bajo `/Light/`.

- [ ] **Step 4: Commit.** `git commit -m "ci: deploy to GitHub Pages and add README"`

---

## Después de este plan

- El dueño del repo activa GitHub Pages (*Settings → Pages → Source: GitHub Actions*). La publicación ocurre cuando los cambios llegan a `main`.
- Plan 2 (Supabase para invitados) y Plan 3 (cuentas) se escriben al terminar este plan, partiendo del código real.
