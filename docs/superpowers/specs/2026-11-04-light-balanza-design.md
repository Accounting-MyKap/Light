# Light: «Balanza», el primer juego de Lógica (y el aviso de subida de nivel)

Fecha: 2026-11-04 · Estado: partes 1 y 2 aprobadas en la conversación; el dueño pidió «planifica e implementa todo tú»,
así que la parte 3, la spec escrita y el plan siguen sin esperar otra revisión.

Antecedentes: el diseño general (`2026-10-18-light-brain-training-design.md`), el estilo Luz
(`2026-11-02-light-estilo-luz-design.md`), los menús Luz (`2026-11-03-light-menus-luz-design.md`) y la práctica guiada
(`2026-11-03-light-practica-guiada-design.md`).

## 1. Propósito

Light no tiene juegos de Lógica ni de Lenguaje (el diseño general los dejó para la v2). El dueño eligió empezar por
Lógica con **Balanza**: balanzas con figuras de colores de las que se deduce cuál pesa más y hacia dónde se inclinará
una balanza nueva. Pidió que quede **bien acabado**: sonidos, un aviso cuando sube la dificultad y buenos colores.

**Éxito:**

1. «Balanza» aparece en Juegos en una categoría nueva, **Lógica**, entra al plan diario y tiene su barra en Progreso.
2. Cada reto tiene **una sola respuesta correcta** que se deduce de las pistas (lo comprueban pruebas sobre miles de
   retos por nivel).
3. Se juega completo con toques en un teléfono de 320 px sin desplazarse, y con teclado.
4. Tiene práctica guiada, sonidos propios y el aviso de subida de nivel, que también ganan los otros 7 juegos de
   entrenamiento.
5. Sus resultados se sincronizan con Supabase (después de aplicar la migración, §8).
6. Pasan todas las pruebas del proyecto (unitarias, e2e, lint, tipos).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre | **Balanza** (es) · **Balance** (en) · id `balance` |
| Área | Lógica (`logic`), la sexta categoría de entrenamiento |
| Mecánica | **Mixta por nivel**: niveles 1–4 «¿Cuál pesa más?», niveles 5–10 «¿Hacia dónde se inclina?» |
| Duración | **90 s**, sin reloj por reto (como Guardagujas); bonus de rapidez y un error resta |
| Generación | **Pesos secretos + resolvedor**: retos infinitos, cada uno comprobado como único antes de mostrarse |
| Aviso de nivel | En el marco común (`GameFrame`): lo tienen los 8 juegos de entrenamiento; no las prácticas ni Preguntas |
| Color de Lógica | Verde azulado: `#00b9a0` en Luz y en los menús de noche, `#00776a` en los menús de día. El coral chocaba con el naranja de Cultura general (`#ff7b45`) y el azul lavanda con el violeta de Flexibilidad (ΔE 9,5); el verde azulado queda a ≥ 20,5 (CIEDE2000) de todos los colores de área y de acierto/error |
| Sonidos | Sintetizados con Web Audio como los actuales; nuevos: `tilt` y `levelUp` |
| Enfoque técnico | Motor puro + SVG + CSS, sin canvas ni librerías nuevas |

## 3. Cómo se juega

### 3.1 Figuras

Seis figuras, cada una con **forma y color fijos** (se reconocen aunque cueste distinguir colores):

| Id | Forma | Color | Nombre (es / en) |
|---|---|---|---|
| 0 | círculo | ámbar `#ffb52e` | círculo ámbar / amber circle |
| 1 | cuadrado | cian `#3fd4ff` | cuadrado cian / cyan square |
| 2 | triángulo | magenta `#ff5fd2` | triángulo magenta / magenta triangle |
| 3 | rombo | lima `#8dff6a` | rombo lima / lime diamond |
| 4 | estrella | naranja `#ff8f5e` | estrella naranja / orange star |
| 5 | hexágono | blanco `#eef1ff` | hexágono blanco / white hexagon |

Cada reto usa un subconjunto al azar (sin repetir dentro del reto).

### 3.2 Balanzas

Una balanza tiene dos platillos; cada platillo lleva una o más figuras (como mucho **6** en total por platillo).
Su **resultado** es `left` (baja la izquierda: pesa más), `right` o `level` (recta: pesan igual).

