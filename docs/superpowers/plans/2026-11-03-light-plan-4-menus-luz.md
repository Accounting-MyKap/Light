# Plan 4: menús con Luz de día y de noche — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer las visuales de Hoy, Juegos, Progreso, Ajustes y la barra inferior con el estilo Luz en modo claro y oscuro, con un catálogo por categorías como Lumosity, sin cambiar la lógica de datos.

**Architecture:** Los tokens de `src/app/theme.css` pasan a las paletas «Luz de día» y «Luz de noche». Cada juego aporta una miniatura SVG (`Thumb`) y un texto de habilidad. Las cuatro pantallas y `Layout` se rehacen sobre piezas compartidas pequeñas (`Switch`, `SegmentedControl`, `WeekStrip`, íconos de la barra). Los datos (plan diario, racha, `areaScores`, ajustes, borrado, sincronización) siguen igual.

**Tech Stack:** React 19, TypeScript, CSS Modules, react-router-dom (HashRouter), i18next, Dexie + dexie-react-hooks, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-light-menus-luz-design.md`

**Maqueta visual (referencia de formas y proporciones, no de código):** `/tmp/claude-0/-home-user-Light/ae7f1af7-7d9e-5ccc-a0af-2f96f2ceacbb/scratchpad/menus-luz.html`. Las líneas 115–134 tienen los valores de cada modo (`.night`, `.day`). Las líneas 138–147 tienen los SVG de las miniaturas (`t-mem`, `t-att`, `t-spd`, `t-flx`, `t-mth`) y de la barra (`n-today`, `n-games`, `n-prog`, `n-set`, `i-sun`). Las medidas en `cqw` de la maqueta son relativas a un teléfono de 250 px: 1 cqw ≈ 3,9 px en un teléfono real de 390 px.

## Global Constraints

- Textos en español e inglés con las mismas claves (`src/i18n/i18n.test.ts` lo comprueba). Sin afirmaciones médicas.
- No cambia la lógica de datos: `getOrCreatePlan`/`getPlan`, `completedDays`, `computeStreak`, `areaScores`, `useSettings`/`updateSettings`, `deleteEverything`, sincronización.
- Los juegos (todo lo que está dentro de `[data-luz]`) no cambian y siguen siempre oscuros.
- Objetivos táctiles ≥ 44 px. Sin desplazamiento horizontal a 320 px de ancho.
- Con «reducir movimiento», nada se mueve. Los menús solo usan transiciones de color, que `global.css` ya acorta.
- Sin dependencias nuevas.
- Miniaturas e íconos decorativos con `aria-hidden="true"`. Los controles siguen siendo nativos: enlaces, botones, casillas, radios y `select`.
- Contraste ≥ 4,5:1 para todo texto: `--text`, `--text-muted`, `--accent-strong`, `--success-strong`, `--danger` y cada `--area-*` sobre `--bg` y `--surface`; `--accent-text` sobre `--accent`.
- Antes de cada commit: `npm run lint`, `npm run typecheck` y `npm test`, todos en verde.
- Toda tarea con cambios visibles termina con capturas propias a 390×844, en modo claro y oscuro, de las pantallas que tocó. Se guardan en `test-results/menus-dev/` (ignorado por git). El implementador las mira y las nombra en su reporte.
  - Servidor: `npm run build && (setsid npm run preview -- --port 4173 --strictPort > /dev/null 2>&1 &)`.
  - Para detenerlo: `fuser -k 4173/tcp`. **Nunca** `pkill -f "vite preview"`, que mata la propia terminal.
  - Chromium está en `/opt/pw-browsers/chromium`. Los scripts importan `/home/user/Light/node_modules/playwright/index.mjs` y lanzan con `executablePath: '/opt/pw-browsers/chromium'`.
  - El modo oscuro se pide con `colorScheme: 'dark'` en el contexto.

## Rulings sobre el spec

- **`--success-strong` de día = `#0f7a49`**, no `#12a160`. El spec da `#12a160` para ambos tokens, pero ese verde mide 3,1:1 sobre `--bg` y la prueba de contraste ya exige 4,5:1 para `--success-strong` (texto). `--success` sigue en `#12a160` para rellenos y bordes.
- **El color de cada miniatura se elige por área** (`GameThumb area=…`), con los mismos colores nocturnos que `luz.css`. Hoy cada área tiene un solo juego.
- **El filtro `?area=` solo acepta áreas con juegos.** `?area=logic` (área válida sin juegos) equivale a «Todo», igual que un valor desconocido.
- **«Tus datos» se queda** como etiqueta pequeña encima del botón rojo, con el mismo estilo que las demás etiquetas de grupo. Así la sección conserva su encabezado.

## Review Focus

1. **Letras grandes y palabras largas.** «procesamiento» en una tarjeta de un tercio a 320 px, o la píldora «Flexibilidad mental» con la letra raíz a 24 px. Se espera que el texto se parta sin empujar la página de lado. Prueba: E2E de la Tarea 8 (320 px en ES/EN y 390 px con letra de 24 px).
2. **Un plan guardado con un id de juego que ya no existe** (de una versión vieja). Hoy y el catálogo deben mostrarse sin romperse, con la fila sin miniatura. Pruebas: Tareas 4 y 5.
3. **La semana alrededor de fin de mes, de año y de cambio de horario.** Domingo 2026-11-01: la semana empieza el lunes 2026-10-26. Viernes 2027-01-01: empieza el lunes 2026-12-28. Prueba: `weekOf` en la Tarea 5.
4. **`/games?area=logic`, `?area=` vacío o `?area=MEMORY`** muestran todo con «Todo» elegido. Prueba: Tarea 4.
5. **Volver de un juego con un filtro puesto** (✕ en la presentación): se vuelve a `/games?area=memory` con «Memoria» elegido. Prueba: E2E de la Tarea 8.

