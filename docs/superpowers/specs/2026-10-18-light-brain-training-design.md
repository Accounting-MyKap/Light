# Light — App web gratuita de entrenamiento mental

**Fecha:** 2026-10-18
**Estado:** Diseño aprobado por secciones; pendiente revisión del documento completo
**Nombre:** "Light" es provisional (igual que el repositorio)

---

## 1. Propósito y criterios de éxito

Una app web gratuita, para cualquier persona, con ejercicios interactivos cortos para
ejercitar distintas habilidades mentales, al estilo de las apps de entrenamiento mental.
Se usa desde el navegador en celular, tablet o computador, y se puede instalar como app.

**Decisiones del usuario (resumen):**

| Tema | Decisión |
|---|---|
| Público | Cualquiera, gratis, sin barreras de entrada |
| Plataforma | Web instalable (PWA), publicada en GitHub Pages |
| Progreso | Primero en el dispositivo; sincronización opcional con Supabase (cuenta personal del dueño) |
| Cuentas | Opcionales: usuario + contraseña + código de recuperación, o Google |
| Comparaciones | Percentil frente a otros jugadores activos, solo si hay suficientes |
| Idiomas | Español e inglés desde el lanzamiento |
| Experiencia | Entrenamiento diario de 3 juegos + juego libre + racha |
| Juegos v1 | Memoria, atención, velocidad, flexibilidad mental, matemáticas (uno por área) |
| Juegos v2 | Lógica y lenguaje |

**Criterios de éxito de la v1:**

1. Cualquier persona abre la URL y empieza el entrenamiento del día sin registrarse.
2. Tras la primera carga, la app funciona completa sin internet.
3. Todos los textos existen en español e inglés.
4. Con cuenta, el progreso se ve igual en dos dispositivos distintos.
5. El percentil solo aparece cuando hay al menos 20 jugadores activos (sin contarte a ti)
   en ese juego.
6. Costo mensual: USD 0 (GitHub Pages + plan gratuito de Supabase + Turnstile gratuito).
7. Agregar un juego nuevo = una carpeta nueva + una línea en el registro de juegos + una
   fila en la tabla `games` (migración SQL). No se modifican otros juegos.

## 2. Experiencia del usuario

### 2.1 Pantallas

1. **Hoy (inicio):** el entrenamiento del día (3 juegos), la racha arriba y, al terminar,
   un resumen del día.
2. **Juegos:** catálogo de juegos agrupados por área; cualquiera se juega libremente.
3. **Partida:** instrucciones cortas con demostración la primera vez → partida
   (~1 minuto) → resultado: puntaje, mejor marca y, si aplica, "Estás por encima del X %
   de los jugadores".
4. **Progreso:** puntaje por área (0–1000), gráfico de evolución por juego, mejores marcas,
   racha y total de días entrenados.
5. **Ajustes:** idioma, sonido, tema (claro/oscuro, automático por defecto), cuenta (crear,
   iniciar sesión, cerrar sesión, borrar todos mis datos) y nota de privacidad.

### 2.2 Reglas de producto

- **Entrenamiento diario:** 3 juegos de áreas distintas. Prioriza las áreas menos jugadas en
  los últimos 7 días y evita repetir los juegos del plan de ayer cuando sea posible. El plan
  se genera la primera vez que se abre la app ese día y queda guardado (recargar no lo cambia).
- **Racha:** cuenta días seguidos con el entrenamiento diario completo, según la fecha local
  del dispositivo. El día actual sin completar no rompe la racha hasta que termina.
- **Dificultad adaptativa entre partidas:** cada juego guarda un nivel inicial por jugador
  (1–10). Precisión ≥ 85 % → sube 1; < 60 % → baja 1; en otro caso se mantiene. Cada juego
  además ajusta la dificultad dentro de la partida (ver §4).