- **Pistas:** se muestran con su resultado, ya inclinadas (o rectas).
- **Balanza nueva** (solo en «¿Hacia dónde se inclina?»): empieza recta con un «?» en el poste; al responder se
  inclina hacia su resultado verdadero.

### 3.3 Tipos de reto

- **«¿Cuál pesa más?»:** las pistas comparan figuras sueltas (una por platillo, siempre desiguales). Abajo hay un
  botón por figura del reto; se toca la más pesada.
- **«¿Hacia dónde se inclina?»:** las pistas tienen figuras repetidas y casi siempre están en equilibrio
  (● = ■■). Abajo hay tres botones: **← Izquierda**, **= Igual**, **Derecha →**.

### 3.4 Niveles

El nivel actual (la escalera de siempre: 4 aciertos seguidos suben, 2 errores seguidos bajan) decide el reto
siguiente.

| Nivel | Tipo | Figuras | Pistas | Receta |
|---|---|---|---|---|
| 1 | más pesada | 3 | 2 | Cadena A>B, B>C en ese orden, la más pesada siempre a la izquierda |
| 2 | más pesada | 3 | 2 | La misma cadena, con las pistas en orden y lados al azar |
| 3 | más pesada | 4 | 3 | Cadena de 4, orden y lados al azar |
| 4 | más pesada | 5 | 4 | Comparaciones al azar entre pares (un árbol, no solo una cadena), verificadas como únicas |
| 5 | inclinación | 2 | 1 | A = m·B (m ∈ {2, 3}); la nueva compara x A con y B |
| 6 | inclinación | 3 | 2 | A = m₁·B, B = m₂·C; la nueva tiene una sola clase de figura por platillo |
| 7 | inclinación | 3 | 2 | Como 6; la nueva mezcla figuras en ambos platillos |
| 8 | inclinación | 3 | 2 | Una equivalencia y una pista **inclinada** (p. ej. C > A); la nueva se deduce de ambas |
| 9 | inclinación | 4 | 3 | Tres equivalencias; la nueva mezcla 2–3 clases por platillo |
| 10 | inclinación | 4 | 3 | Como 9, y una de las pistas puede estar inclinada |

- En los niveles de inclinación el **resultado buscado** se sortea primero entre `left`, `right` y `level` con igual
  probabilidad, y luego se busca una balanza nueva con ese resultado. Así «Igual» sale un tercio de las veces.
- Los pesos secretos son enteros de 1 a 10; ninguna balanza supera 6 figuras por platillo.
- `describeLevel` (selector de nivel): «3 figuras · ¿Cuál pesa más?» o «4 figuras · ¿Hacia dónde se inclina?».

### 3.5 Unicidad (el resolvedor)

`solve(figures, clues)` enumera los pesos posibles de las figuras del reto (enteros de 1 a 20; con k ≤ 5 figuras son a
lo sumo 20⁵ combinaciones y en la práctica se poda por pista) y se queda con los que cumplen todas las pistas.

- «¿Cuál pesa más?» es válido si en **todas** las combinaciones la misma figura es la estrictamente más pesada.
  (Se calcula además por grafo: con pistas estrictas, la respuesta es única si hay exactamente una figura que nunca
  pierde, y todas las figuras están en alguna pista.)
- «¿Hacia dónde se inclina?» es válido si en todas las combinaciones la balanza nueva da el mismo resultado.
- Toda pista debe ser verdadera con los pesos secretos, y el resultado esperado debe coincidir con el del resolvedor.
- Si un intento no es único se descarta y se genera otro (hasta 200); si todos fallaran, se usa un reto fijo de ese
  nivel escrito a mano. Las pruebas exigen que eso no pase con 2 000 semillas por nivel.
- Además se descartan pistas que sobran a la vista (una pista idéntica a otra) y balanzas nuevas idénticas a una pista.

## 4. Partida, puntaje y dificultad