---

### Task 1: Tokens de día y de noche, letra Sora y prueba de contraste

**Files:**
- Modify: `src/app/theme.css` (los cuatro bloques)
- Modify: `src/app/global.css` (letra, fondo con resplandor)
- Modify: `src/games/shared/luz/luz.css:1` (quitar el `@import`)
- Modify: `index.html:6`, `vite.config.ts:17-18` (color del tema)
- Test: `src/app/contrast.test.ts`

**Interfaces:**
- Produces, en los cuatro bloques de `theme.css` y con valores por modo:
  - Los tokens de color: `--bg --surface --text --text-muted --accent --accent-text --accent-strong --success --success-strong --danger --border --glow --radius --area-memory --area-attention --area-speed --area-flexibility --area-math`.
  - Los tokens de superficie: `--card-bg --card-shadow --nav-bg --nav-edge --nav-active-glow --bg-glow`.
  - Todas las tareas siguientes usan solo estos nombres.

- [ ] **Step 1: Write the failing tests** in `src/app/contrast.test.ts`.
  - Amplía `TEXT_PAIRS` con `['danger','bg'] ['danger','surface']` y, para cada `a` de `memory attention speed flexibility math`, `['area-a','bg'] ['area-a','surface']`.
  - Añade dos pruebas de sincronía entre bloques:
    - `test('the default block is the light palette', () => expect(tokens(':root')).toEqual(tokens(":root[data-theme='light']")))`.
    - `test('the system-dark block is the dark palette', () => expect(tokens(':root:not([data-theme])')).toEqual(tokens(":root[data-theme='dark']")))`.

- [ ] **Step 2: Run** `npx vitest run src/app/contrast.test.ts`. Expected: FAIL (`--danger`/`--area-*` undefined, or below 4.5).

- [ ] **Step 3: Rewrite `src/app/theme.css`** with the spec §3.1 values. Light goes in `:root` and `:root[data-theme='light']`; dark goes in `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` and `:root[data-theme='dark']`. Keep `color-scheme` and `--radius: 16px`.

  | Token | Light | Dark |
  |---|---|---|
  | `--bg` | `#f6f7fc` | `#090b19` |
  | `--surface` | `#ffffff` | `#141729` |
  | `--text` | `#171a2e` | `#eef1ff` |
  | `--text-muted` | `#5c6079` | `#b4b9d8` |
  | `--accent` | `#f5a000` | `#ffb52e` |
  | `--accent-text` | `#0b0d1a` | `#0b0d1a` |
  | `--accent-strong` | `#8f5400` | `#ffb52e` |
  | `--success` | `#12a160` | `#4dffa6` |
  | `--success-strong` | `#0f7a49` | `#4dffa6` |
  | `--danger` | `#c62f4e` | `#ff5d7a` |
  | `--border` | `rgba(23, 26, 46, 0.09)` | `rgba(255, 255, 255, 0.1)` |
  | `--glow` | `rgba(245, 160, 0, 0.4)` | `rgba(255, 181, 46, 0.6)` |
  | `--area-memory` | `#a35f00` | `#ffb52e` |
  | `--area-attention` | `#00789f` | `#3fd4ff` |
  | `--area-speed` | `#b0287f` | `#ff5fd2` |
  | `--area-flexibility` | `#6247d1` | `#a98bff` |
  | `--area-math` | `#2a7f1a` | `#8dff6a` |
  | `--card-bg` | `#ffffff` | `rgba(255, 255, 255, 0.045)` |
  | `--card-shadow` | `0 4px 16px rgba(23, 26, 46, 0.07), inset 0 0 0 1px rgba(23, 26, 46, 0.05)` | `inset 0 0 0 1px rgba(255, 255, 255, 0.09)` |
  | `--nav-bg` | `#ffffff` | `rgba(16, 19, 40, 0.94)` |
  | `--nav-edge` | `0 -1px 0 rgba(23, 26, 46, 0.06)` | `inset 0 1px 0 rgba(255, 255, 255, 0.08)` |
  | `--nav-active-glow` | `none` | `drop-shadow(0 0 6px rgba(255, 181, 46, 0.7))` |
  | `--bg-glow` | `radial-gradient(90% 40% at 15% 0%, rgba(255, 181, 46, 0.14), transparent 70%), radial-gradient(80% 35% at 100% 10%, rgba(63, 212, 255, 0.1), transparent 70%)` | same with opacities `0.16` and `0.12` |

- [ ] **Step 4: `global.css`.**
  - Add `@import '@fontsource-variable/sora';` at the top and remove it from `luz.css` (its `font-family` line stays).
  - `body`:
    - `font-family: 'Sora Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;`
    - `background-color: var(--bg); background-image: var(--bg-glow); background-repeat: no-repeat; background-size: 100% 100vh;`
  - `html { background: var(--bg); }`, so overscroll matches the page.
  - The rule `html[data-luz-active] body { background: #090b19 }` in `luz.css` is more specific and keeps game screens flat dark. Leave it as is.

- [ ] **Step 5: Theme color.** Set `#090b19` in `index.html` `theme-color` and in `vite.config.ts` `theme_color`/`background_color`. Then `grep -rn "0E0F1A\|0e0f1a" src e2e`: any test that hard-codes the old color takes the new one.

