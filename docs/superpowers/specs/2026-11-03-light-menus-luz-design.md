# Light: menús con Luz de día y de noche

Fecha: 2026-11-03 · Estado: diseño aprobado por partes en la conversación. El dueño pidió escribirlo, planearlo e implementarlo de una vez («me dormiré pero quiero que termines para ver los cambios mañana»).

Maqueta de referencia (privada, del dueño): https://claude.ai/artifact/FCS1v5YiQbwLb5UGjmnLZt — versión 1: las tres direcciones (A, B, C); versión 2: la dirección B elegida, con Juegos, Hoy, Progreso y Ajustes en modo claro y oscuro. Antecedente: el estilo Luz de los juegos (`docs/superpowers/specs/2026-11-02-light-estilo-luz-design.md`).

## 1. Propósito

Los juegos ya tienen el estilo Luz, pero los menús (Hoy, Juegos, Progreso, Ajustes) siguen siendo listas de texto en tarjetas grises: sin color por juego, sin íconos ni miniaturas; entrar a un juego se siente como cambiar de app. El dueño pidió mejorar sus visuales, eligió la dirección **B — Luz de día y de noche** y pidió que el catálogo se clasifique **como en Lumosity** (filtros por categoría, «Tus juegos de hoy», secciones por categoría con miniaturas).

**Éxito:** los menús se reconocen como parte de la misma app que los juegos, en modo claro y oscuro; cada juego se identifica por su miniatura y su color; el catálogo se recorre por categorías; el dueño aprueba las capturas de las cuatro pantallas en ambos modos. El funcionamiento (entrenamiento diario, racha, progreso, sincronización, ajustes) no cambia.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Dirección | **B**: los menús siguen el tema elegido (Automático / Claro / Oscuro). Oscuro = «Luz de noche» (como los juegos); claro = «Luz de día». Los juegos siguen siempre de noche. |
| Catálogo | Como Lumosity: filtros por categoría, «Tus juegos de hoy», secciones por categoría con miniatura, nombre y habilidad. |
| Miniaturas | Ilustración fija por juego (SVG en la app), una pequeña escena nocturna del juego en su color; igual en ambos modos. |
| Letra | Sora en toda la app (ya va empaquetada para uso sin conexión). |

## 3. Base visual

### 3.1 Colores

Los tokens de la app en `src/app/theme.css` se reemplazan por estas paletas (se mantienen los nombres existentes que usa el resto del código y se agregan los nuevos). El bloque claro aplica a `:root`, `[data-theme='light']`; el oscuro a `[data-theme='dark']` y a la preferencia del sistema oscura sin `data-theme`, como hoy.

| Token | Luz de día (claro) | Luz de noche (oscuro) |
|---|---|---|
| `--bg` (fondo) | `#f6f7fc` | `#090b19` |
| `--surface` (tarjeta) | `#ffffff` | `#141729` |
| `--text` | `#171a2e` | `#eef1ff` |
| `--text-muted` | `#5c6079` | `#b4b9d8` |
| `--accent` (marca, ámbar) | `#f5a000` | `#ffb52e` |
| `--accent-text` (texto sobre ámbar) | `#0b0d1a` | `#0b0d1a` |
| `--accent-strong` (texto ámbar) | `#8f5400` | `#ffb52e` |
| `--success` / `--success-strong` | `#12a160` | `#4dffa6` |
| `--danger` | `#c62f4e` | `#ff5d7a` |
| `--border` | `rgba(23,26,46,.09)` | `rgba(255,255,255,.1)` |
| `--area-memory` | `#a35f00` | `#ffb52e` |
| `--area-attention` | `#00789f` | `#3fd4ff` |
| `--area-speed` | `#b0287f` | `#ff5fd2` |
| `--area-flexibility` | `#6247d1` | `#a98bff` |
| `--area-math` | `#2a7f1a` | `#8dff6a` |

- **Fondo:** sobre `--bg`, un resplandor suave arriba: ámbar a la izquierda y cian a la derecha (≈14–18 % de opacidad, hasta el 40 % de la altura), en ambos modos.
- **Tarjetas:** de día, blancas con sombra leve y borde casi invisible; de noche, «cristal» (`rgba(255,255,255,.045)` con borde interior `rgba(255,255,255,.09)`) — `--surface` es el sólido equivalente para lo que necesite fondo opaco.
- **Contraste (prueba automática):** `--text` y `--text-muted` sobre `--bg` y `--surface` ≥ 4,5:1; cada `--area-*` y `--accent-strong` sobre `--bg` y `--surface` ≥ 4,5:1 (se usan como texto); `--accent-text` sobre `--accent` ≥ 4,5:1. Los valores de la tabla ya cumplen (verificado); la prueba los fija.
- Los juegos (dentro de `[data-luz]`) no cambian: su ámbito ya fija sus propios tokens.

### 3.2 Letra