- **Duración:** 90 s (`BALANCE_DURATION_MS = 90_000`) con la barra de tiempo común. Cada reto espera la respuesta.
- **Acierto:** `10 + nivel + bonus de rapidez`. El bonus es `speedBonus(rt, ventana)` (0–10) con
  `ventana = round(3000 + (nivel − 1) · 6000 / 9)` ms (3 s en el nivel 1, 9 s en el 10).
- **Error:** −15 (`BALANCE_WRONG_PENALTY`). El puntaje nunca baja de 0.
- Respuestas antes de 150 ms desde que el reto está a la vista se ignoran (como en todos los juegos).
- **Pausa de respuesta:** tras responder, el reto queda a la vista **600 ms** (acierto) o **1 200 ms** (error, para que
  se vea la respuesta correcta); durante ese tiempo no se aceptan respuestas. El tiempo de respuesta del reto
  siguiente cuenta desde que aparece.
- **Precisión** = aciertos ÷ respuestas. **Nivel alcanzado** = máximo de la escalera.
- **Puntaje de referencia 600**; **máximo 4000** (techo: 90 s ÷ 0,75 s por reto × 30 puntos = 3 600).
- **Adivinar no conviene:** con 3 opciones y bonus máximo, `(10 + nivel + 10)/3 − 2·15/3 ≤ 0` para todo nivel; con 4
  o 5 opciones es peor. Lo comprueba una prueba de simulación como la de Flechas.

## 5. Visual y sonido

### 5.1 Colores

- Tokens nuevos `--area-logic`: `#00776a` (claro) y `#00b9a0` (oscuro) en los cuatro bloques de `theme.css`;
  `[data-luz][data-area='logic'] { --game: #00b9a0 }` en `luz.css`; miniatura `--g: #00b9a0`; punto, barra y «Sigue»
  de Lógica en Juegos, Progreso y Hoy.
- Contraste (medido): `#00b9a0` sobre `#090b19` 7,9:1, `#0b0d1a` sobre `#00b9a0` 7,8:1, `#00776a` sobre `#f6f7fc`
  5,1:1. Distancia (CIEDE2000) ≥ 20,5 a todo color de área, a `--luz-ok` y a `--luz-bad`; de día, ≥ 20,8. La prueba de contraste pasa a recorrer todas las áreas de entrenamiento (incluida Lógica).

### 5.2 Dibujo de la balanza (SVG)

- Lienzo de cada balanza 200 × 120 u: poste con base, brazo con un brillo suave del color del juego, dos platillos que
  **cuelgan de cadenas** y quedan horizontales aunque el brazo se incline (±10° para las pistas inclinadas, 0° las
  rectas).
- Las figuras se apilan sobre el platillo en filas de 3 (máximo 6), con brillo de su color y borde oscuro para
  separarlas.
- Cada balanza tiene `role="img"` y un nombre accesible: «1 círculo ámbar frente a 2 cuadrados cian: quedan iguales»;
  la nueva termina en «: ?».
- **Distribución:** las pistas van arriba en una cuadrícula de 1 o 2 columnas según el ancho (2 columnas con 2 o más
  pistas si el ancho lo permite); la balanza nueva, más grande, debajo, separada por una línea tenue; el texto de la
  pregunta («¿Cuál pesa más?» / «¿Hacia dónde se inclina?») sobre los botones. Todo cabe a 320 × 568 sin desplazarse.
- **Animaciones** (CSS, transform):
  - Reto nuevo: las balanzas aparecen bajando 12 px con fundido en 250 ms.
  - Balanza nueva al responder: se inclina a su resultado en 450 ms con un pequeño rebote; suena `tilt`.
  - Acierto: el botón elegido se enciende en verde (`--luz-ok`); destello y «+N» comunes.
  - Error: el botón elegido en rojo y **el correcto en verde**; pulso, sacudida corta y «−15» comunes.
  - Movimiento reducido: nada baja, rebota ni se inclina con animación; las balanzas aparecen en su posición final.
- **Botones:** de figura (3–5), cuadrados de ≥ 56 px con la figura dibujada y su nombre accesible; de inclinación,
  tres botones de ≥ 44 px de alto con flecha o «=» y texto. En pantallas estrechas los de figura bajan a dos filas.
- **Teclado:** `1`–`5` eligen la figura N (el orden de los botones); `←` izquierda, `→` derecha, `=` o `↓` igual.