- [ ] **Step 6: Run** `npm test` (all), `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 7: Screenshots.** Take `/`, `/games`, `/progress` and `/settings` in light and dark. Only the colors change at this point. Check that the game screens still look the same (`/play/arrows`).

- [ ] **Step 8: Commit**: `git commit -m "feat(menus): Luz day and night tokens, Sora app-wide"`.

### Task 2: Barra inferior con íconos y sin encabezado

**Files:**
- Create: `src/app/NavIcons.tsx`
- Create: `src/app/PendingSyncBadge.module.css`
- Modify: `src/app/Layout.tsx`, `src/app/Layout.module.css`, `src/app/PendingSyncBadge.tsx`, `src/screens/TodayScreen.tsx` (only to mount the badge)
- Modify: `e2e/offline.spec.ts:13`, `e2e/i18n.spec.ts`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: the Task 1 tokens `--nav-bg --nav-edge --nav-active-glow --accent-strong --text-muted`.
- Produces:
  - `NavIcons.tsx` exports `TodayIcon`, `GamesIcon`, `ProgressIcon`, `SettingsIcon`, `SunIcon`. Each is `() => JSX.Element`: an `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` with the paths of the mockup's `n-today`, `n-games`, `n-prog`, `n-set` and `i-sun` symbols, drawn in `currentColor`.
  - `PendingSyncBadge` keeps its API and is now rendered by `TodayScreen`, not `Layout`.

- [ ] **Step 1: Write the failing tests** in `src/app/App.test.tsx`:
  - `test('no app header: the brand banner is gone')`: `renderApp('/games')`, then `expect(screen.queryByRole('banner')).toBeNull()` and `expect(screen.queryByText('Ilumina tu cerebro')).toBeNull()`.
  - `test('each tab has a hidden icon and the current one is marked')`: `renderApp('/progress')`. In `nav`, each of the four links has exactly one `svg[aria-hidden="true"]`. Its accessible name is just the label (`getByRole('link', { name: 'Progreso' })`). It has `aria-current="page"`, and `Hoy` does not.

- [ ] **Step 2: Run** `npx vitest run src/app/App.test.tsx`. Expected: FAIL (header still there).

- [ ] **Step 3: Implement.**
  - **Layout**
    - Delete the `<header>`. `NAV_ITEMS` gains `Icon`, and each `NavLink` renders `<Icon /><span>{t(item.key)}</span>`.
    - `.main` padding: `max(1.25rem, env(safe-area-inset-top)) 1.25rem calc(5.5rem + env(safe-area-inset-bottom))`.
    - Delete `.header`, `.brand`, `.tagline` and `.pending`.
  - **Nav**
    - `.nav`: `background: var(--nav-bg); box-shadow: var(--nav-edge); backdrop-filter: blur(12px)`. Keep the fixed position and the four columns.
    - `.navLink`: column grid with `gap: 2px`, `min-height: 60px`, `font-size: 0.75rem`, weight 600, `color: var(--text-muted)`, `transition: color .2s`. Its `svg` is 24 px.
    - `[aria-current='page']`: `color: var(--accent-strong)`, and its `svg` gets `filter: var(--nav-active-glow)`. No inset bar.
  - **Pending-sync badge**
    - Its `.pending` style moves to `PendingSyncBadge.module.css`: a pill with `border: 1px solid var(--border)`, `color: var(--text-muted)`, 0.8rem, and `align-self: flex-start`.
    - `TodayScreen` renders `<PendingSyncBadge />` right after its `<h1>`. Task 5 places it in its final spot.
  - **E2E**
    - `e2e/offline.spec.ts:13`: wait for `page.getByRole('navigation').getByRole('link', { name: 'Hoy' })`.
    - `e2e/i18n.spec.ts`: replace the tagline checks with the h1 (`Today’s training` / `Entrenamiento de hoy`).

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS. `PendingSyncBadge.test.tsx` must still pass. If it looked for the badge inside the header, point it at the Today screen instead.

- [ ] **Step 5: Screenshots.** Take `/` and `/games` in light and dark at 390×844. Also check `/` at 320×640: the bar must not overflow (four labels fit).

- [ ] **Step 6: Commit**: `git commit -m "feat(menus): icon tab bar, no app header"`.

### Task 3: Miniaturas y habilidad de cada juego

**Files:**
- Create: `src/games/shared/GameThumb.tsx`, `src/games/shared/GameThumb.module.css`, `src/games/shared/GameThumb.test.tsx`
- Create: `src/games/{sequence-lights,arrows,same-different,rule-switch,quick-math}/Thumb.tsx`
- Modify: `src/games/types.ts` (`GameDefinition.Thumb`), the five `src/games/<id>/index.ts`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (`games.<id>.skill`)
- Test: `src/games/registry.test.ts`

**Interfaces:**
- Produces:
  - `GameThumb({ area, children }: { area: Area; children: ReactNode })`. It renders `<span className={styles.thumb} data-area={area} aria-hidden="true">{children}</span>`.
  - `GameDefinition.Thumb: ComponentType`. It takes no props, is square, and fills the width of its container. Callers size it with a wrapper or a class on the container.
  - `t('games.<id>.skill')` for each game.

- [ ] **Step 1: Write the failing tests.**
  - `registry.test.ts`:
    - For every game in `GAMES`: `expect(g.Thumb).toBeTypeOf('function')`.
    - In each dict, `games[id].skill` is a non-empty string.
    - Exact values: `es.games['same-different'].skill === 'Velocidad de procesamiento'` and `en.games['rule-switch'].skill === 'Task switching'`.
  - `GameThumb.test.tsx`:
    - `test.each(GAMES)('%s thumbnail is decorative')`: `render(<g.Thumb />)`. The root `container.firstElementChild` has `aria-hidden="true"`, `data-area={g.area}`, and contains an `svg`.

- [ ] **Step 2: Run** `npx vitest run src/games`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`GameThumb.module.css`**
    - `.thumb`:
      - `--g: #ffb52e;`
      - `display: grid; place-items: center; width: 100%; aspect-ratio: 1; border-radius: 22%; overflow: hidden;`
      - `background: radial-gradient(85% 70% at 50% 15%, color-mix(in srgb, var(--g) 45%, transparent), transparent 75%), #0d1024;`
      - `box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--g) 35%, transparent); color: var(--g);`
    - `.thumb svg { width: 64%; height: 64%; filter: drop-shadow(0 0 6px var(--g)); }`
    - Per area, `[data-area='…'] { --g }`: memory `#ffb52e`, attention `#3fd4ff`, speed `#ff5fd2`, flexibility `#a98bff`, math `#8dff6a`.
  - **Each `Thumb.tsx`**
    - Wraps `<GameThumb area="…">` around an `<svg viewBox="0 0 24 24" focusable="false">`.
    - The contents are copied from the mockup symbol, written as JSX attributes (`stroke-width` → `strokeWidth`, and so on):

      | Game | Mockup symbol |
      |---|---|
      | sequence-lights | `t-mem` |
      | arrows | `t-att` |
      | same-different | `t-spd` |
      | rule-switch | `t-flx` |
      | quick-math | `t-mth` |

    - In quick-math, `font-family` becomes `'Sora Variable', system-ui, sans-serif`.
  - **The rest**
    - Add `Thumb` to the five `index.ts` and to `GameDefinition`, with a doc comment.
    - Skill texts:

      | id | es | en |
      |---|---|---|
      | `sequence-lights` | Memoria espacial | Spatial memory |
      | `arrows` | Atención selectiva | Selective attention |
      | `same-different` | Velocidad de procesamiento | Processing speed |
      | `rule-switch` | Cambio de tareas | Task switching |
      | `quick-math` | Aritmética mental | Mental arithmetic |

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshot.** Render the five thumbnails side by side at 96 px and 48 px on a scratch page (a test-only HTML page or a Playwright `page.setContent` with the built CSS is fine). Compare them against the mockup.

