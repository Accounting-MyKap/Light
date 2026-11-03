# Light: juego «Lluvia de estrellas»

Fecha: 2026-11-03 · Estado: diseño aprobado por partes en la conversación; pendiente de revisión escrita.

Antecedentes: el diseño general de Light (`docs/superpowers/specs/2026-10-18-light-brain-training-design.md`), el estilo Luz de los juegos (`2026-11-02-light-estilo-luz-design.md`) y los menús Luz (`2026-11-03-light-menus-luz-design.md`).

## 1. Propósito

El dueño mostró un juego de otra app de entrenamiento mental donde caen gotas con operaciones, se responde escribiendo el resultado, una gota dorada revienta todas las demás y la partida termina cuando caen 3 gotas al agua. Pidió un juego así para Light.

Light toma la **mecánica** (operaciones que caen, una especial que despeja la pantalla, 3 vidas), pero con **nombre, tema y dibujo propios**: estrellas fugaces y un cometa dorado sobre el cielo de noche del estilo Luz. No se copia el nombre, el dibujo ni la ambientación del juego original (cielo turquesa, nubes, gotas sobre el mar).

**Éxito:**

1. «Lluvia de estrellas» aparece en el catálogo, en Matemáticas, junto a Cálculo relámpago, y entra al plan diario.
2. Se juega completo en el teléfono (teclado en pantalla) y en el computador (números, teclado numérico, Backspace y Enter).
3. Las reglas de §3 se cumplen y están cubiertas por pruebas del motor.
4. Sus resultados se sincronizan con Supabase como los de los demás juegos (después de aplicar la migración, §6.4).
5. Los otros cinco juegos se ven y funcionan igual que antes.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Lugar en la app | Juego **nuevo** del área Matemáticas (`math`); Cálculo relámpago se mantiene. |
| Tema | **Lluvia de estrellas** (EN «Star Shower»): estrellas fugaces con la operación caen hacia el horizonte; la especial es un **cometa dorado**. |
| Cometa | Puede salir en cualquier momento de la partida, solo o con otras estrellas en pantalla; al resolverlo revienta todo lo que haya en pantalla. |
| Número equivocado | **No resta puntos**: no revienta nada, se borra y se vuelve a intentar. Es la primera excepción a la regla «los errores restan» (diseño general, §4); las instrucciones lo dicen. |
| Estrella perdida | Al tocar el horizonte: se pierde una vida, **explotan todas las demás**, pausa corta y se sigue con el **mismo ritmo y nivel**. |
| Fin | Al perder la tercera estrella; tope de seguridad de 5 minutos. |
| Enfoque técnico | Motor puro basado en el tiempo del juego + un ciclo `requestAnimationFrame` que mueve las estrellas sin redibujar con React en cada cuadro. Sin canvas ni librerías de animación (como en Luz). |

## 3. Reglas

Todos los números son **valores iniciales de ajuste**; se pueden afinar sin cambiar el diseño.

### 3.1 Tiempo del juego y ritmo

- El **tiempo del juego** es el reloj compartido (`useGameClock`): cuenta solo el tiempo activo y se detiene en la pausa.
- El **tiempo de ritmo** es el tiempo del juego menos las pausas tras una estrella perdida (§3.5). Así, después de perder una estrella el ritmo sigue donde estaba.
- Con `p` = tiempo de ritmo en segundos, limitado a 150:
  - intervalo entre estrellas = 3200 − 1800 · p/150 ms (de **3,2 s** a **1,4 s**);
  - tiempo de caída de una estrella nueva = 9000 − 3000 · p/150 ms (de **9 s** a **6 s**).
- Desde los 150 s de ritmo, los valores se quedan en 1,4 s y 6 s. El ritmo nunca retrocede.

### 3.2 Estrellas

- La primera estrella nace al empezar la partida; cada siguiente, un intervalo después de la anterior (§3.1).
- Cada estrella nace arriba en una de **3 columnas**, elegida al azar entre las dos distintas de la columna de la estrella anterior.
- Cada estrella guarda su operación, el **nivel** con el que se creó, su columna, el momento en que nació, su tiempo de caída y si es el cometa.
- Su altura es (tiempo del juego − nacimiento) ÷ tiempo de caída: 0 arriba, 1 en el horizonte.
- **Resultados únicos:** nunca hay dos estrellas en pantalla con el mismo resultado. Si la operación generada repite un resultado en pantalla, se genera otra (hasta 50 intentos); si no se logra, ese nacimiento se aplaza 200 ms.
- **Operaciones:** la misma escala por nivel de Cálculo relámpago (sumas de una cifra en el nivel 1 → restas → tablas → dos cifras → división → mixtas en el nivel 10). El resultado más grande posible es 198, así que la respuesta admite hasta 3 cifras.