### 5.3 Sonidos

`src/core/sound.ts` pasa a aceptar por nota el tipo de onda, un tono final (deslizamiento exponencial) y el volumen.
Tonos nuevos:

| Tono | Cuándo | Cómo suena |
|---|---|---|
| `tilt` | La balanza nueva se inclina | «Clonc»: triángulo 190 → 120 Hz en 120 ms + seno grave 95 Hz en 180 ms |
| `levelUp` | Sube el nivel (cualquier juego de entrenamiento) | Arpegio de triángulo do-mi-sol-do (523, 659, 784, 1047 Hz), empieza a los 120 ms para no pisar el acierto |

Siguen igual `correct`, `wrong` y `finish`. Todo respeta el interruptor de Sonido.

### 5.4 Aviso de subida de nivel (común)

- `GameFrame` recuerda el nivel anterior. Cuando el nivel **sube** (nunca en el primer dibujo), muestra bajo la barra
  superior, sobre la zona de juego, una insignia **«¡Nivel N!»** con «Más difícil» debajo, en el color del juego, que
  entra con un pequeño salto y se va en 1,6 s. El número «Nivel» de la barra superior late una vez.
- Suena `levelUp` y vibra (`VIBRATION.levelUp = [16, 40, 16, 40, 32]`), cada uno según su interruptor.
- No se puede tocar (`pointer-events: none`) ni tapa los controles.
- Un `aria-live="polite"` montado vacío anuncia «Subiste al nivel N».
- Bajar de nivel no se anuncia.
- Prop `levelUp?: boolean` (por defecto `true`); los juegos de Preguntas pasan `false`, y Guardagujas también, porque
  anuncia la subida con su propio «¡Más rápido! · Nivel N» sobre el tablero. Las prácticas no usan
  `GameFrame`, así que no lo muestran.
- Movimiento reducido: aparece y se va con fundido, sin salto.

## 6. Práctica guiada

Cuatro rondas fijas con la mecánica real (sin reloj ni puntos), con el flujo común (`usePracticeRounds`):

| Ronda | Escena | Mensaje | Pista al fallar |
|---|---|---|---|
| 1 | ● vs ■, baja ● | «El lado que baja pesa más. ¿Cuál pesa más?» | «El platillo del círculo está más abajo: el círculo pesa más» |
| 2 | ■ > ▲ y ● > ■ | «Junta las dos balanzas: ¿cuál pesa más de todas?» | «El círculo pesa más que el cuadrado, y el cuadrado más que el triángulo» |
| 3 | ● = ■■; nueva ● vs ■■■ | «Una balanza recta pesa igual a los dos lados. ¿Hacia dónde se inclina la nueva?» | «Un círculo pesa como dos cuadrados; tres cuadrados pesan más: baja la derecha» |
| 4 | ● = ■■; nueva ●● vs ■■■■ | «¿Y esta?» | «Dos círculos pesan como cuatro cuadrados: queda recta» |

- Al acertar en las rondas 3 y 4, la balanza nueva se inclina (y suena `tilt`) durante la pausa de acierto.
- Resumen (`practice.recap`): «Tienes 90 segundos. Cada error resta 15 puntos: piensa, pero sin adivinar. Con teclado:
  1–5 para la figura; ←, = y → para la balanza nueva.»

## 7. Arquitectura

```
src/games/balance/
  figures.ts        las 6 figuras (forma, color, clave de nombre) y el dibujo de cada forma (paths)
  solver.ts         peso de un platillo, resultado de una balanza, solve() y las dos comprobaciones de unicidad
  generator.ts      makeChallenge(level, rng): recetas por nivel (§3.4), reintentos y retos de reserva
  engine.ts         estado de partida, answerBalance, balanceResult, constantes (§4)
  BalanceView.tsx   una balanza en SVG (pista o nueva), con su nombre accesible
  ChallengeView.tsx pistas + balanza nueva + pregunta, compartida por partida y práctica
  Controls.tsx      botones de figura o de inclinación, con su estado (elegido, correcto)
  Game.tsx          la partida (reloj, teclas, pausa de respuesta, GameFrame)
  Practice.tsx      la práctica guiada
  Thumb.tsx         miniatura: balanza inclinada con un círculo y un cuadrado
  index.ts          definición del juego
  balance.module.css
```