- [ ] **Step 6: Commit**: `git commit -m "feat(menus): a thumbnail and a skill line for each game"`.

### Task 4: Catálogo de Juegos

**Files:**
- Create: `src/games/catalog.ts`, `src/games/catalog.test.ts`
- Create: `src/screens/Games.module.css`
- Modify: `src/screens/GamesScreen.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/GamesScreen.test.tsx` (rewrite)

**Interfaces:**
- Consumes:
  - `GameDefinition.Thumb` and `games.<id>.skill` (Task 3).
  - `getPlan(day)`, `useLocalDay()`.
- Produces:
  - `CATALOG_AREAS: readonly Area[] = ['speed', 'memory', 'attention', 'flexibility', 'logic', 'math', 'language']`.
  - `catalogAreas(games: readonly GameDefinition[]): Area[]`: the areas of `CATALOG_AREAS` that have at least one game, in that order.
  - Progress (Task 6) reuses both.
- New i18n keys:

  | Key | es | en |
  |---|---|---|
  | `gamesScreen.all` | Todo | All |
  | `gamesScreen.filters` | Categorías | Categories |
  | `gamesScreen.today` | Tus juegos de hoy | Your games today |
  | `gamesScreen.played` | Jugado | Played |

  - `gamesScreen.best` stays until Task 6.

- [ ] **Step 1: Write the failing tests.**
  - `catalog.test.ts`:
    - `catalogAreas(GAMES)` equals `['speed', 'memory', 'attention', 'flexibility', 'math']`.
    - `catalogAreas([])` equals `[]`.
  - `GamesScreen.test.tsx`, with fake `Date` at 2026-10-20 10:00 as in `TodayScreen.test.tsx` and `clearAllData` before each test:
    - `test('sections follow the catalog order, cards show name and skill, no best mark')`: `renderApp('/games')`.
      - Level-2 headings equal `['Velocidad', 'Memoria', 'Atención', 'Flexibilidad mental', 'Matemáticas']`.
      - The link named `/Flechas/` has `href` `/play/arrows` and contains `Atención selectiva`.
      - `queryByText(/Mejor/)` is null.
      - Five level-3 headings.
    - `test('a filter shows one category and is announced as pressed')`:
      - Click button `Memoria`: it gets `aria-pressed="true"`, `Todo` gets `aria-pressed="false"`, the only level-2 heading is `Memoria`, and there is one game link (`Secuencia de luces`).
      - Click `Todo`: five sections again.
    - `test('the filter comes from the address')`: `renderApp('/games?area=memory')` gives one section, and `Memoria` is pressed.
    - `test.each(['/games?area=logic', '/games?area=', '/games?area=MEMORY', '/games?area=bogus'])('%s shows everything')`: five sections, `Todo` pressed.
    - `test('today’s games: daily links and a played mark')`:
      - Setup: `db.dailyPlans.put({ day: '2026-10-20', gameIds: ['arrows', 'quick-math', 'rule-switch'], completed: ['arrows'] })`, then `renderApp('/games')`.
      - The section headed `Tus juegos de hoy` holds three links, with hrefs `/play/arrows?daily=2026-10-20`, and so on.
      - The first contains `Jugado`; the other two do not.
      - With `/games?area=memory` there is no `Tus juegos de hoy`.
    - `test('no plan: no today row and the catalog does not create one')`: after render, `db.dailyPlans.count()` is 0 and `Tus juegos de hoy` is absent.
    - `test('a stale plan id is skipped')` (Review Focus 2): plan `gameIds: ['old-game', 'arrows', 'quick-math']`. It renders without error and the today row has two links.