Sora (`'Sora Variable'`, con la cadena de respaldo del sistema) pasa a toda la app; la importación de la letra se mueve a la hoja global para que cargue una sola vez.

### 3.3 Encabezado y barra inferior

- Se quita el encabezado fijo («Light · Ilumina tu cerebro») de todas las pantallas. Hoy muestra su propia fila superior (§5.1); las demás pantallas abren con su título grande.
- El aviso de sincronización pendiente (`PendingSyncBadge`) pasa a Hoy (§5.1).
- La barra inferior muestra ícono y nombre para Hoy, Juegos, Progreso y Ajustes (íconos SVG en línea: sol, cuadrícula, barras, controles). La pestaña activa usa `--accent-strong` y, de noche, un leve brillo. Fondo: de día blanco con línea superior; de noche cristal oscuro. Objetivos táctiles ≥ 44 px.

## 4. Catálogo de Juegos

### 4.1 Categorías y orden

Orden de categorías, como Lumosity: **Velocidad, Memoria, Atención, Flexibilidad, Lógica, Matemáticas, Lenguaje** (`speed, memory, attention, flexibility, logic, math, language`). Solo se muestran las categorías que tienen juegos; hoy son cinco (Lógica y Lenguaje aparecerán solas cuando tengan juegos).

### 4.2 Pantalla

1. Título «Juegos».
2. **Filtros:** «Todo» y una píldora por categoría con juegos, en el orden de §4.1, en una fila que se desliza de lado. La elegida va rellena. Elegir una muestra solo esa categoría; el filtro se guarda en la dirección (`/games?area=memory`), así que al volver de un juego sigue elegido; un valor desconocido equivale a «Todo».
3. **Tus juegos de hoy** (solo con «Todo»): los tres juegos del entrenamiento diario de hoy con su miniatura y nombre; los ya jugados llevan ✓. Tocar uno abre ese juego en modo entrenamiento diario (`/play/<id>?daily=<día>`), igual que desde Hoy. Si el plan de hoy aún no existe o falla, la fila no se muestra.
4. **Una sección por categoría:** título con un punto en el color del área y las tarjetas de sus juegos, tres por fila: miniatura, nombre y habilidad. Cada tarjeta abre el juego en juego libre (`/play/<id>`).
5. La mejor marca sale del catálogo (sigue en Progreso). No hay buscador.

### 4.3 Habilidades (texto nuevo)

| Juego | ES | EN |
|---|---|---|
| Secuencia de luces | Memoria espacial | Spatial memory |
| Flechas | Atención selectiva | Selective attention |
| ¿Igual o distinto? | Velocidad de procesamiento | Processing speed |
| Cambio de regla | Cambio de tareas | Task switching |
| Cálculo relámpago | Aritmética mental | Mental arithmetic |

### 4.4 Miniaturas

Cada juego aporta una miniatura: un SVG cuadrado, decorativo (oculto para lectores de pantalla), sobre fondo nocturno `#0d1024` con un resplandor de su color de juego (los colores de Luz de noche) y borde interior del mismo color; el motivo brilla con `drop-shadow`. Igual en ambos modos. Motivos (como la maqueta v2):

- **Secuencia de luces:** cuadrícula 3×3 con tres casillas encendidas en ámbar.
- **Flechas:** fila de cinco flechas blancas con la del centro en cian, apuntando al revés que las demás.
- **¿Igual o distinto?:** estrella de trazo neón magenta.
- **Cambio de regla:** píldora violeta arriba (la regla) y debajo un círculo azul y un triángulo naranja con contorno claro.
- **Cálculo relámpago:** «7×3» en verde lima con una ranura subrayada.

Esquinas redondeadas; la miniatura escala con su contenedor (tarjeta del catálogo, fila de Hoy, Progreso).

## 5. Hoy, Progreso y Ajustes

### 5.1 Hoy

- **Fila superior:** «Light» y la racha como píldora (sol + «N días» / «N days», con plurales). Debajo del título, el aviso de partidas por sincronizar cuando corresponde (como hoy, solo con sincronización activa).
- **Título y subtítulo** actuales («Entrenamiento de hoy», «Tres juegos cortos, unos 5 minutos en total.»).
- **Semana:** siete círculos de lunes a domingo de la semana actual (iniciales según el idioma: L M M J V S D / M T W T F S S). Encendido (ámbar) = día con el entrenamiento completo; el de hoy lleva anillo si aún no se completa; los futuros, vacíos. Expone a lectores de pantalla un resumen («3 de 7 días entrenados esta semana» / «3 of 7 days trained this week»).
- **Los tres juegos del día:** tarjeta con miniatura, nombre y habilidad. Jugado: ✓ y su último puntaje del día, atenuado. El siguiente: «Sigue» / «Next» en el color de su área. Los demás: nada.
- **Botón abajo:** «Comenzar» si no se ha jugado ninguno; «Continuar · N de 3» (N = juegos jugados + 1) si ya empezó. Lleva al siguiente juego del plan en modo diario, como hoy.
- **Entrenamiento completo:** «¡Entrenamiento de hoy completado!», los tres juegos con ✓ y su puntaje, «Vuelve mañana para mantener tu racha.» y un botón «Explorar juegos» / «Explore games» que lleva al catálogo.
- El error de carga del plan se muestra como hoy.