### 3.3 Cometa dorado

- Cada estrella nueva es el cometa con probabilidad **1/10**, siempre que no haya ya un cometa en pantalla. Puede salir en cualquier momento, también como única estrella.
- Cae como las demás, con una operación de su nivel.
- Resolverlo revienta el cometa y **todas** las estrellas en pantalla; cada una, incluido el cometa, suma sus puntos (§3.6).
- Si toca el horizonte, cuenta como cualquier estrella perdida (§3.5).

### 3.4 Responder

- Se escriben cifras (hasta 3) y se envían con OK o Enter. ⌫ o Backspace borra la última cifra. Enter con la respuesta vacía no hace nada.
- **Acierto:** revienta la estrella con ese resultado (es única, §3.2). Si es el cometa, se aplica §3.3. La respuesta se vacía.
- **Número equivocado** (ninguna estrella tiene ese resultado): no suma ni resta puntos, no revienta nada y la respuesta se vacía. Cuenta como fallo para la precisión y para el nivel (§3.7).
- Mientras dura la pausa tras una estrella perdida se puede escribir, pero enviar con el cielo vacío no hace nada.

### 3.5 Estrella perdida

Cuando una estrella toca el horizonte (altura ≥ 1):

1. Se pierde una vida (hay 3).
2. Todas las demás estrellas de la pantalla, incluido el cometa, explotan **sin dar puntos y sin contar como fallo**. Solo cuenta como fallo la que tocó el horizonte.
3. Empieza una **pausa de 1,5 s** con el cielo vacío; no nacen estrellas y el tiempo de ritmo no avanza.
4. Al terminar la pausa, la siguiente estrella nace de inmediato, con el ritmo y el nivel que había.
5. Si era la tercera vida, la partida **termina** en ese momento (no hay pausa).

Perder una estrella **no cambia el nivel** ni las rachas que lo suben o bajan.

### 3.6 Fin, puntos y resultado

- La partida termina al perder la tercera estrella o al llegar a **5 minutos** de tiempo del juego (tope de seguridad que casi nadie alcanzará).
- **Puntos:** cada estrella reventada suma 10 + el nivel con el que se creó. El puntaje nunca baja.
- **Precisión** = aciertos ÷ (aciertos + números equivocados + estrellas perdidas); 0 si no hubo ninguno. Resolver el cometa cuenta como un acierto; las estrellas que revienta no cuentan ni a favor ni en contra.
- **Resultado:** `score` = puntos; `accuracy` = precisión; `levelReached` = nivel máximo alcanzado; `durationMs` = tiempo del juego al terminar.
- **Puntaje de referencia: 600** (equivale a 1000 en el puntaje del área). El área Matemáticas muestra el promedio de los dos juegos (ya funciona así).
- **Puntaje máximo: 4000.** Con juego perfecto durante los 5 minutos nacen como máximo 176 estrellas (≈ 70 en los primeros 150 s y ≈ 106 en los siguientes), a 20 puntos como mucho cada una: 3520. Una prueba lo verifica simulando la partida perfecta.

### 3.7 Nivel

- El nivel inicial (1–10) viene del registro entre partidas, como en los demás juegos.
- Dentro de la partida se usa la escalera común (`stepStaircase`): 4 aciertos seguidos suben un nivel; 2 números equivocados seguidos lo bajan.
- Las estrellas perdidas no tocan la escalera (§3.5).
- El nivel decide la operación de cada estrella **nueva**; las que ya caen conservan la suya.

## 4. Pantalla

### 4.1 Distribución

Dentro del marco común de los juegos (`GameFrame`), de arriba abajo:

1. **Barra superior** (como en los otros juegos): ✕ para pausar, «Lluvia de estrellas» con «Nivel N» debajo y la píldora de puntos.
2. **Vidas** en lugar de la barra de tiempo: 3 estrellitas del color del área; una vida perdida queda solo con el contorno. Texto accesible «Vidas: N de 3».
3. **Cielo** (zona de juego):
   - Fondo de noche Luz con el resplandor verde lima de Matemáticas arriba y puntitos de estrellas quietos como decorado.
   - **Horizonte** abajo: una línea luminosa con un suelo oscuro debajo.
   - **Estrellas fugaces:** esfera de luz del color del área (`--game`) con la operación en `--luz-ink` (por ejemplo `7 + 5`), halo del mismo color y una estela que se desvanece hacia arriba.
   - **Cometa:** más grande, dorado (`--luz-gold`), con estela larga y un ✦; la forma y el ✦ hacen que el color no sea la única pista.
   - Las 3 columnas reparten el ancho del cielo; la operación más larga (`20 + 9 × 9`) cabe en un teléfono de 360 px.