- [ ] **Step 2: Run** `npx vitest run src/games/catalog.test.ts src/screens/GamesScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `catalog.ts`.**

- [ ] **Step 4: Implement `GamesScreen` and `Games.module.css`.**
  - **Filter state**
    - `const [params, setParams] = useSearchParams()`.
    - `selected = areas.includes(params.get('area') as Area) ? that : null`, where `areas = catalogAreas(GAMES)`.
    - Clicking a filter calls `setParams(area ? { area } : {}, { replace: true })`.
  - **Filters**
    - `<div role="group" aria-label={t('gamesScreen.filters')} className={styles.filters}>`, holding buttons with `aria-pressed`.
    - The row scrolls sideways inside itself: `display: flex; gap: .5rem; overflow-x: auto; scrollbar-width: none; margin-inline: -1.25rem; padding-inline: 1.25rem`. The page never scrolls sideways.
    - Pills: `min-height: 44px; padding: 0 1rem; border-radius: 999px; border: none; white-space: nowrap; font-weight: 700`.
      - Off: `box-shadow: inset 0 0 0 1.5px var(--border); background: transparent; color: var(--text-muted)`.
      - Pressed: `background: var(--text); color: var(--bg)`.
  - **Today row**
    - Shown only when `selected === null` and `getPlan(today)` resolved to a plan. Read it with `useLiveQuery(() => getPlan(today), [today])`; never create a plan.
    - `<section aria-labelledby>` with h2 `gamesScreen.today` and a three-column `<ul>`.
    - Each `<li>` holds a `<Link to={`/play/${id}?daily=${today}`}>` with the thumbnail and the name in a `<span>`, not h3.
    - Played games show a ✓ badge over the thumbnail: `aria-hidden`, positioned top-right, background `var(--success)`, text `#0b0d1a`. Add `<span className="visually-hidden">{t('gamesScreen.played')}</span>`.
    - Ids that `getGame` does not know are skipped.
  - **Sections**
    - One per area of `selected ? [selected] : areas`.
    - h2 with a dot: `<span className={styles.dot} data-area={area} aria-hidden="true" />`. The dot is 10 px, `background: var(--area-<area>)`, through `[data-area=…]` rules.
    - `<ul className={styles.grid}>` with `grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem`.
    - Card: `<Link className={styles.card} to={`/play/${id}`}>`:
      - `<g.Thumb />`
      - `<h3 className={styles.name}>{title}</h3>`, weight 700, 0.85rem, line-height 1.2.
      - `<span className={styles.skill}>{skill}</span>`, 0.72rem, `--text-muted`.
      - Both texts use `overflow-wrap: anywhere; hyphens: auto`.
  - **Cards**
    - `background: var(--card-bg); box-shadow: var(--card-shadow); border-radius: var(--radius); padding: .5rem .5rem .75rem; text-decoration: none; color: var(--text)`.
    - Hover / `:focus-visible`: `box-shadow: var(--card-shadow), 0 0 0 2px var(--accent)`.
  - **Page**
    - Remove the `best` query and its import.
    - h1 `nav.games`, 1.9rem, weight 800.

- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS. `e2e/offline.spec.ts` counts five level-3 headings in Juegos, which still holds.

- [ ] **Step 6: Screenshots.** Take `/games` in light and dark at 390×844 with a plan for today, and `/games` at 320×640 in English. Check that the texts break and that `document.documentElement.scrollWidth <= innerWidth`.

- [ ] **Step 7: Commit**: `git commit -m "feat(menus): games catalog by category with filters and today's games"`.

### Task 5: Hoy

**Files:**
- Modify: `src/core/dates.ts`, `src/core/dates.test.ts`
- Create: `src/screens/today/WeekStrip.tsx`, `src/screens/today/WeekStrip.test.tsx`
- Modify: `src/screens/TodayScreen.tsx`, `src/screens/Today.module.css`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/TodayScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `SunIcon` (Task 2), `PendingSyncBadge`.
  - `GameDefinition.Thumb` and `games.<id>.skill` (Task 3).
- Produces:
  - `weekOf(day: string): string[]`: the seven days, Monday to Sunday, of the week that holds `day`, as `YYYY-MM-DD`. Monday offset: `(new Date(`${day}T12:00:00`).getDay() + 6) % 7`, then `addDays`.
  - `WeekStrip({ today, completed }: { today: string; completed: readonly string[] })`.
- New i18n keys:

  | Key | es | en |
  |---|---|---|
  | `today.streakDays_one` | {{count}} día | {{count}} day |
  | `today.streakDays_other` | {{count}} días | {{count}} days |
  | `today.weekdays` (array) | `["L","M","M","J","V","S","D"]` | `["M","T","W","T","F","S","S"]` |
  | `today.week` | {{done}} de 7 días entrenados esta semana | {{done}} of 7 days trained this week |
  | `today.next` | Sigue | Next |
  | `today.continueStep` | Continuar · {{step}} de {{total}} | Continue · {{step}} of {{total}} |
  | `today.explore` | Explorar juegos | Explore games |

  - `today.streak_*` and `today.done` stay; they become visually hidden text.

