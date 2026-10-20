# Light — Plan 2: Supabase para invitados (sincronización y percentiles) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los resultados de cada jugador se suben de forma anónima a Supabase (sin cuentas todavía), la app muestra "Estás por encima del X % de los jugadores" cuando hay al menos 20 jugadores activos, y el proyecto gratuito se mantiene despierto y limpio.

**Architecture:** Base de datos en `supabase/migrations` (tablas, RLS, trigger de validación, función de percentil y limpieza programada), probada con pgTAP sobre un Supabase local. En la app, una capa `src/sync/` independiente: una interfaz `RemoteStore` con su implementación sobre supabase-js, un motor `syncNow` que sube la cola local (IndexedDB) y un planificador con reintentos. Todo es opcional: sin variables `VITE_SUPABASE_*`, la app funciona exactamente como en el Plan 1.

**Tech Stack:** Lo del Plan 1, más `@supabase/supabase-js@2.118.0` (dependencia), `supabase@2.121.0` (CLI, devDependency), pgTAP 1.3.3, pg_cron 1.6.4 y Cloudflare Turnstile (script externo, cargado solo si se configura).

**Spec:** `docs/superpowers/specs/2026-10-18-light-brain-training-design.md` — este plan cubre §5.2 (sin la tabla `usernames`), §5.3, §5.4 (solo la parte de invitado: identidad anónima con Turnstile), §5.5 (sin la descarga del historial al iniciar sesión), §5.6, y los casos de servidor de §6. Las cuentas, Edge Functions y la fusión de invitado quedan para el Plan 3.

## Global Constraints