4. **Ranura de respuesta** sobre el horizonte, al centro, con el subrayado luminoso de Cálculo relámpago.
5. **Teclado en pantalla** abajo (el de Cálculo relámpago: cifras, ⌫ y OK). No hay «Saltar».

### 4.2 Reacciones

| Momento | Vista | Sonido y vibración (`useFeedback`) |
|---|---|---|
| Acierto | La estrella estalla en chispas; «+N» sube desde los puntos. | `correct` |
| Cometa resuelto | Destello dorado sobre el cielo y todas las estrellas estallan a la vez; «+N» con el total. | `correct` |
| Número equivocado | La ranura se tiñe de `--luz-bad`, se sacude y se vacía; no hay número flotante (los puntos no cambian). | `wrong` |
| Estrella perdida | El horizonte se enciende en rojo donde cayó, se apaga una vida y las demás estrellas se desvanecen; sigue la pausa de 1,5 s. | `timeout` (pulso sin sacudida) |
| Tercera estrella perdida | Un segundo con el cielo quieto y luego la pantalla de resultado de siempre. | `timeout` |

### 4.3 Movimiento reducido y accesibilidad

- Con `prefers-reduced-motion: reduce`, las estrellas **siguen cayendo** (es la mecánica del juego), pero sin estelas, chispas, sacudidas ni destellos, y los puntitos del fondo no titilan; las estrellas que revientan o se pierden solo se desvanecen.
- El teclado en pantalla son `<button>` reales de al menos 44 px; el teclado físico funciona con `useGameKeys` (las teclas del teclado numérico llegan como las mismas cifras y Enter).
- El cielo no se anuncia a lectores de pantalla (limitación conocida de los juegos visuales contra el reloj, diseño general §7); las vidas y los puntos sí tienen texto accesible.

### 4.4 Instrucciones, ejemplo y miniatura

- **Ejemplo** (instrucciones): mini escena en bucle hecha con CSS: dos estrellas caen, se escribe `12`, una estalla; luego cae el cometa, se resuelve y estalla todo. Con movimiento reducido queda fija.
- **Miniatura** (catálogo, Hoy, Progreso): SVG fijo con una estrella verde con estela y un cometa dorado pequeño sobre el cielo de noche, como las demás miniaturas.

### 4.5 Textos

| Clave | ES | EN |
|---|---|---|
| `games.star-shower.title` | Lluvia de estrellas | Star Shower |
| `games.star-shower.skill` | Cálculo bajo presión | Math under pressure |
| `games.star-shower.description` | Resuelve las operaciones de las estrellas antes de que toquen el horizonte. | Solve the sums on the falling stars before they reach the horizon. |
| `games.star-shower.instructions` | 1. Caen estrellas con operaciones. Escribe el resultado con el teclado en pantalla o el de tu computador y pulsa OK (o Enter) para reventarlas. 2. El cometa dorado revienta todas las estrellas de la pantalla. Un número equivocado no resta puntos: vuelve a intentarlo. 3. Si una estrella toca el horizonte, pierdes una vida y se borran las demás. Al perder 3, termina la partida. | 1. Stars with sums are falling. Type the answer on the on-screen keypad or your keyboard and press OK (or Enter) to pop them. 2. The golden comet pops every star on the screen. A wrong number costs no points: just try again. 3. If a star reaches the horizon, you lose a life and the other stars vanish. Lose 3 and the game ends. |
| `game.hud.lives` | Vidas: {{left}} de {{total}} | Lives: {{left}} of {{total}} |
| `game.keypad.delete` / `game.keypad.ok` | Borrar / OK | Delete / OK |

`game.keypad.*` reemplaza a `games.quick-math.delete` y `games.quick-math.ok` (§6.2), con los mismos valores que hoy en cada idioma.

## 5. Diseño técnico

### 5.1 Piezas nuevas (`src/games/star-shower/`)