- [ ] **Step 1: Write the failing tests.**
  - `dates.test.ts`:
    - `weekOf('2026-10-20')` (Tuesday) equals `['2026-10-19', …, '2026-10-25']`.
    - `weekOf('2026-11-01')[0] === '2026-10-26'`.
    - `weekOf('2027-01-01')` runs from `'2026-12-28'` to `'2027-01-03'`.
    - `weekOf('2026-10-19')[0] === '2026-10-19'`.
  - `WeekStrip.test.tsx`: render with `today='2026-10-22'` (Thursday) and `completed=['2026-10-19', '2026-10-21', '2026-10-14']`.
    - `screen.getByText('2 de 7 días entrenados esta semana')` (visually hidden).
    - The strip's `<ol>` is `aria-hidden`.
    - Its items carry `data-state`: `['done', 'missed', 'done', 'today', 'future', 'future', 'future']`.
    - When `today` itself is completed, its item is `done`.
  - `TodayScreen.test.tsx`, keeping all four existing tests with these updates:
    - The continue link is `Continuar · 2 de 3`.
    - `Hecho` is still found inside the first list item.
    - The completed day shows link `Explorar juegos` with `href` `/games`.
  - Add to `TodayScreen.test.tsx`:
    - `test('the next game says «Sigue» and played ones show ✓ and their score')`: mark game 0 done with an `addResult` score of 321. The first list item contains `Hecho` and `321`; the second contains `Sigue`; the third contains neither.
    - `test('streak pill and week summary')`:
      - Visible `0 días`, and still `0 días seguidos` (hidden text).
      - `1 de 7 días entrenados esta semana` after completing today's plan.
    - `test('a stale plan id does not break the screen')`: `db.dailyPlans.put({ day: DAY, gameIds: ['old-game', 'arrows', 'quick-math'], completed: [] })` before render; three list items, with the button `Comenzar`.

- [ ] **Step 2: Run** `npx vitest run src/core/dates.test.ts src/screens/today src/screens/TodayScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `weekOf` and `WeekStrip`.**
  - WeekStrip markup:
    - `<div className={styles.week}>`
    - `<p className="visually-hidden">{t('today.week', { done })}</p>`
    - `<ol aria-hidden="true">` with seven `<li data-state=…><span>{initial}</span><i /></li>`.
  - `done` counts the completed days in the week.
  - Day states:
    - `done` if the day is in `completed`.
    - else `today` if the day is `today`.
    - else `future` if the day comes after `today`.
    - else `missed`.
  - Dots are 22 px:
    - `done`: `background: var(--accent); box-shadow: 0 0 10px var(--glow)`.
    - `today`: `box-shadow: inset 0 0 0 2px var(--accent)`.
    - `missed` and `future`: `background: var(--border)`.
  - Initials are 0.72rem in `--text-muted`.
  - The strip sits in a card (`--card-bg`, `--card-shadow`).

- [ ] **Step 4: Rebuild `TodayScreen`.** The data hooks stay as they are; only the markup changes, in this order.
  - **Top row**
    - `<div className={styles.top}>`:
      - `<span className={styles.brand}>{t('app.name')}</span>`, 1.3rem, weight 800.
      - The streak pill:
        ```tsx
        <span className={styles.streak}>
          <SunIcon />
          <span aria-hidden="true">{t('today.streakDays', { count })}</span>
          <span className="visually-hidden">{t('today.streak', { count })}</span>
        </span>
        ```
    - Pill style: `color: var(--accent-strong)`, `background: color-mix(in srgb, var(--accent) 14%, transparent)`, `box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 40%, transparent)`, `border-radius: 999px`, padding `.3rem .8rem`, weight 700.
  - **Title**
    - h1 `today.title`, 1.9rem, weight 800.
    - Then `<PendingSyncBadge />`.
    - Then, when not done, `<p>` `today.intro` in `--text-muted`.
  - `<WeekStrip today={today} completed={days} />`.
  - The load error, unchanged.
  - **Rows**
    - `<ol className={styles.plan}>`, one `<li data-state="done|next|pending" data-area={area}>` per plan id (in the completed state they are all `done`).
    - Each row is a card with `display: flex; align-items: center; gap: .75rem; padding: .6rem`, holding:
      - The thumbnail, 48 px wide, when `getGame(id)` exists.
      - Name (weight 700) and skill (0.8rem, muted).
      - On the right: for `done`, `<span aria-hidden="true">✓</span><span className="visually-hidden">{t('today.done')}</span><span className={styles.score}>{score ?? '—'}</span>`, in `--success-strong`; for `next`, `<span className={styles.next}>{t('today.next')}</span>` with `color: var(--area-<area>)`.
    - A `done` row is at `opacity: .6`, except in the completed state.
    - `next` is the first id not in `plan.completed`.
  - **Button**
    - The link `<Link className={styles.primary} to={`/play/${next}?daily=${today}`}>`.
    - Label: `common.start` when `plan.completed.length === 0`, else `t('today.continueStep', { step: plan.completed.length + 1, total: plan.gameIds.length })`.
    - Full width (max 22rem, centered), `min-height: 52px`, pill, `background: var(--accent)`, `color: var(--accent-text)`, weight 800, `box-shadow: 0 6px 24px var(--glow)`.
  - **Completed**
    - h2 `today.completed`.
    - The rows.
    - `today.comeBack`.
    - `<Link className={styles.secondary} to="/games">{t('today.explore')}</Link>`: pill, `min-height: 48px`, `box-shadow: inset 0 0 0 1.5px var(--border)`.

- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS. `e2e/daily.spec.ts` must still hold: three list items, `Comenzar`, then `1 día seguido`.

- [ ] **Step 6: Screenshots.** Take `/` in light and dark at 390×844, in two states: fresh, and after finishing one game. Take the completed state too if it is easy (otherwise Task 8 covers it). Take `/` at 320×640 in English.

- [ ] **Step 7: Commit**: `git commit -m "feat(menus): Today with streak pill, week strip and game rows"`.

### Task 6: Progreso

**Files:**
- Create: `src/screens/Progress.module.css`
- Modify: `src/screens/ProgressScreen.tsx`, `src/screens/progress/LineChart.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/ProgressScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `catalogAreas`, `CATALOG_AREAS` (Task 4).
  - `GameDefinition.Thumb` (Task 3).