- **Textos honestos:** la app no promete beneficios médicos ni cognitivos ("mejora tu
  memoria", "previene el Alzheimer", etc.). Se presenta como "juegos para ejercitar tu
  mente". (Antecedente: la FTC multó a Lumosity en 2016 por publicidad engañosa.)
- **Sin publicidad ni analítica de terceros** en la v1.

## 3. Arquitectura

### 3.1 Tecnología

- **Front-end:** React + TypeScript + Vite.
- **PWA:** instalable, con caché del código de la app para funcionar sin conexión y aviso de
  "Nueva versión disponible".
- **Almacenamiento local:** IndexedDB (mediante una librería ligera como Dexie).
- **Traducciones:** i18next; archivos `es.json` y `en.json`. Idioma inicial según el
  navegador (`es*` → español; cualquier otro → inglés), cambiable en Ajustes.
- **Back-end:** Supabase (Auth, Postgres con RLS, Edge Functions) en la cuenta personal del
  dueño. **No** se usa la organización de trabajo conectada a esta sesión.
- **Anti-bots:** Cloudflare Turnstile para la creación de identidades anónimas.
- **Publicación:** GitHub Pages vía GitHub Actions (el repo es público).

### 3.2 Estructura del repositorio

```
src/
  app/            # shell, rutas, layout, manejo de errores por pantalla
  screens/        # Hoy, Juegos, Partida, Progreso, Ajustes
  games/
    registry.ts   # lista de juegos registrados
    types.ts      # contrato común de juego
    sequence-lights/   # engine.ts, engine.test.ts, Game.tsx
    arrows/
    same-different/
    rule-switch/
    quick-math/
  core/           # dificultad adaptativa, plan diario, racha, puntaje por área
  data/           # base local, cola de sincronización, cliente Supabase, cuentas
  i18n/           # es.json, en.json
supabase/
  migrations/     # SQL: tablas, RLS, funciones, trabajos programados
  functions/      # Edge Functions (ver §5.4)
  tests/          # pruebas SQL (pgTAP)
e2e/              # pruebas Playwright
.github/workflows/ # CI, publicación, keep-alive
SETUP.md          # guía paso a paso de configuración
```

### 3.3 Contrato de juego

Cada juego es un módulo independiente con dos partes:

- **Motor (`engine.ts`):** lógica pura sin interfaz: genera los retos, evalúa respuestas,
  ajusta la dificultad dentro de la partida y calcula el puntaje. Se prueba sin navegador.
- **Pantalla (`Game.tsx`):** dibuja el juego y traduce toques/teclas en acciones del motor.

Interfaz común (TypeScript, orientativa):

```ts
type Area = 'memory' | 'attention' | 'speed' | 'flexibility' | 'math' | 'logic' | 'language';

interface GameDefinition {
  id: string;                 // p. ej. 'arrows'
  area: Area;
  titleKey: string;           // clave i18n
  instructionsKey: string;    // clave i18n
  maxLevel: 10;
  referenceScore: number;     // puntaje que equivale a 1000 en el puntaje por área
  Component: React.ComponentType<GameProps>;
}

interface GameProps {
  startLevel: number;         // 1..10
  onFinish(result: GameResult): void;
  onAbandon(): void;
}

interface GameResult {
  score: number;              // entero ≥ 0
  accuracy: number;           // 0..1
  levelReached: number;       // 1..10
  durationMs: number;
}
```

Si la pestaña se oculta (llamada, cambio de app), el juego se pausa. Una partida abandonada
no se registra.

### 3.4 Flujo de una partida

```
Partida termina
  → resultado guardado en IndexedDB (con id UUID generado en el dispositivo, synced=false)
  → se actualizan nivel inicial, racha, plan diario y puntaje por área (todo local)
  → la cola de sincronización lo sube a Supabase en segundo plano
  → se pide el percentil; si no hay conexión o no hay suficientes jugadores, no se muestra
```

## 4. Juegos de la v1

Todos los parámetros numéricos son **valores iniciales de ajuste**; se pueden afinar sin
cambiar el diseño. Duración objetivo: 60 segundos en los juegos con reloj (2–5) y 1–2
minutos en "Secuencia de luces", que va por rondas.

| # | Juego (id) | Área | Mecánica | Qué controla el nivel (1–10) | Puntaje |
|---|---|---|---|---|---|
| 1 | Secuencia de luces (`sequence-lights`) | Memoria | Se iluminan casillas de una cuadrícula en orden; el jugador las repite. 8 rondas. Acierto → la secuencia crece 1; error → baja 1 (mín. 3). | Largo de secuencia = nivel + 2 (3–12). Cuadrícula 3×3 (largo 3–5), 4×4 (6–8), 5×5 (9–12). | Σ (largo × 10) de las rondas acertadas |
| 2 | Flechas (`arrows`) | Atención | Fila de 5 flechas; se responde la dirección de la central (botones izquierda/derecha, flechas del teclado). 60 s. | Proporción de flechas incongruentes (30 %→70 %) y ventana de respuesta (2000→700 ms). | Por acierto: 10 + bonus de rapidez de 0 a 10 |
| 3 | ¿Igual o distinto? (`same-different`) | Velocidad | Aparecen símbolos uno tras otro; se responde si el actual es igual al anterior. 60 s. | Parecido entre símbolos del conjunto y tiempo máximo por símbolo (3000→1000 ms; si se agota, cuenta como error). | 10 por acierto × multiplicador de racha (×1; ×2 desde 5 seguidos; ×3 desde 10) |
| 4 | Cambio de regla (`rule-switch`) | Flexibilidad | Una carta (forma + color) se empareja con una de dos cartas objetivo, según la regla visible arriba: COLOR o FORMA. 60 s. | Cada cuántos ensayos cambia la regla (6→2, con variación aleatoria) y ventana de respuesta. | Por acierto: 10 + bonus de rapidez; +5 extra si el acierto ocurre justo tras un cambio de regla |
| 5 | Cálculo relámpago (`quick-math`) | Matemáticas | Operaciones contra el reloj, respuesta con teclado numérico en pantalla + OK; se puede saltar. 60 s. | Operaciones y rangos: sumas de 1 cifra (1) → restas → tablas de multiplicar → 2 cifras → operaciones mixtas (10). | Por acierto: 10 + nivel actual |

**Dificultad dentro de la partida** (juegos 2–5): tras 4 aciertos seguidos sube un nivel;
tras 2 errores seguidos baja uno. `levelReached` es el nivel máximo alcanzado.

**Accesibilidad en "Cambio de regla":** cada color tiene además un relleno o patrón propio
(sólido, rayas, puntos), así que el color nunca es la única pista.

**Puntaje por área (0–1000):** para cada juego, `min(1000, round(1000 × mejor puntaje de los
últimos 30 días / referenceScore))`. El puntaje del área es el promedio de los juegos jugados
de esa área (en la v1 hay un juego por área).

## 5. Datos y Supabase

### 5.1 Base local (IndexedDB)

| Almacén | Contenido |
|---|---|
| `results` | Todas las partidas del dispositivo/cuenta, con `synced: boolean` |
| `dailyPlans` | Plan de cada día (fecha local → 3 ids de juego, estado de cada uno) |
| `gameLevels` | Nivel inicial por juego |
| `settings` | Idioma, sonido, tema, juegos cuyas instrucciones ya se vieron |

La base local es la fuente principal. La sesión de Supabase la guarda la librería
`supabase-js` en `localStorage`.

### 5.2 Esquema en Supabase (Postgres)

```sql
create table public.games (
  id        text primary key,
  area      text not null check (area in
              ('memory','attention','speed','flexibility','math','logic','language')),
  max_score integer not null check (max_score > 0)  -- cota teórica; se rechaza lo que la supere
);

create table public.results (
  id          uuid primary key,                       -- generado en el dispositivo
  user_id     uuid not null default auth.uid()
              references auth.users on delete cascade,
  game_id     text not null references public.games,
  level       smallint not null check (level between 1 and 10),
  score       integer not null check (score >= 0),
  accuracy    real not null check (accuracy between 0 and 1),
  duration_ms integer not null check (duration_ms between 5000 and 600000),
  is_daily    boolean not null default false,
  played_at   timestamptz not null,
  created_at  timestamptz not null default now()
);
create index on public.results (game_id, played_at);
create index on public.results (user_id, played_at);
-- Trigger de validación: score <= games.max_score y played_at <= now() + 5 minutos.

create table public.daily_completions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day     date not null,          -- fecha local del dispositivo
  games   text[] not null,
  primary key (user_id, day)
);

create table public.usernames (  -- solo accesible desde Edge Functions (service role)
  user_id         uuid primary key references auth.users on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  recovery_hash   text not null,
  failed_attempts smallint not null default 0,
  locked_until    timestamptz
);
```

**Políticas RLS:**

- `games`: lectura para todos; sin escritura desde el cliente.
- `results` y `daily_completions`: cada usuario autenticado (anónimo o permanente) puede
  `select`, `insert` y `delete` solo sus propias filas (`user_id = auth.uid()`). No hay
  `update`: los resultados son inmutables. La subida usa `upsert` con
  `ignoreDuplicates: true`, así que reenviar un resultado no lo duplica.
- `usernames`: RLS activado y **ninguna** política para clientes; solo la usan las Edge
  Functions con la clave de servicio.

### 5.3 Percentil

```sql
-- Devuelve 0..100, o null si hay menos de 20 jugadores activos (sin contar a quien consulta).
create function public.get_percentile(p_game_id text, p_best_score integer)
returns integer
language sql stable security definer set search_path = '' as $$
  with others as (
    select user_id, max(score) as best
    from public.results
    where game_id = p_game_id
      and played_at >= now() - interval '30 days'
      and user_id <> auth.uid()
    group by user_id
  )
  select case when count(*) < 20 then null
              else floor(100.0 * count(*) filter (where best < p_best_score) / count(*))::int
         end
  from others;
$$;
```

- **Jugador activo:** jugó ese juego en los últimos 30 días.
- **Se compara** la mejor marca propia de los últimos 30 días (calculada en el dispositivo, así
  que funciona aunque la última partida aún no se haya subido) contra la mejor marca de cada
  otro jugador activo.
- El umbral de 20 es un parámetro ajustable.
- Solo se devuelve un número; nadie ve puntajes ajenos.

### 5.4 Cuentas e identidades

**Invitado (por defecto):** al subir el primer resultado, la app crea una identidad anónima
(`signInAnonymously`, con token de Turnstile). Abrir la página no crea identidades.

**Cuenta con usuario:**

- Usuario: 3–20 caracteres `a-z`, `0-9`, `_`; se guarda en minúsculas y es único.
- Contraseña: mínimo 8 caracteres.
- Código de recuperación: 12 caracteres de un alfabeto sin caracteres ambiguos (sin 0/O/1/I),
  con formato `XXXX-XXXX-XXXX`. Se muestra una sola vez y se guarda solo su hash.
- Internamente, la cuenta usa un correo sintético `<usuario>@<dominio ficticio>` que nunca
  recibe mensajes. La cuenta se crea con el correo ya marcado como confirmado, así que
  **Supabase no envía ningún correo**.

**Cuenta con Google:** `linkIdentity({ provider: 'google' })` sobre la identidad anónima
(requiere activar "manual linking"). Si esa cuenta de Google ya existe, se inicia sesión con
ella y se aplica la fusión de invitado.

**Edge Functions:**

| Función | Quién la llama | Qué hace |
|---|---|---|
| `create-account` | Invitado (JWT anónimo) | Valida usuario y contraseña, convierte la identidad anónima en permanente (mismo id), crea la fila en `usernames` y devuelve el código de recuperación |
| `login` | Cualquiera | Revisa el bloqueo del usuario, inicia sesión con el correo sintético y devuelve la sesión. 5 fallos → bloqueo de 15 minutos |
| `reset-password` | Cualquiera | Usuario + código de recuperación + contraseña nueva. Mismo bloqueo. Si funciona, genera y devuelve un código nuevo |
| `merge-guest` | Usuario recién autenticado | Recibe el token de la identidad anónima anterior (refrescado justo antes de iniciar sesión), verifica que sea anónima, mueve sus `results` y `daily_completions` a la cuenta y borra la identidad anónima |
| `delete-account` | Cualquier usuario | Borra la identidad (en cascada borra resultados, rachas y `usernames`). Después la app borra los datos locales |

**Fusión de invitado:** si en un dispositivo se jugó como invitado y luego se inicia sesión en
una cuenta existente, `merge-guest` junta los datos. Como cada resultado tiene un id único,
no hay duplicados ni conflictos.

### 5.5 Sincronización

- La cola sube los resultados con `synced=false` cuando hay conexión: al terminar una
  partida, al recuperar la conexión y al abrir la app. Reintenta con espera creciente.
- Al iniciar sesión en un dispositivo, se descarga el historial de la cuenta y se une con el
  local (unión por id).
- Si la identidad anónima ya no existe en el servidor (por ejemplo, la borró la limpieza
  automática), la app crea una nueva identidad anónima y vuelve a subir los resultados locales.

### 5.6 Mantenimiento y costos

- **Keep-alive:** un workflow programado de GitHub Actions consulta Supabase cada 3 días
  (lectura mínima de `games`) para evitar la pausa del plan gratuito, que ocurre tras 1 semana
  sin actividad. Nota: GitHub desactiva los workflows programados en repos públicos tras 60
  días sin actividad en el repo; con jugadores reales, su propia actividad mantiene el proyecto
  despierto.
- **Limpieza:** un trabajo programado en Postgres (pg_cron) borra cada semana las identidades
  anónimas creadas hace más de 90 días que no tienen resultados en los últimos 90 días (y sus
  datos, en cascada). Si el dispositivo de ese invitado vuelve, se aplica la recuperación
  descrita en §5.5.
- **Límites del plan gratuito:** 50 000 usuarios activos al mes, 500 MB de base de datos
  (~2 millones de partidas) y 2 proyectos activos por cuenta.
- **Claves:** la clave pública (publishable) va en la app; la clave de servicio solo existe
  en las Edge Functions.

## 6. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Sin internet | App completa; indicador discreto "N partidas por sincronizar" |
| Supabase pausado o caído | Igual que sin internet; sin percentiles; crear cuenta o iniciar sesión muestra "no disponible ahora, intenta más tarde" |
| Datos del navegador borrados | Con cuenta: se recupera todo al iniciar sesión. Sin cuenta: se pierde; Ajustes sugiere crear cuenta a los invitados |
| Partida interrumpida | Pausa automática; si se abandona, no se registra |
| Error inesperado en una pantalla | Límite de error por pantalla: "Algo salió mal" + volver al inicio |
| Nueva versión publicada | Aviso "Nueva versión disponible" para recargar |
| Puntaje fuera de rango | El servidor lo rechaza; la app lo conserva localmente y deja de reintentar ese resultado |

## 7. Accesibilidad

- Zonas táctiles de al menos 44×44 px; uso completo con teclado en computador.
- El color nunca es la única pista (ver "Cambio de regla").
- Contraste de texto WCAG AA; respeta `prefers-reduced-motion`.
- El sonido es opcional y ningún juego depende de él.
- Menús y pantallas no lúdicas compatibles con lector de pantalla. Limitación conocida: los
  juegos son visuales y contra el reloj, así que no son jugables para personas ciegas.

## 8. Pruebas y CI

- **Unitarias (Vitest):** motor de cada juego (generación, evaluación, puntaje, dificultad
  dentro de la partida), dificultad entre partidas, plan diario, racha, puntaje por área,
  cola de sincronización y unión de historiales.
- **Componentes (React Testing Library):** pantallas principales.
- **Base de datos (pgTAP con `supabase test db`):** RLS (nadie lee ni escribe datos ajenos),
  validaciones de `results` y `get_percentile` (umbral de 20, exclusión de inactivos y de
  quien consulta).
- **Edge Functions (Deno test):** validaciones, bloqueo por intentos y fusión de invitado.
- **De punta a punta (Playwright, Chromium):** entrenamiento diario completo, juego sin
  conexión, creación de cuenta con usuario.
- **CI (GitHub Actions):** en cada push o PR se ejecutan lint, verificación de tipos y todas
  las pruebas. Al fusionar a `main`: compilación y publicación en GitHub Pages.

## 9. Configuración (contenido de `SETUP.md`)

1. Crear un proyecto nuevo en la cuenta personal de Supabase del dueño.
2. Aplicar las migraciones de `supabase/migrations`, pegándolas en el editor SQL o mediante
   el conector o la CLI.
3. Activar "Anonymous sign-ins" y "Manual linking".
4. Configurar Turnstile: clave del sitio en la app y clave secreta en Supabase Auth.
5. Configurar Google OAuth: credenciales gratuitas en Google Cloud, cargadas en Supabase.
6. Publicar las Edge Functions.
7. En GitHub: activar Pages (origen: GitHub Actions) y crear las variables del repositorio
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `TURNSTILE_SITE_KEY`.

## 10. Puntos a verificar al inicio de la implementación

Son detalles de la plataforma que no se pudieron confirmar durante el diseño. Si alguno
falla, se aplica la alternativa indicada sin cambiar lo que ve el usuario.

| # | Verificar | Alternativa |
|---|---|---|
| 1 | Que `auth.admin.updateUserById` sobre un usuario anónimo, con correo, contraseña y `email_confirm: true`, lo deje como permanente (`is_anonymous = false`) | `create-account` crea un usuario nuevo con la API de administración y mueve los datos como en `merge-guest` |
| 2 | Qué dominio ficticio acepta Supabase Auth para el correo sintético | Usar un subdominio controlado sin buzón |
| 3 | Si desactivar los registros públicos por correo afecta las sesiones anónimas | Dejar los registros activos; sin servicio de correo propio, Supabase no envía mensajes a terceros |
| 4 | Que pg_cron esté disponible en el plan gratuito | Hacer la limpieza desde el workflow programado de GitHub |

## 11. Orden de construcción sugerido

Cada etapa deja algo que funciona y se puede probar:

1. **Base:** app React + TypeScript, rutas, traducciones ES/EN, PWA, base local y un juego
   completo de punta a punta ("Secuencia de luces").
2. **Juegos restantes:** Flechas, ¿Igual o distinto?, Cambio de regla y Cálculo relámpago.
3. **Experiencia diaria:** plan diario, racha, dificultad entre partidas y pantalla de
   Progreso. Al terminar esta etapa, la app ya es útil sin servidor.
4. **Supabase (invitados):** esquema, RLS, identidades anónimas con Turnstile,
   sincronización y percentil.
5. **Cuentas:** usuario + contraseña + código, Google, fusión de invitado y borrar mis datos.
6. **Operación:** CI/CD a GitHub Pages, keep-alive, limpieza programada y `SETUP.md`.

## 12. Fuera de la v1

- Juegos de lógica y lenguaje (v2).
- Tablas de líderes y nombres públicos.
- Comparación por edad u otros datos demográficos.
- Recordatorios y notificaciones.
- Inicio de sesión por correo.
- Vincular Google a una cuenta de usuario existente (y viceversa).
- Apps nativas en las tiendas.
- Dominio propio.