Tipos principales:

```ts
type FigureId = 0 | 1 | 2 | 3 | 4 | 5;
type Pan = FigureId[];                       // figuras en el platillo, con repetición
type Outcome = 'left' | 'right' | 'level';
interface Balance { left: Pan; right: Pan; outcome: Outcome }
type Challenge =
  | { kind: 'heaviest'; figures: FigureId[]; clues: Balance[]; answer: FigureId }
  | { kind: 'tilt'; figures: FigureId[]; clues: Balance[]; question: Balance; answer: Outcome };
type Choice = FigureId | Outcome;

interface BalanceState {
  staircase: Staircase; challenge: Challenge; shownAt: number;  // shownAt: cuándo el reto está a la vista
  last: { challenge: Challenge; choice: Choice; correct: boolean; until: number } | null;
  score: number; correct: number; total: number;
}
createBalanceGame(startLevel, rng, now); answerBalance(state, choice, now, rng) → { state, correct | null };
balanceResult(state, durationMs); challengeOnScreen(state, now)  // `last` mientras dura su pausa
```

- El motor genera el reto siguiente al responder y lo deja con `shownAt = now + pausa`; la pantalla dibuja `last`
  hasta `until` (un temporizador con el reloj del juego, que se congela en la pausa) y luego el reto nuevo.
- `GameFrame` gana la insignia de nivel (§5.4) y la prop `levelUp`; `sound.ts` y `vibrate.ts` los tonos y el patrón
  nuevos; el quiz pasa `levelUp={false}`.
- `V1_AREAS` pasa a llamarse `TRAINING_AREAS` e incluye `logic` (lo usan la prueba del registro y la de contraste).
- Registro: `balanceGame` al final de los juegos de entrenamiento. Textos `games.balance.*` en `es.json` y `en.json`;
  `game.levelUp.*` para la insignia.

## 8. Datos

- Migración `supabase/migrations/20261104000000_balance.sql`:
  `insert into public.games (id, area, max_score) values ('balance', 'logic', 4000);` (el área ya está permitida).
- La prueba pgTAP `01_core_schema.test.sql` agrega la fila. `SETUP.md` lista la migración.
- **Aplicarla en el proyecto de Supabase antes de unir a `main`** (README).

## 9. Pruebas

- **Unitarias:**
  - `solver`: pesos y resultados; unicidad detectada y ambigüedad rechazada en casos escritos a mano.
  - `generator`: por cada nivel y 2 000 semillas: tipo y número de figuras/pistas de la receta, figuras sin repetir,
    ≤ 6 por platillo, pistas verdaderas, respuesta única según el resolvedor, pista inclinada solo donde la receta lo
    permite, y en los niveles de inclinación cada resultado entre 25 % y 42 %. Nunca cae al reto de reserva.
  - `engine`: puntos de acierto y error, piso 0, ventana de rapidez, pausa de respuesta (respuestas ignoradas),
    150 ms, escalera, resultado; simulación de adivinar al azar (≈ 0 o menos) frente a jugar con cuidado (> 5 por reto).
  - `Game`: botones y teclas, pausa tras responder, fin a los 90 s con el resultado, pausa del juego.
  - `Practice`: las 4 rondas, pista al fallar, saltar.
  - `GameFrame`: insignia al subir, no al empezar ni al bajar, ni con `levelUp={false}`; sonido según el ajuste.
  - `sound`: los tonos nuevos no fallan sin `AudioContext`.
  - Registro, contraste, catálogo, textos de penalización (el resumen dice 15 y 90), pantalla Juegos.
- **E2E:** Balanza en las capturas Luz, en los objetivos táctiles y pantallas estrechas (320 px), en la práctica
  guiada (incluida la pista al fallar), y una prueba que juega acertando hasta que aparece la insignia de nivel.

## 10. Fuera de alcance

- Juegos de Lenguaje; más juegos de Lógica.
- Cambiar las reglas o el puntaje de los otros juegos (solo ganan el aviso de nivel).