- i18n keys:
  - Add:

    | Key | es | en |
    |---|---|---|
    | `progress.statStreak` | Racha actual | Current streak |
    | `progress.statBest` | Mejor racha | Best streak |
    | `progress.statDays` | Días entrenados | Days trained |
    | `progress.best` | Mejor {{score}} | Best {{score}} |
    | `progress.goToday` | Ir a Hoy | Go to Today |

  - Remove `progress.streakCurrent`, `progress.streakBest`, `progress.daysTrained` and `gamesScreen.best` once nothing uses them (`grep -rn` first).

- [ ] **Step 1: Write the failing tests** (update `ProgressScreen.test.tsx`).
  - Empty state: the existing message, plus a link `Ir a Hoy` with `href` `/`.
  - Main test:
    - Stats: `within(getByText('Racha actual').closest('li')).getByText('1')`, and likewise `Mejor racha` → `1` and `Días entrenados` → `2`.
    - Area meters: `getByRole('meter', { name: 'Atención' })` has `aria-valuenow="143"`, `Matemáticas` has `100`, and there is no meter for `Memoria` (its row shows `—`).
    - The order of the area labels equals `['Velocidad', 'Memoria', 'Atención', 'Flexibilidad mental', 'Matemáticas']`.
    - `Mejor 200` is visible.
    - The chart `img` named `/máximo 200, último 200/` is present.
    - `Juega al menos dos partidas para ver tu evolución.` is present.

- [ ] **Step 2: Run** `npx vitest run src/screens/ProgressScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Stats**
    - `<ul className={styles.stats}>`: three cards in a three-column grid.
    - Each is `<li><b>{n}</b><span>{label}</span></li>`, with the number 1.6rem weight 800 tabular, and the label 0.75rem muted.
  - **Areas**
    - A card with h2 `progress.byArea`, then one row per `catalogAreas(GAMES)`:
      - `<span id>` label.
      - Either `<div role="meter" aria-labelledby={id} aria-valuemin={0} aria-valuemax={1000} aria-valuenow={value} className={styles.track}><i style={{ width: `${value / 10}%` }} /></div>`, or `<span>—</span>` when there is no value.
      - The value on the right, weight 700 tabular.
    - The bar is 8 px high, pill-shaped, `background: var(--border)`. The fill is `var(--area-<area>)` via `[data-area]` on the row; in dark it also gets `box-shadow: 0 0 8px currentColor`.
  - **Per game**
    - h2 `progress.byGame`, then one card per game with results.
    - Order: games sorted by `CATALOG_AREAS.indexOf(g.area)`, ties kept in registry order.
    - Card: thumbnail 44 px, name (weight 700), `progress.best`, and the chart below at full width.
    - The card has `data-area`, which sets `--c: var(--area-<area>)`.
  - **Chart**: `LineChart` gets an optional `className` prop. The progress card passes a class with `color: var(--c)`. The existing `.chart` default color (`--accent`) stays for other uses.
  - **Empty state**: the message, plus `<Link to="/" className={styles.cta}>{t('progress.goToday')}</Link>`, a pill styled like Today's primary button.

- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Screenshots.** Take `/progress` in light and dark: empty, and with data. For the data, play one game in the Playwright script with `page.clock` and `e2e/helpers.ts` → `finishCurrentGame`.

- [ ] **Step 6: Commit**: `git commit -m "feat(menus): Progress with stat cards, area bars and game cards"`.

### Task 7: Ajustes

**Files:**
- Create: `src/app/ui/Switch.tsx`, `src/app/ui/SegmentedControl.tsx`, `src/app/ui/controls.module.css`, `src/app/ui/controls.test.tsx`
- Create: `src/screens/Settings.module.css`
- Modify: `src/screens/SettingsScreen.tsx`, `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Produces:
  - `Switch({ id, label, checked, onChange, hint }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string })`.
    - Renders a `<div className={styles.switchRow}>`.
    - Inside it, a `<label htmlFor={id}>` that wraps the text and a track (`min-height: 44px`, text left, track right). The label holds the text, `<input id={id} type="checkbox" role="switch" checked onChange aria-describedby={hint ? `${id}-hint` : undefined} className={styles.switchInput} />` and `<span className={styles.track} aria-hidden="true" />`.
    - Then `{hint && <p id={`${id}-hint`}>…</p>}` **outside** the label, so the accessible name is only `label`.
  - `SegmentedControl<T extends string>({ name, legend, options, value, onChange }: { name: string; legend: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void })`.
    - Renders `<fieldset><legend>` with one `<label>` per option, each wrapping a radio input (`name`, `value`, `checked`, `onChange`) and its text.
- New i18n keys:

  | Key | es | en |
  |---|---|---|
  | `settings.appearance` | Apariencia | Appearance |
  | `settings.duringGame` | Durante el juego | While playing |

- [ ] **Step 1: Write the failing tests.**
  - `controls.test.tsx`:
    - **Switch**
      - `getByRole('switch', { name: 'Sonido' })` is checked.
      - Clicking calls `onChange(false)`.
      - With `hint='Solo en teléfonos'`, its accessible description is the hint (`toHaveAccessibleDescription`) and its name is still exactly `Sonido`.
    - **SegmentedControl**
      - `getByRole('group', { name: 'Tema' })` holds three radios.
      - The `value` one is checked.
      - Clicking another calls `onChange` with its value.
      - Arrow keys move between radios (`userEvent.keyboard('{ArrowRight}')` checks the next one, the native behavior).
  - `SettingsScreen.test.tsx`: all current tests stay. Add:
    - `test('settings are grouped')`: level-2 headings equal `['Apariencia', 'Durante el juego', 'Privacidad', 'Tus datos']`.
    - The theme radios sit inside `getByRole('group', { name: 'Tema' })`.