### 5.2 Progreso

- **Tres cifras grandes** en tarjetas: racha actual, mejor racha y días entrenados (número grande, etiqueta debajo).
- **Puntaje por área:** una barra por categoría con juegos, en el orden de §4.1, en el color de su área, con el valor 0–1000 a la derecha y «—» sin datos (la lógica actual de `areaScores` no cambia).
- **Por juego:** tarjeta con miniatura, nombre, «Mejor N» y la gráfica de últimos puntajes existente (`LineChart`) en el color del área; el mensaje de «juega al menos dos partidas» se mantiene.
- **Sin partidas:** el mensaje actual y un botón «Ir a Hoy» / «Go to Today».

### 5.3 Ajustes

- Grupos en tarjetas con una etiqueta pequeña encima:
  - **Apariencia:** Idioma (selector actual) y Tema como **selector de tres partes** (Automático / Claro / Oscuro) — sigue siendo un grupo de radios accesible.
  - **Durante el juego:** Sonido y Vibración como **interruptores** (siguen siendo casillas accesibles, con aspecto de interruptor), con la nota de vibración debajo.
  - **Privacidad:** la nota actual (con sus variantes de sincronización).
- **Borrar mis datos:** botón aparte con contorno rojo y la misma confirmación y mensajes de hoy.

## 6. Diseño técnico

- **Tokens:** `theme.css` según §3.1 (claro/oscuro); la prueba de contraste se amplía (§8).
- **Juegos:** `GameDefinition` gana `Thumb: ComponentType` (la miniatura) y cada juego un texto `games.<id>.skill`. Las miniaturas viven junto a cada juego (`src/games/<id>/Thumb.tsx`) y comparten un marco común `GameThumb` (fondo, resplandor, borde) en `src/games/shared/`.
- **Orden de categorías:** constante `CATALOG_AREAS` con el orden de §4.1 y una función que devuelve solo las que tienen juegos.
- **Piezas compartidas nuevas** (en `src/app/ui/` o junto a la pantalla que las usa primero): `Switch` (casilla con aspecto de interruptor), `SegmentedControl` (grupo de radios), `WeekStrip` (semana), íconos de la barra inferior.
- **Pantallas:** se rehacen `Layout`, `TodayScreen`, `GamesScreen`, `ProgressScreen` y `SettingsScreen` con sus CSS. La lógica de datos (plan diario, racha, `completedDays`, `areaScores`, ajustes, borrar datos, sincronización) no cambia.
- **Fuera de alcance:** los juegos y sus pantallas (presentación, pausa, resultado), las reglas, la sincronización, nuevos juegos, el buscador.

## 7. Accesibilidad y movimiento

- Miniaturas e íconos decorativos ocultos para lectores de pantalla; los enlaces conservan nombres claros (el nombre del juego).
- Filtros: botones con estado seleccionado anunciado (`aria-pressed` o equivalente).
- Interruptores y selector de tema siguen siendo controles nativos (casilla, radios) con su etiqueta.
- Con «reducir movimiento», nada se anima (los menús casi no tienen animación: solo transiciones de color).
- Sin desplazamiento horizontal a 320 px; objetivos táctiles ≥ 44 px.

## 8. Pruebas

- **Se mantienen** las pruebas actuales de Hoy, Juegos, Progreso, Ajustes, la app y la sincronización; donde cambie un texto acordado aquí (por ejemplo, el botón «Continuar · N de 3»), se actualiza la prueba con el comportamiento nuevo.
- **Nuevas:**
  - Catálogo: filtros (Todo y por categoría, valor en la dirección, valor desconocido = Todo), orden de categorías, «Tus juegos de hoy» con ✓ y enlace en modo diario, habilidad de cada juego, sin mejor marca.
  - Hoy: semana (días completos encendidos, hoy con anillo, resumen accesible), «Sigue» en el siguiente, ✓ y puntaje en los jugados, «Comenzar» / «Continuar · N de 3», estado completo con «Explorar juegos».
  - Progreso: orden de áreas, «Ir a Hoy» sin partidas.
  - Ajustes: interruptores y selector de tema accesibles y funcionando (guardan el ajuste).
  - Cada juego del registro tiene `Thumb` y texto de habilidad en ES y EN.
  - Contraste de §3.1 en ambos modos.
- **E2E (Playwright):** objetivos táctiles ≥ 44 px en la barra, filtros, interruptores y selector; sin desplazamiento horizontal a 320 px en las cuatro pantallas (en español e inglés); capturas de Hoy, Juegos, Progreso y Ajustes en modo claro y oscuro para la revisión del dueño.