- Versiones exactas: `@supabase/supabase-js@2.118.0` en `dependencies` y `supabase@2.121.0` en `devDependencies` (con `--save-exact`).
- **La sincronización es opcional:** si falta `VITE_SUPABASE_URL` o `VITE_SUPABASE_PUBLISHABLE_KEY`, no hay ninguna petición de red y la app se comporta como en el Plan 1. Todas las pruebas existentes deben seguir pasando sin Supabase.
- **Claves:** la clave *publishable* es pública y va en la app. La clave de servicio (secret/service role) nunca va en el código de la app ni en el repo; solo la usan las pruebas de integración contra el Supabase **local**, leyéndola de `supabase status`.
- La identidad anónima se crea solo al subir el primer resultado, nunca al abrir la página (spec §5.4).
- El cliente nunca envía `user_id`; la base de datos lo toma de `auth.uid()`. Los resultados son inmutables; se suben con `upsert(..., { onConflict: 'id', ignoreDuplicates: true })`.
- Percentil: 30 días de ventana, mínimo **20 jugadores activos sin contar a quien consulta**, se compara la mejor marca propia de 30 días contra la mejor de cada otro jugador (spec §5.3). Si la función devuelve `null`, no se muestra nada.
- Un resultado rechazado por el servidor (restricción o trigger) se conserva en el dispositivo y no se reintenta (spec §6).
- Turnstile se carga solo si existe `VITE_TURNSTILE_SITE_KEY`, y solo en el momento de crear la identidad.
- Todo texto nuevo existe en ES y EN (la prueba de paridad sigue vigente); la nota de privacidad dice con honestidad qué se envía.
- **Entorno local de este sandbox:** el demonio de Docker no arranca solo (`dockerd &`), y el registro por defecto de Supabase (ECR) está bloqueado: usar `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. En GitHub Actions no hace falta.
- Mensajes de commit en inglés; identificadores en inglés.

## Review Focus

1. **Supabase caído, pausado o sin red** en cualquier paso (crear identidad, subir, percentil, borrar): la app sigue funcionando, no se pierde nada, reintenta con espera creciente y nunca bloquea al jugador. → Task 5 (`syncNow` offline) y Task 6 (reintentos).
2. **Identidad anónima borrada en el servidor** (limpieza automática o manual) mientras el dispositivo conserva una sesión vieja: se crea una nueva y se vuelven a subir todos los resultados locales. → Task 5 (unitaria) y Task 9 (integración real).
3. **Una fila mala no bloquea la cola** (puntaje sobre el máximo, fecha en el futuro, juego desconocido): se rechaza solo esa y el resto se sube. → Task 5 y Task 9.
4. **Disparos repetidos** (terminar partida, volver la conexión y volver a la pestaña casi a la vez): nunca hay dos subidas en paralelo ni dos identidades creadas. → Task 6 (una sola ejecución a la vez).
5. **"Borrar mis datos" sin conexión:** se avisa que no se pudo borrar del servidor y no se borra nada local, para poder reintentar. → Task 8.

## Mapa de archivos

| Ruta | Responsabilidad |
|---|---|
| `supabase/config.toml` | Configuración del Supabase local (anónimos activados, límites locales) |
| `supabase/migrations/*.sql` | Esquema, RLS, validación, percentil y limpieza programada |
| `supabase/tests/*.test.sql` | Pruebas pgTAP |
| `src/sync/config.ts` | Leer `VITE_SUPABASE_*` y `VITE_TURNSTILE_SITE_KEY` |
| `src/sync/remote.ts` | Interfaz `RemoteStore`, clasificación de errores, implementación con supabase-js |
| `src/sync/captcha.ts` | Obtener un token de Turnstile |
| `src/sync/syncEngine.ts` | `syncNow`: subir resultados y días completados |
| `src/sync/scheduler.ts` | Una ejecución a la vez, reintentos con espera creciente |
| `src/sync/index.ts` | Servicio de la app: `startSyncService`, `requestSync`, `getRemote` |
| `src/sync/percentile.ts` | `fetchPercentile` |
| `src/sync/deleteData.ts` | `deleteEverything` (servidor + dispositivo) |
| `src/app/SyncManager.tsx`, `src/app/PendingSyncBadge.tsx` | Arrancar la sincronización e indicador "N partidas por sincronizar" |
| `src/screens/play/PercentileLine.tsx` | Línea del percentil en el resultado |
| `tests/integration/` | Pruebas contra el Supabase local |
| `.github/workflows/keep-alive.yml` | Consulta cada 3 días |
| `SETUP.md` | Guía para crear y configurar el proyecto real (parte invitados) |

---

### Task 1: Supabase local y esquema base (tablas, RLS, validación)

**Files:**
- Create: `supabase/config.toml` (con `npx supabase init`), `supabase/migrations/20261020000000_core_schema.sql`, `supabase/tests/01_core_schema.test.sql`
- Modify: `package.json` (dependencia CLI y scripts), `.gitignore` (`supabase/.temp`, `supabase/.branches`), `README.md` (sección "Supabase local")

**Interfaces:**
- Produces:
  - Scripts npm: `db:start` = `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,mailpit,postgres-meta,supavisor`; `db:stop` = `supabase stop`; `db:reset` = `supabase db reset`; `db:test` = `supabase test db`.
  - Tablas `public.games`, `public.results` y `public.daily_completions`, exactamente como en spec §5.2, con un cambio: `duration_ms between 5000 and 3600000` (ver Step 3).
  - Filas de `games`: `('sequence-lights','memory',960)`, `('arrows','attention',8000)`, `('same-different','speed',12000)`, `('rule-switch','flexibility',10000)` y `('quick-math','math',8000)`. Son las mismas cifras que `maxScore` en el registro de juegos.

- [ ] **Step 1: Inicializar Supabase.** Instalar `supabase@2.121.0` como devDependency y ejecutar `npx supabase init`. En `config.toml`:
  - `project_id = "light"`
  - En `[auth]`: `site_url = "http://localhost:5173/Light/"`, `enable_anonymous_sign_ins = true` y `enable_manual_linking = true` (lo usará el Plan 3).
  - En `[auth.rate_limit]`: `anonymous_users = 1000` (solo local; las pruebas crean muchos invitados).

  Arrancar con `dockerd &` (en este sandbox) y luego `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npm run db:start`. Expected: muestra `API_URL http://127.0.0.1:54321`.

- [ ] **Step 2: Escribir la prueba pgTAP que falla** en `supabase/tests/01_core_schema.test.sql`. Se crean dos usuarios en `auth.users` como `postgres`, con `id`, `aud` y `role = 'authenticated'` e `is_anonymous = true`. Para actuar como ellos: `set local role authenticated` y `select set_config('request.jwt.claims', json_build_object('sub', <id>, 'role', 'authenticated')::text, true)`. Casos, con un `plan()` que los cuente:
  - `has_table` para las 3 tablas, y `results_eq` de `games` contra las 5 filas de arriba.
  - **Como A:**
    - Insertar un resultado válido sin `user_id` funciona y queda con `user_id = A`.
    - Insertar con `user_id = B` se rechaza (`42501`).
    - Insertar dos veces el mismo id con `on conflict (id) do nothing` deja 1 fila.
  - **Como B:**
    - `select count(*) from results` es 0, porque no ve lo de A.
    - `delete from results` no borra filas de A.
    - `update` no está permitido (se rechaza o afecta 0 filas).
  - **Rol `anon` (sin sesión):** puede leer `games` y no puede insertar en `results`.
  - **Validación**, con `throws_ok`:
    - `score` mayor que `games.max_score` se rechaza.
    - `played_at = now() + interval '10 minutes'` se rechaza; con `+ interval '4 minutes'` se acepta.
    - `game_id` inexistente se rechaza (`23503`).
    - `level` 11 se rechaza.
    - `duration_ms` 4000 se rechaza; 3600000 se acepta.
  - **`daily_completions`:** A inserta `('2026-10-20', '{arrows,quick-math,rule-switch}')`; B no lo ve. Repetir el mismo día con `on conflict do nothing` deja 1 fila.

- [ ] **Step 3: Verificar que falla.** Run: `npm run db:test`. Expected: FAIL, porque las tablas no existen.

- [ ] **Step 4: Escribir la migración** `20261020000000_core_schema.sql`:
  - El DDL de spec §5.2 sin `usernames`, con el cambio de `duration_ms` (5000–3600000) para que una partida larga de Secuencia de luces, con pausas, no se rechace.
  - Los índices de la spec y los `insert` de `games`.
  - RLS activado en las 3 tablas. Políticas:
    - `games`: `select` para `anon` y `authenticated`.
    - `results` y `daily_completions`: `select`, `insert` y `delete` para `authenticated` con `user_id = (select auth.uid())`.
    - Sin `update` en ninguna.
  - Trigger `before insert` en `results` que llama a `public.validate_result()` (plpgsql, `security invoker`, `set search_path = ''`). Lanza una excepción con `errcode = 'P0001'` si el puntaje supera `max_score`, o si `played_at > now() + interval '5 minutes'`.

- [ ] **Step 5: Verificar.** Run: `npm run db:reset && npm run db:test`. Expected: `All tests successful`. Luego `npm test`: todo pasa, porque la app aún no cambió.

- [ ] **Step 6: Documentar y commit.** En el README, agregar la sección "Supabase local" con `dockerd &` (en el sandbox), `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` y los scripts `db:*`. Luego `git commit -m "feat(db): add core schema with RLS and result validation"`.

---

### Task 2: Función de percentil

**Files:**
- Create: `supabase/migrations/20261020000100_percentile.sql`, `supabase/tests/02_percentile.test.sql`

**Interfaces:**
- Produces: `public.get_percentile(p_game_id text, p_best_score integer) returns integer`, el SQL de spec §5.3 tal cual. `execute` solo para `authenticated` (revocado de `public` y `anon`).

- [ ] **Step 1: Escribir la prueba pgTAP que falla.** Se crea al usuario Q (quien consulta) y 25 usuarios más. Como `postgres`, se insertan resultados de `arrows` con `played_at` controlado.
  - **19 jugadores activos** sin contar a Q → `get_percentile('arrows', 500)` como Q es `null`.
  - **20 activos**: las mejores marcas son 100, 200, …, 2000 (cada uno con 2 partidas, una peor) → `get_percentile('arrows', 1050)` = 50, `get_percentile('arrows', 50)` = 0 y `get_percentile('arrows', 5000)` = 100.
  - **Un jugador con su única partida hace 31 días** no cuenta: con 20 activos más ese, sigue siendo 20 el denominador.
  - **Los resultados de Q no se cuentan**, aunque tenga muchas partidas.
  - **Otro juego no influye.**
  - **El rol `anon` no puede ejecutarla** (`throws_ok`, `42501`).

- [ ] **Step 2: Verificar que falla.** Run: `npm run db:test`. Expected: FAIL, porque la función no existe.

- [ ] **Step 3: Escribir la migración** con la función de spec §5.3 y los `grant`/`revoke`.

- [ ] **Step 4: Verificar.** Run: `npm run db:reset && npm run db:test`. Expected: todo pasa.

- [ ] **Step 5: Commit.** `git commit -m "feat(db): add percentile function with 20-active-player threshold"`

---

### Task 3: Limpieza programada de invitados inactivos

**Files:**
- Create: `supabase/migrations/20261020000200_cleanup.sql`, `supabase/tests/03_cleanup.test.sql`

**Interfaces:**
- Produces:
  - `public.cleanup_inactive_anonymous_users() returns integer` (plpgsql, `security definer`, `set search_path = ''`). Borra de `auth.users` a los usuarios con `is_anonymous` y `created_at < now() - interval '90 days'` que no tienen resultados con `played_at >= now() - interval '90 days'`, y devuelve cuántos borró. `execute` revocado de `public`, `anon` y `authenticated`.
  - El trabajo de pg_cron `light-cleanup-anonymous-users`, con horario `'0 4 * * 0'` (domingos 04:00 UTC).

- [ ] **Step 1: Escribir la prueba pgTAP que falla.** Usuarios:

| Usuario | Tipo | Creado hace | Última partida | Resultado esperado |
|---|---|---|---|---|
| A | Anónimo | 100 días | Ninguna | Se borra |
| B | Anónimo | 100 días | Hace 10 días | Se conserva |
| C | Anónimo | 10 días | Ninguna | Se conserva |
| D | Permanente (`is_anonymous = false`) | 200 días | Ninguna | Se conserva |

  Casos:
  - La función devuelve 1 y los resultados de A se borran en cascada.
  - Existe en `cron.job` un trabajo con nombre `light-cleanup-anonymous-users` y `schedule = '0 4 * * 0'`.
  - `authenticated` no puede ejecutar la función.

- [ ] **Step 2: Verificar que falla.** Run: `npm run db:test`. Expected: FAIL.

- [ ] **Step 3: Escribir la migración:**
  - `create extension if not exists pg_cron with schema pg_catalog;`
  - La función y los `revoke`.
  - El `cron.schedule` en un bloque que primero desprograma si ya existe (`cron.unschedule` dentro de `if exists`), para que la migración se pueda volver a aplicar.

- [ ] **Step 4: Verificar.** Run: `npm run db:reset && npm run db:test`. Expected: todo pasa.

- [ ] **Step 5: Commit.** `git commit -m "feat(db): weekly cleanup of inactive anonymous users"`

---

### Task 4: Configuración, `RemoteStore` y Turnstile

**Files:**
- Create: `src/sync/config.ts`, `src/sync/remote.ts`, `src/sync/captcha.ts`
- Modify: `package.json` (`@supabase/supabase-js@2.118.0`), `src/vite-env.d.ts` (tipos de `import.meta.env`)
- Test: `src/sync/config.test.ts`, `src/sync/remote.test.ts`, `src/sync/captcha.test.ts`

**Interfaces:**
- Produces:

```ts
// config.ts
export interface SyncConfig { url: string; publishableKey: string; turnstileSiteKey: string | null }
export function readSyncConfig(env: Record<string, string | undefined>): SyncConfig | null; // null si falta url o key (o están vacías)
export const syncConfig: SyncConfig | null; // readSyncConfig(import.meta.env)

// remote.ts
export interface RemoteResult { id: string; game_id: string; level: number; score: number; accuracy: number;
  duration_ms: number; is_daily: boolean; played_at: string }
export interface RemoteCompletion { day: string; games: string[] }
export type RemoteErrorKind = 'rejected' | 'auth' | 'network';
export class RemoteError extends Error { constructor(public kind: RemoteErrorKind, message: string) }
export function classifyError(error: { code?: string; status?: number; message?: string; name?: string }): RemoteErrorKind;
export interface RemoteStore {
  currentUserId(): Promise<string | null>;               // null si no hay sesión
  signInGuest(captchaToken?: string): Promise<string>;   // devuelve el user id
  signOut(): Promise<void>;
  upsertResults(rows: RemoteResult[]): Promise<void>;     // lanza RemoteError
  upsertCompletions(rows: RemoteCompletion[]): Promise<void>;
  percentile(gameId: string, bestScore: number): Promise<number | null>;
  deleteMyData(): Promise<void>;                           // borra results y daily_completions propios
}
export function createSupabaseRemote(config: SyncConfig, options?: { storage?: Storage }): RemoteStore;

// captcha.ts
export function createCaptchaTokenGetter(siteKey: string | null, doc?: Document): () => Promise<string | undefined>;
```

Reglas de `classifyError`:
- **`rejected`:** los códigos `23514` (check), `23503` (FK), `P0001` (trigger), `22P02` y `23502`.
- **`auth`:** `status` 401 o 403, los códigos `PGRST301`/`PGRST302`/`42501`, o un nombre que empieza por `AuthSession`.
- **`network`:** todo lo demás, incluidos `TypeError: Failed to fetch`, status 0 y 5xx.

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
test('readSyncConfig needs url and key', () => {
  expect(readSyncConfig({})).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }))
    .toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_1', turnstileSiteKey: null });
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_PUBLISHABLE_KEY: 'k', VITE_TURNSTILE_SITE_KEY: 't' })?.turnstileSiteKey).toBe('t');
});
test('the test build has no sync config', () => { expect(syncConfig).toBeNull(); });
test.each([
  [{ code: '23514' }, 'rejected'], [{ code: 'P0001' }, 'rejected'], [{ code: '23503' }, 'rejected'],
  [{ status: 401 }, 'auth'], [{ code: 'PGRST301' }, 'auth'], [{ name: 'AuthSessionMissingError' }, 'auth'],
  [{ name: 'TypeError', message: 'Failed to fetch' }, 'network'], [{ status: 503 }, 'network'], [{}, 'network'],
])('classifyError(%j) = %s', (e, kind) => { expect(classifyError(e)).toBe(kind); });
test('captcha getter returns undefined without a site key and never loads a script', async () => {
  const get = createCaptchaTokenGetter(null, document);
  expect(await get()).toBeUndefined();
  expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
});
test('captcha getter renders a widget and resolves with its token', async () => {
  const render = vi.fn((_el: HTMLElement, opts: { callback: (t: string) => void }) => { opts.callback('tok-1'); return 'w1'; });
  (window as unknown as { turnstile: unknown }).turnstile = { render, remove: vi.fn() };
  await expect(createCaptchaTokenGetter('site-key', document)()).resolves.toBe('tok-1');
  expect(render.mock.calls[0][1]).toMatchObject({ sitekey: 'site-key' });
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/sync`. Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - **`createSupabaseRemote`:** usa `createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'light-auth', storage } })`.
  - **`signInGuest`:** `auth.signInAnonymously({ options: { captchaToken } })`.
  - **`currentUserId`:** `auth.getSession()`; si hay sesión, valida con `auth.getUser()`. Un error de tipo `auth` devuelve `null`, después de `signOut({ scope: 'local' })`.
  - **`percentile`:** `rpc('get_percentile', { p_game_id, p_best_score })`.
  - **`deleteMyData`:** `delete().eq('user_id', id)` en ambas tablas.
  - **Errores:** todo error se convierte en `RemoteError(classifyError(e))`.
  - **`captcha.ts`:** si `window.turnstile` no existe, inserta una sola vez `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async>` y espera su `load`. Luego crea un `div` oculto, llama a `turnstile.render(div, { sitekey, callback, 'error-callback' })`, resuelve con el token y quita el widget y el `div`.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(sync): config, Supabase remote store and Turnstile token getter"`

---

### Task 5: Motor de sincronización (`syncNow`)

**Files:**
- Modify: `src/data/db.ts` (versión 2 del esquema)
- Create: `src/sync/syncEngine.ts`, `src/test/fakeRemote.ts`
- Test: `src/sync/syncEngine.test.ts`

**Interfaces:**
- Consumes: `RemoteStore`, `RemoteError`, `db`, `StoredResult`, `DailyPlan`, `isPlanComplete`.
- Produces:

```ts
// db.ts — versión 2: agrega la tabla meta 'id'; StoredResult.synced pasa a 0 | 1 | 2 (2 = rechazado, no se reintenta);
// DailyPlan agrega syncedCompletion?: boolean; export interface SyncMeta { id: 'sync'; remoteUserId: string | null }
export interface SyncReport { status: 'ok' | 'offline' | 'error'; uploaded: number; rejected: number; pending: number }
export const RESULT_BATCH_SIZE = 100;
export function syncNow(remote: RemoteStore, getCaptchaToken: () => Promise<string | undefined>): Promise<SyncReport>;
// fakeRemote.ts: createFakeRemote(): RemoteStore & { users: Map<string, {results: Map<string, RemoteResult>, completions: Set<string>}>;
//   currentUser: string | null; failNext(kind: RemoteErrorKind, times?: number): void; rejectIf(pred: (r: RemoteResult) => boolean): void;
//   signInCount: number; maxScore: Record<string, number> }
```

Algoritmo de `syncNow`:
1. **Pendientes:** resultados con `synced === 0` y planes completos sin `syncedCompletion`. Si no hay ninguno, devuelve `{ status: 'ok', ... }` sin tocar la red, y por lo tanto sin crear identidad.
2. **Identidad:** si `currentUserId()` es `null`, pide un token con `getCaptchaToken()` y llama a `signInGuest(token)`.
3. **Cambio de identidad:** si `meta.remoteUserId` existe y es distinto del usuario actual, vuelve a marcar con `synced = 0` todos los resultados que tenían `synced = 1` y deja `syncedCompletion = false` en todos los planes. Luego guarda `meta.remoteUserId`.
4. **Resultados:** se suben en lotes de 100, y si el lote sale bien se marcan con `synced = 1`. Si el error es `rejected`, se reintenta el lote fila por fila para aislar: las que fallan con `rejected` quedan en 2 y las que pasan en 1.
5. **Días completados:** se suben como `{ day, games: gameIds }` y se marcan con `syncedCompletion = true`.
6. **Errores:**
   - `network` en cualquier punto: detener y devolver `offline`. Lo ya subido queda marcado.
   - `auth`: llamar a `signOut()` y devolver `error`. La próxima ejecución crea una identidad nueva y se aplica el paso 3.

- [ ] **Step 1: Escribir las pruebas que fallan** (`beforeEach(clearAllData)`; los resultados se crean con `addResult`; el remoto es `createFakeRemote()`):

```ts
test('nothing pending: no network, no identity', async () => {
  const r = createFakeRemote();
  expect(await syncNow(r, async () => 'tok')).toMatchObject({ status: 'ok', uploaded: 0 });
  expect(r.signInCount).toBe(0);
});
test('first upload creates one guest identity with the captcha token and marks results synced', async () => { /* 3 resultados → uploaded 3, signIn con 'tok', synced 1 en los 3, users.get(id).results.size 3 */ });
test('uploads in batches of 100', async () => { /* 250 resultados → 3 llamadas a upsertResults (spy) y todos synced 1 */ });
test('re-running does not duplicate', async () => { /* dos syncNow seguidos → el servidor tiene 3, la segunda no llama a upsertResults */ });
test('a rejected row does not block the rest', async () => {
  /* rejectIf(r => r.score > 1000): 3 válidos + 1 con score 5000 → uploaded 3, rejected 1; el malo synced 2;
     una nueva syncNow no lo vuelve a enviar */
});
test('network failure keeps everything pending and reports offline', async () => { /* failNext('network') → status offline, synced 0 */ });
test('network failure mid-way keeps what was already uploaded', async () => { /* 150 resultados, failNext('network') en el 2.º lote → 100 synced 1, 50 synced 0 */ });
test('lost identity: a new guest is created and everything is uploaded again', async () => {
  /* subir 3 → borrar el usuario del fake y currentUser = null → agregar 1 resultado → syncNow
     → signInCount 2, el usuario nuevo tiene los 4 resultados */
});
test('auth error signs out and reports error', async () => { /* failNext('auth') → status error y currentUser null */ });
test('completed days are uploaded once', async () => { /* plan completo → completions con el día; segunda syncNow no lo reenvía; plan incompleto no se sube */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/sync/syncEngine.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implementar** la versión 2 del esquema Dexie (sin `upgrade`: los campos nuevos son opcionales), `syncNow` y `createFakeRemote`. El fake valida `score <= maxScore[game_id]` con la tabla de `GAMES` para simular el trigger.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS (también las pruebas del Plan 1).

- [ ] **Step 5: Commit.** `git commit -m "feat(sync): upload pending results and completed days with retry-safe state"`

---

### Task 6: Planificador, servicio de la app e indicador de pendientes

**Files:**
- Create: `src/sync/scheduler.ts`, `src/sync/index.ts`, `src/app/SyncManager.tsx`, `src/app/PendingSyncBadge.tsx`
- Modify: `src/app/App.tsx` (montar `SyncManager` dentro de `AppRoutes`), `src/app/Layout.tsx` (mostrar el indicador en el encabezado), `src/screens/PlayScreen.tsx` (pedir una sincronización después de guardar), `src/i18n/*.json`
- Test: `src/sync/scheduler.test.ts`, `src/app/PendingSyncBadge.test.tsx`, ampliar `src/screens/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `syncNow`, `syncConfig`, `createSupabaseRemote`, `createCaptchaTokenGetter`.
- Produces:

```ts
// scheduler.ts
export interface SyncScheduler { request(): Promise<SyncReport>; dispose(): void }
export function createSyncScheduler(run: () => Promise<SyncReport>, options?: { baseDelayMs?: number; maxDelayMs?: number }): SyncScheduler;
//   baseDelayMs 1000, maxDelayMs 300000; una ejecución a la vez; las peticiones durante una ejecución se juntan en UNA ejecución siguiente;
//   tras 'offline' o 'error' reintenta solo con espera 1 s, 2 s, 4 s… hasta 5 min; un 'ok' reinicia la espera.
// index.ts
export function getRemote(): RemoteStore | null;           // null si syncConfig es null
export function startSyncService(): () => void;            // crea el planificador, pide una sincronización y escucha 'online' y 'visibilitychange' (visible); devuelve el cierre
export function requestSync(): Promise<SyncReport | null>; // null si la sincronización está desactivada
// PendingSyncBadge: muestra t('sync.pending', { count }) solo si syncConfig existe y hay resultados con synced === 0
```

- [ ] **Step 1: Escribir las pruebas que fallan** (temporizadores falsos):

```ts
test('one run at a time; requests during a run collapse into one follow-up run', async () => {
  let release!: () => void; const run = vi.fn(() => new Promise<SyncReport>((r) => { release = () => r(ok); }));
  const s = createSyncScheduler(run);
  const p1 = s.request(); const p2 = s.request(); const p3 = s.request();
  expect(run).toHaveBeenCalledTimes(1);
  release(); await p1; await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  release(); await Promise.all([p2, p3]); expect(run).toHaveBeenCalledTimes(2);
});
test('offline retries back off 1s, 2s, 4s and cap at 5 minutes; ok resets', async () => { /* run devuelve offline siempre → llamadas a 0, 1000, 3000, 7000 ms…; con muchas fallas la espera nunca supera 300000; tras un ok la siguiente falla vuelve a esperar 1000 */ });
test('dispose cancels pending retries', async () => { /* tras dispose no hay más llamadas */ });
test('PendingSyncBadge is hidden when sync is disabled', async () => { /* syncConfig null (entorno de pruebas) + 2 pendientes → no se muestra */ });
test('PendingSyncBadge shows the count when sync is enabled', async () => { /* vi.mock('../sync/config') con config → 2 pendientes → "2 partidas por sincronizar"; 1 → "1 partida por sincronizar" */ });
test('finishing a game requests a sync', async () => { /* PlayScreen con vi.mock('../sync') → requestSync llamado una vez tras "Terminar" */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/sync/scheduler.test.ts src/app src/screens/PlayScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implementar.** En `index.ts`, el planificador ejecuta `syncNow(getRemote()!, captchaGetter)`. `SyncManager` llama a `startSyncService()` en un efecto y no dibuja nada. Textos: `sync.pending_one` = "{{count}} partida por sincronizar" / "{{count}} game waiting to sync", y `sync.pending_other` = "{{count}} partidas por sincronizar" / "{{count}} games waiting to sync". Un error al pedir la sincronización nunca llega a la interfaz: se registra con `console.warn`.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(sync): single-flight scheduler with backoff, app service and pending badge"`

---

### Task 7: Percentil en la pantalla de resultado

**Files:**
- Create: `src/sync/percentile.ts`, `src/screens/play/PercentileLine.tsx`
- Modify: `src/screens/play/ResultView.tsx`, `src/i18n/*.json`
- Test: `src/sync/percentile.test.ts`, `src/screens/play/PercentileLine.test.tsx`

**Interfaces:**
- Consumes: `RemoteStore`, `listResults`, `requestSync`, `getRemote`.
- Produces:
  - `fetchPercentile(remote: RemoteStore | null, gameId: string, now: Date): Promise<number | null>`. Devuelve `null` si no hay `remote`, si no hay sesión (`currentUserId()` es `null`, porque el percentil nunca crea identidades), si no hay partidas de ese juego en los últimos 30 días, o si la consulta falla. Si no, devuelve `remote.percentile(gameId, mejor marca de los últimos 30 días)`.
  - `PercentileLine({ gameId })`: espera `requestSync()` y luego `fetchPercentile(getRemote(), gameId, new Date())`. Muestra `play.percentile` = "Estás por encima del {{percent}} % de los jugadores" / "You're ahead of {{percent}}% of players", o nada si el resultado es `null`.

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
test('no remote, no session or no recent plays → null', async () => { /* tres casos con createFakeRemote */ });
test('uses the best score of the last 30 days', async () => {
  /* resultados de arrows: 300 hace 40 días, 120 y 200 recientes → remote.percentile llamado con ('arrows', 200) */
});
test('remote failure → null', async () => { /* failNext('network') → null */ });
test('PercentileLine shows the sentence only when there is a number', async () => {
  /* vi.mock('../../sync') con requestSync resuelto y fetchPercentile → 73: aparece "Estás por encima del 73 % de los jugadores";
     con null: no aparece texto */
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/sync/percentile.test.ts src/screens/play`. Expected: FAIL.

- [ ] **Step 3: Implementar** y montar `<PercentileLine gameId={game.id} />` en `ResultView`, debajo del puntaje.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: show the player's percentile on the result screen"`

---

### Task 8: Privacidad y "Borrar mis datos" en el servidor

**Files:**
- Create: `src/sync/deleteData.ts`
- Modify: `src/screens/SettingsScreen.tsx`, `src/i18n/*.json`
- Test: `src/sync/deleteData.test.ts`, ampliar `src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `RemoteStore`, `getRemote`, `syncConfig`, `clearAllData`.
- Produces: `deleteEverything(remote: RemoteStore | null): Promise<'ok' | 'remote-failed'>`.
  - Si hay `remote` y hay sesión: llama a `deleteMyData()` y luego a `signOut()`. Si algo de eso falla, devuelve `'remote-failed'` **sin borrar nada local**.
  - Si no, o si todo salió bien: llama a `clearAllData()` y devuelve `'ok'`.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `deleteEverything(null)` borra todo lo local.
  - Con fake remote y sesión: borra en el servidor (`users.get(id).results.size === 0`), cierra sesión y borra lo local.
  - Con `failNext('network')`: devuelve `'remote-failed'` y los resultados locales siguen ahí. *(Review Focus #5)*
  - En Ajustes, con `vi.mock('../sync')` haciendo que `deleteEverything` devuelva `'remote-failed'`: aparece "No pudimos borrar tus datos del servidor. Revisa tu conexión e inténtalo de nuevo." y no aparece el mensaje de borrado exitoso.
  - Nota de privacidad con la sincronización activada (`vi.mock('../sync/config')`): ES "Tu progreso se guarda en este dispositivo. Para compararte con otros jugadores, tus puntajes también se envían de forma anónima, sin nombre ni correo, a nuestro servidor. Light no usa publicidad ni analítica."; EN "Your progress is stored on this device. To compare you with other players, your scores are also sent anonymously, with no name or email, to our server. Light uses no ads or analytics.". Sin sincronización se mantiene la nota del Plan 1.

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run src/sync/deleteData.test.ts src/screens/SettingsScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implementar.** Claves nuevas `settings.privacySync` y `settings.deleteRemoteError`. `SettingsScreen` usa `deleteEverything(getRemote())`.

- [ ] **Step 4: Verificar.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: honest privacy note and server-side delete for guests"`

---

### Task 9: Pruebas de integración contra el Supabase local y CI

**Files:**
- Create: `vitest.integration.config.ts`, `tests/integration/globalSetup.ts`, `tests/integration/helpers.ts`, `tests/integration/sync.int.test.ts`
- Modify: `package.json` (script `test:integration`), `tsconfig.json` (o un `tsconfig.integration.json` si se prefiere separar), `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `createSupabaseRemote`, `syncNow`, `fetchPercentile`, `GAMES`, `addResult`, `clearAllData`.
- Produces:
  - `npm run test:integration` = `vitest run --config vitest.integration.config.ts`. Usa `environment: 'node'`, `setupFiles: ['fake-indexeddb/auto']`, `include: ['tests/integration/**/*.int.test.ts']`, `fileParallelism: false` y `globalSetup`.
  - `globalSetup`: ejecuta `npx supabase status -o json`, toma el JSON desde el primer `{` y define `LIGHT_SB_URL`, `LIGHT_SB_PUBLISHABLE_KEY` y `LIGHT_SB_SERVICE_KEY` (a partir de `API_URL`, `PUBLISHABLE_KEY` y `SERVICE_ROLE_KEY`). Si falla, termina con el mensaje "Supabase local no está corriendo: ejecuta npm run db:start".
  - `helpers.ts`: `newGuestRemote()` crea un `RemoteStore` con almacenamiento en memoria; `adminClient()` crea un cliente supabase-js con la clave de servicio local.

- [ ] **Step 1: Escribir las pruebas de integración que fallan:**
  - **La tabla `games` coincide con `GAMES`**: id, área y `max_score === maxScore`.
  - **`syncNow` sube 3 resultados y no duplica**: `adminClient` cuenta 3 filas de ese usuario, también después de una segunda ejecución.
  - **Una fila con `score = 99999` se rechaza** (`synced` 2) y las demás se suben. *(Review Focus #3)*
  - **Un invitado no ve los resultados de otro**: `select` con su sesión devuelve solo los suyos.
  - **Percentil:**
    - Con menos de 20 otros jugadores, `fetchPercentile` es `null`.
    - Se crean 20 invitados más, cada uno con una partida de `quick-math` de puntaje 10, 20, …, 200. Con una mejor marca local de 105, el resultado es 50.
  - **Identidad perdida** *(Review Focus #2)*:
    1. Se borra el usuario con `adminClient().auth.admin.deleteUser(id)`.
    2. Se agrega un resultado local.
    3. `syncNow` crea un usuario nuevo y ese usuario tiene todos los resultados locales.
  - **Días completados**: un día completo aparece en `daily_completions`.

  Cada prueba empieza con `clearAllData()`.

- [ ] **Step 2: Verificar que fallan** con Supabase corriendo (`npm run db:reset`). Run: `npm run test:integration`. Expected: FAIL solo si algo de las Tasks 1–8 no se comporta como dicen. Si todas pasan a la primera, revisar que cada prueba compruebe filas reales en el servidor y no el estado local. Para verificar la prueba de rechazo, se puede quitar temporalmente el trigger y comprobar que esa prueba falla; después se restaura.

- [ ] **Step 3: Corregir** lo que encuentren las pruebas, cada corrección con su prueba unitaria si aplica.

- [ ] **Step 4: CI.** Agregar a `ci.yml` un job `supabase`:
  1. Checkout, Node 24 y `npm ci`.
  2. `npm run db:start` (sin la variable de registro).
  3. `npm run db:test`.
  4. `npm run test:integration`.

  `vitest.config` del Plan 1 sigue excluyendo `tests/`.

- [ ] **Step 5: Verificar.** Run: `npm run db:test && npm run test:integration && npm test`. Expected: todo pasa.

- [ ] **Step 6: Commit.** `git commit -m "test: integration tests against local Supabase and CI job"`

---

### Task 10: Publicación, keep-alive, guía de configuración y especificación

**Files:**
- Create: `.github/workflows/keep-alive.yml`, `SETUP.md`
- Modify: `.github/workflows/deploy.yml`, `README.md`, `docs/superpowers/specs/2026-10-18-light-brain-training-design.md`

- [ ] **Step 1: `deploy.yml`.** En el paso `npm run build`, definir `env`: `VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}`, `VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.SUPABASE_PUBLISHABLE_KEY }}` y `VITE_TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY }}`. Sin las variables, el build sale sin sincronización, igual que hoy.

- [ ] **Step 2: `keep-alive.yml`.**
  - Se dispara con `schedule: cron '17 6 */3 * *'` y con `workflow_dispatch`.
  - Un job con `if: vars.SUPABASE_URL != ''` que ejecuta `curl -fsS "$SUPABASE_URL/rest/v1/games?select=id&limit=1" -H "apikey: $KEY"`, con `SUPABASE_URL` y `KEY` tomados de `vars`.

  Validar la sintaxis de ambos con `npx --yes js-yaml@4.1.0 <archivo>`.

- [ ] **Step 3: `SETUP.md`** (en español, parte "Invitados"). Pasos numerados:
  1. Crear el proyecto en tu cuenta personal de Supabase y anotar la URL y la *publishable key*.
  2. Aplicar las 3 migraciones de `supabase/migrations`, en orden, pegándolas en el SQL Editor o con el conector o la CLI.
  3. Verificar en **Database → Extensions** que `pg_cron` quedó activa. Si el plan gratuito no la permitiera, se cambia a una limpieza desde GitHub; anotarlo.
  4. **Authentication → Sign In / Providers:** activar *Anonymous sign-ins*.
  5. **Cloudflare Turnstile:** crear un sitio gratuito en modo *Invisible* para `accounting-mykap.github.io`. Copiar la *site key* y la *secret key*. En Supabase, **Authentication → Bot and Abuse Protection**, activar CAPTCHA con Turnstile y pegar la *secret key*.
  6. En GitHub, **Settings → Secrets and variables → Actions → Variables**, crear `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `TURNSTILE_SITE_KEY`.
  7. Volver a publicar (**Actions → Deploy to GitHub Pages → Run workflow**) y comprobar el resultado:
     1. Jugar una partida.
     2. En Supabase, **Table editor → results**, debe aparecer una fila.
     3. Ejecutar **Actions → Keep Supabase awake → Run workflow** y verificar que termine en verde.

  Al final, la sección "Qué NO hacer": nunca pegar la clave de servicio en GitHub ni en la app.

- [ ] **Step 4: README y especificación.**
  - README: enlace a `SETUP.md` y la sección de pruebas de integración.
  - En la spec:
    - §5.2: `duration_ms between 5000 and 3600000`, con el motivo.
    - §5.1: el estado `synced` 0/1/2 y la tabla `meta`.
    - §9: indicar que `SETUP.md` tiene la parte de invitados (Plan 2) y que el Plan 3 agrega cuentas.
    - §10 #4: resultado de la verificación de pg_cron en local (disponible, 1.6.4); falta confirmar en el proyecto real (SETUP paso 3).

- [ ] **Step 5: Verificación final.** Run: `npm run lint && npm run typecheck && npm test && npm run build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e && npm run db:test && npm run test:integration`. Expected: todo pasa. El build sin variables no contiene `supabase.co`: `grep -r "supabase.co" dist` no encuentra nada.

- [ ] **Step 6: Commit.** `git commit -m "ci: keep-alive workflow, Supabase build variables and SETUP guide"`

---

## Después de este plan

- **Con el dueño del proyecto:** seguir `SETUP.md`. Lo único que debe hacer en persona es crear el proyecto y las claves; las migraciones las puede aplicar Claude si se conecta el conector de Supabase de la cuenta personal.
- **Plan 3 (cuentas):** usuario, contraseña y código de recuperación; Google; fusión de invitado; descarga del historial al iniciar sesión; borrado completo de la identidad con una Edge Function.