- [ ] **Step 2: Run** `npx vitest run src/app/ui src/screens/SettingsScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement the controls.**
  - **Switch**
    - The input is positioned over the track (`position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer`) inside a `position: relative` wrapper around the track, so it is still the native, focusable, clickable control.
    - The track is `48×28`, `border-radius: 999px`, `background: var(--border)`, with a 22 px white knob drawn as a `::after` on the **span**.
    - Checked (`input:checked + .track`): `background: var(--accent)`, knob moved 20 px (`translate`), and in dark a glow.
    - `input:focus-visible + .track`: outline `3px solid var(--accent)`, offset 2px.
  - **Segmented control**
    - The radio is visually hidden inside its label: clip it; do not use `display: none`.
    - The labels sit in a three-column grid, `padding: 4px`, `background: var(--border)`, `border-radius: 999px`.
    - Each label: `min-height: 44px; display: grid; place-items: center; border-radius: 999px; font-weight: 700`.
    - `label:has(input:checked)`: `background: var(--surface); box-shadow: var(--card-shadow)`.
    - `label:has(input:focus-visible)`: outline as above.

- [ ] **Step 4: Rebuild `SettingsScreen`.** The handlers and the delete flow stay; only the markup and CSS change.
  - h1 `nav.settings`.
  - Each group is `<section>` with a small h2 label above a card. The h2 is 0.75rem, weight 700, uppercase, `letter-spacing: .08em`, `--text-muted`.
  - **Apariencia**
    - A row with `<label htmlFor="language">` and the `select`, aligned to the right.
    - `<SegmentedControl name="theme" legend={t('settings.theme')} …>`. Its legend is styled like a row label.
  - **Durante el juego**: `<Switch id="sound" …>`, then `<Switch id="vibration" hint={t('settings.vibrationHint')} …>`.
  - **Privacidad**: the current paragraphs.
  - **Tus datos**
    - Button `settings.deleteData`: full width, `min-height: 48px`, pill, `color: var(--danger)`, `background: transparent`, `box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--danger) 55%, transparent)`, `border: none`.
    - The confirmation dialog keeps its roles and texts.
    - «Sí, borrar»: solid `background: var(--danger); color: #fff`.
    - «Cancelar»: a plain pill.
  - Rows inside a card are separated by `border-top: 1px solid var(--border)`.

- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run typecheck`. Expected: PASS. `e2e/touch-targets.spec.ts` (settings controls ≥ 44 px) must still hold by design: every `label:has(input)` is ≥ 44 px.

- [ ] **Step 6: Screenshots.** Take `/settings` in light and dark at 390×844, plus one with the delete confirmation open, plus one at 320×640 in English.

- [ ] **Step 7: Commit**: `git commit -m "feat(menus): grouped Settings with switches and a segmented theme control"`.

### Task 8: E2E de menús y capturas para el dueño

**Files:**
- Create: `e2e/menus.spec.ts`
- Modify: `e2e/touch-targets.spec.ts` (only if a selector there no longer matches)

**Interfaces:**
- Consumes:
  - Everything above.
  - `finishCurrentGame` from `e2e/helpers.ts`.

- [ ] **Step 1: Write the tests** in `e2e/menus.spec.ts`:
  - `test('menu touch targets are at least 44 px')`, reusing the `expectTall` pattern from `touch-targets.spec.ts` (copy the helper, or move it to `e2e/helpers.ts` and import it in both). Targets:
    - The four nav links.
    - The filter buttons on `/games`.
    - `main a` cards on `/games`.
    - `label:has(input)` on `/settings`.
    - The Today primary link.
  - `test.describe` for each of `es-CO` and `en-US` with `viewport: { width: 320, height: 640 }`: `test('no sideways scroll on the four menus')`. It visits `./#/`, `./#/games`, `./#/progress` and `./#/settings` and asserts `scrollWidth <= innerWidth`, the same check as `luz.spec.ts`.
  - `test.describe` with `viewport: { width: 390, height: 844 }`: `test('no sideways scroll with a 24 px root font')`. It sets `document.documentElement.style.fontSize = '24px'` after each `goto` and asserts the same on `/` and `/games`.
  - `test('back from a game keeps the catalog filter')`:
    - `goto('./#/games')` and click `Memoria`.
    - Click the `Secuencia de luces` card.
    - Click the ✕ (`button` named `Salir del juego`, the `play.exit` key).
    - Expect the URL to contain `area=memory` and the `Memoria` button to have `aria-pressed="true"`.
  - `test.describe.each(['light', 'dark'])('%s screenshots')`, with `test.use({ colorScheme, viewport: { width: 390, height: 844 } })`, writing to `test-results/menus/`:
    - Install the clock at `2026-10-20T10:00:00`.
    - Screenshot `/` fresh.
    - Start the daily training and `finishCurrentGame`, then click `Ver resumen` / `Siguiente juego` back to Today, and screenshot `/` with one game done.
    - Screenshot `/games`, `/progress` and `/settings` (full page).
    - The test asserts only that each page's h1 is visible; the images are for review.

- [ ] **Step 2: Run** `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`. Expected: every spec passes, old and new.
  - Fix any real layout bug a test finds, in the screen's CSS.
  - Never weaken an assertion.

- [ ] **Step 3: Look at the twelve screenshots** in `test-results/menus/`, then list them in the report with one line each on what they show.

- [ ] **Step 4: Commit**: `git commit -m "test(menus): touch targets, narrow screens, filter memory and screenshots"`.