| Pieza | Responsabilidad |
|---|---|
| `engine.ts` | Lógica pura (sin React ni DOM), todo en función del tiempo del juego `now` (ms) y de un `Rng`. Estado: estrellas en pantalla, próximo nacimiento, columna anterior, vidas, fin de la pausa, tiempo de ritmo acumulado en pausas, escalera de nivel, respuesta escrita, puntos y contadores (aciertos, equivocados, perdidas). Funciones: `createStarShower(startLevel, rng)`; `advance(state, now, rng)` hace nacer las estrellas que tocan, detecta la que llega al horizonte (§3.5) y el fin (§3.6), y devuelve el estado nuevo y los **eventos** ocurridos (nacimiento, estrella perdida con su columna, estrellas despejadas, fin); `typeDigit` / `deleteDigit`; `submitAnswer(state, now)` devuelve el estado y el desenlace (`hit`, `comet`, `wrong` o `null` si no había respuesta o el cielo estaba vacío) con las estrellas reventadas; `starHeight(star, now)`; `nextEventAt(state)` (el próximo nacimiento, aterrizaje, fin de pausa o tope); `starShowerResult(state, now)`. Constantes exportadas: ritmo (§3.1), vidas, pausa, tope, `STAR_SHOWER_MAX_SCORE = 4000`, `STAR_SHOWER_REFERENCE_SCORE = 600`. |
| `Game.tsx` | Usa `useGameClock(paused)`. Mientras no está en pausa ni terminado, corre un ciclo `requestAnimationFrame`: lee `clock.now()`, escribe la altura de cada estrella directamente en su elemento (por referencia, con `transform`) y, cuando `now` alcanza `nextEventAt`, llama a `advance` y actualiza el estado de React (solo entonces se vuelve a dibujar). Conecta `useGameKeys` (cifras, Backspace, Enter), el teclado en pantalla y `useFeedback` según §4.2. Al terminar espera 1 s de tiempo del juego (respetando la pausa) y llama a `onFinish` una sola vez. Informa vidas y nivel a `GameFrame`. |
| `Sky.tsx` | Dibuja el cielo, el horizonte, las estrellas (registra la referencia de cada una para el ciclo de animación), las animaciones de estallido y la ranura de respuesta. |
| `Example.tsx`, `Thumb.tsx` | Ejemplo animado y miniatura (§4.4). |
| `star-shower.module.css` | Estilos con los tokens Luz; bloque de movimiento reducido (§4.3). |
| `index.ts` | Definición: `id: 'star-shower'`, `area: 'math'`, `referenceScore: 600`, `maxScore: 4000`, `Component`, `Example`, `Thumb`. |

### 5.2 Cambios en lo existente

1. **Operaciones compartidas:** `Op`, `Problem`, `makeProblem` y `formatProblem` pasan de `src/games/quick-math/engine.ts` a `src/games/shared/arithmetic.ts`. El motor de Cálculo relámpago las importa de ahí; su comportamiento no cambia y sus pruebas siguen pasando.
2. **Teclado compartido:** `Keypad` pasa de `src/games/quick-math/Keypad.tsx` a `src/games/shared/Keypad.tsx`, con sus estilos (`.keypad`, `.key`, `.ok`) en `src/games/shared/Keypad.module.css`. Sus textos pasan a `game.keypad.delete` y `game.keypad.ok`. Cálculo relámpago usa el teclado compartido y se ve igual.
3. **`GameFrame`:** opción nueva `lives?: { left: number; total: number }`, que dibuja las vidas en la fila de progreso (donde van la barra de tiempo o los puntitos de ronda) con el texto accesible `game.hud.lives`.
4. **Luz:** token nuevo `--luz-gold` en `src/games/shared/luz/luz.css` (valor inicial `#ffd34d`, ajustable si no pasa el contraste). La prueba de contraste lo agrega: `--luz-gold` sobre `--luz-bg` ≥ 3:1 y `--luz-ink` sobre `--luz-gold` ≥ 4,5:1.
5. **Registro:** `starShowerGame` se agrega a `GAMES` en `src/games/registry.ts`, después de `quickMathGame`.
6. **Textos:** los de §4.5 en `es.json` y `en.json`.

No cambian: el guardado del resultado, la racha, el plan diario, el puntaje por área, la sincronización, la pausa (la hoja de pausa ya funciona sin reloj, como en Secuencia de luces) ni las reglas de los otros cinco juegos.

### 5.3 Flujo de datos

```
requestAnimationFrame
  → clock.now()
  → mueve cada estrella (transform)            ← sin pasar por React
  → si now ≥ nextEventAt: advance() → eventos → setState + useFeedback
Tecla o botón → typeDigit / deleteDigit / submitAnswer(now) → setState + useFeedback
Fin → 1 s → onFinish(starShowerResult) → recordGameResult (sin cambios)
```

### 5.4 Pausa y pestaña oculta

`PlayScreen` ya pone `paused` en `true` al abrir la pausa o al ocultar la pestaña. El reloj del juego se congela, el ciclo de animación se detiene y las estrellas quedan donde estaban; al continuar (tras la cuenta 3, 2, 1 existente) siguen desde la misma altura.

## 6. Datos y Supabase

### 6.1 Resultado

Usa el `GameResult` de siempre. `durationMs` va de unos 29 s (tres estrellas perdidas sin responder: tres caídas de casi 9 s más dos pausas de 1,5 s) a 300 s, dentro de lo que acepta el servidor (5 s a 1 h).

### 6.2 Base local

Sin cambios: el juego nuevo usa los almacenes existentes (`results`, `gameLevels`, `dailyPlans`).

### 6.3 Migración

Nueva migración `supabase/migrations/20261103000000_star_shower.sql`:

```sql
-- max_score matches maxScore in the game registry (src/games).
insert into public.games (id, area, max_score) values ('star-shower', 'math', 4000);
```

La prueba pgTAP `supabase/tests/01_core_schema.test.sql` pasa a esperar 6 juegos, con esa fila. La prueba de integración «the games table matches the registry» la verifica sin cambios.

### 6.4 Publicación

⚠️ Como indica el README, **la migración se aplica en el proyecto de Supabase del dueño antes de unir el cambio a `main`**. Si el juego llega a los jugadores antes que su fila en `games`, el servidor rechaza sus resultados y los dispositivos los marcan como no sincronizables para siempre. Este paso lo hace el dueño; la implementación no toca su proyecto de Supabase.

## 7. Pruebas

- **Motor (`engine.test.ts`), con reloj y azar controlados:**
  - el intervalo y la caída siguen §3.1 y se quedan fijos desde los 150 s de ritmo;
  - una estrella nunca nace en la columna de la anterior; nunca hay dos resultados iguales en pantalla;
  - un acierto revienta su estrella y suma 10 + su nivel; el cometa revienta todo y suma cada estrella; nunca hay dos cometas;
  - un número equivocado no cambia los puntos, vacía la respuesta y cuenta para la precisión y la escalera; Enter vacío no hace nada;
  - una estrella perdida quita una vida, despeja el cielo sin puntos, abre la pausa de 1,5 s y el ritmo sigue donde estaba; no cambia el nivel;
  - la tercera estrella perdida termina la partida; el tope de 5 minutos también;
  - la precisión y el resultado siguen §3.6;
  - una partida perfecta simulada de 5 minutos nunca supera `STAR_SHOWER_MAX_SCORE`.
- **Operaciones y teclado compartidos:** las pruebas actuales de Cálculo relámpago siguen pasando; las de `makeProblem` se mueven con la función.
- **Pantalla (`Game.test.tsx`):** escribir el resultado de una estrella visible (con el teclado físico y con el de pantalla) la revienta; en pausa las estrellas no se mueven y no nacen nuevas; al perder 3 estrellas `onFinish` se llama una sola vez con el resultado.
- **Marco:** `GameFrame` con `lives` muestra las vidas y su texto accesible.
- **Contraste:** `--luz-gold` según §5.2.
- **Textos:** el registro exige los textos en ambos idiomas (prueba existente); una prueba nueva comprueba que las instrucciones dicen que un número equivocado no resta («no resta» / «costs no points»).
- **Pantallas:** las pruebas que cuentan los juegos del catálogo (`GamesScreen.test.tsx`) pasan de 5 a 6.
- **E2E:** `e2e/luz.spec.ts` agrega el juego a sus capturas (en juego y en resultado); `e2e/touch-targets.spec.ts` revisa que su teclado mida al menos 44 px.
- **Base de datos:** pgTAP según §6.3.

## 8. Fuera de alcance

- Cambios en Cálculo relámpago u otros juegos más allá de mover las operaciones y el teclado a piezas compartidas.
- Sonidos nuevos (se usan los tonos de acierto y error existentes).
- Aplicar la migración en el proyecto real de Supabase (lo hace el dueño, §6.4).
- Tablas de líderes o modos de juego adicionales.
