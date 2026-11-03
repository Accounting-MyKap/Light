# Light: práctica guiada en cada juego

Fecha: 2026-11-03 · Estado: diseño aprobado por partes en la conversación. El dueño pidió escribirlo e implementarlo de una vez y publicarlo cuando todo esté en verde.

## 1. Propósito

Hoy, la primera vez que se abre un juego, aparece una pantalla de pasos con un ejemplo animado. Leer no es lo mismo que entender. El dueño pidió un **minitutorial**: una **práctica guiada** donde la persona juega unas pocas rondas fáciles mientras un guía le explica qué hacer. Además pidió que, para quien ya jugó, la **pausa** ofrezca esa práctica por si no recuerda cómo se juega.

**Éxito:**
- La primera vez, cada juego enseña jugando (los que no tienen práctica conservan la pantalla de pasos, §3.6).
- La práctica está disponible en la entrada (para quien ya jugó) y en la pausa.
- Nadie pierde datos.
- Nadie que ya conoce un juego recibe la práctica a la fuerza.
- El dueño aprueba las capturas de cada práctica.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tipo de tutorial | Práctica guiada: rondas fijas y fáciles, sin reloj y sin puntos, con un mensaje del guía en cada ronda y una pista si se falla. |
| Primera vez | La práctica **reemplaza** la pantalla de pasos. |
| Construcción | Una práctica preparada por juego, sobre un marco común. Reusa las piezas visuales del juego. Los juegos reales no cambian. |
| Saltar | «Saltar práctica» siempre disponible. |
| Quien ya jugó | No recibe la práctica sola. La tiene en «¿Cómo se juega?» (entrada) y en la pausa. |

## 3. Flujo

### 3.1 Primera vez que se abre un juego

La primera vez es cuando el juego no está en la lista de juegos ya vistos, y aplica tanto en juego libre como en el entrenamiento diario.

1. **Entrada de práctica:**
   - Arriba, la ✕ y la categoría, como hoy (`IntroHeader`).
   - El nombre del juego y la frase «Vamos a practicar un poco: sin reloj y sin puntos.» / «Let's practice a little: no clock, no points.»
   - Botón principal «Empezar práctica» / «Start practice», y botón secundario «Saltar práctica» / «Skip practice».
   - La ✕ sale sin marcar nada, así que la entrada vuelve a aparecer la próxima vez.
2. **Práctica:** las rondas de §4, dentro del marco común (§5.1).
3. **Final:**
   - Al completar la práctica:
     - aparece la pantalla «¡Listo! Ahora va en serio» / «Done! Now for real», con un **resumen de reglas** del juego (§4.6);
     - el botón «Comenzar» empieza el juego real.
   - Al tocar «Saltar práctica» (en la entrada o durante la práctica), el juego real empieza directamente.
   - Completar o saltar marca el juego como visto. Salir con la ✕ no lo marca.

### 3.2 Quien ya jugó ese juego

- La entrada es la de hoy: nombre, descripción, «Comenzar» y «¿Cómo se juega?».
- «¿Cómo se juega?» abre la práctica.
  - Al completarla aparece la misma pantalla «¡Listo!» con su resumen y «Comenzar».
  - Si la salta, vuelve a la entrada.

### 3.3 En la pausa

- La hoja de pausa tiene tres botones: «Continuar», «¿Cómo se juega?» y «Salir», en ese orden. «Continuar» sigue siendo el que recibe el foco.
- «¿Cómo se juega?» abre la práctica encima del juego, que sigue congelado: su tiempo, sus puntos y su ronda no cambian.
- Al completarla o saltarla, se vuelve a la hoja de pausa. «Continuar» hace el 3-2-1 de siempre.
- Si la app se oculta durante la práctica, la práctica se queda abierta (el juego ya está en pausa).

### 3.4 Qué guarda la app

- **La práctica no guarda nada:** ni resultado, ni nivel, ni plan diario, ni sincronización.
- **La marca de visto:** se reutiliza `settings.seenInstructions`, la lista de ids de juegos ya vistos.
  - Quien ya abrió un juego antes de este cambio lo tiene marcado y no ve la práctica sola.
  - No hay migración de datos.

### 3.5 Qué se quita

- La pantalla de pasos (`Instructions`).
- Los cinco ejemplos animados (`Example`) y `GameDefinition.Example`.
- Los textos que solo usaban la pantalla y los ejemplos: `games.<id>.instructions`, `games.<id>.exampleAnswer*`, `play.example` y otros de los ejemplos.
- Lo que siga en uso no se toca.

Lo anterior vale para los cinco juegos originales y, después, para Guardagujas (§4.7) y Lluvia de estrellas (§4.8). La pantalla de pasos, `GameDefinition.Example` y `play.example` se quedan para los juegos sin práctica (§3.6).

### 3.6 Juegos sin práctica

Mientras se construía esta práctica, `main` sumó Guardagujas, Lluvia de estrellas y los 14 juegos de preguntas. El dueño decidió unir los cambios y publicar sin hacerles una práctica. Después, Guardagujas (§4.7) y Lluvia de estrellas (§4.8) recibieron la suya.

- **Quiénes:** solo los 14 juegos de preguntas. Los siete juegos de entrenamiento tienen práctica.
- **Primera vez:** la pantalla de pasos con su ejemplo y «Comenzar», como antes. «Comenzar» marca el juego como visto; los de preguntas comparten la marca (`quiz.instructions`), así que la pantalla aparece una sola vez para los 14.
- **Quien ya jugó:** «¿Cómo se juega?» abre esa misma pantalla de pasos, y su «Comenzar» empieza el juego.
- **En la pausa:**
  - La hoja tiene los mismos tres botones: «Continuar», «¿Cómo se juega?» y «Salir».
  - «¿Cómo se juega?» abre los pasos en la misma capa que la práctica, encima del juego congelado.
  - Su botón principal dice «Volver» y regresa a la hoja. La ✕ también regresa a la hoja, y por eso se llama «Volver».
  - Si la app se oculta, los pasos se quedan abiertos.
- **Datos:** `GameDefinition` tiene `Practice` o `Example`, nunca los dos ni ninguno. Con `Practice`, el juego necesita `games.<id>.practice.recap`; con `Example`, sus pasos (`games.<id>.instructions` o su `instructionsKey`). Una prueba del registro lo verifica en ES y EN.

## 4. Las prácticas

En todas las prácticas:
- Cada ronda tiene un mensaje del guía.
- Al acertar: reacción de acierto (destello, sonido y vibración, como en el juego), «¡Bien!» / «Nice!», y la siguiente ronda tras un instante (~700 ms).
- Al fallar: reacción de error, la pista de esa ronda, y se repite la misma ronda sin castigo.
- Las rondas son siempre las mismas. El teclado funciona como en el juego.

### 4.1 Secuencia de luces (3 rondas, tablero 3×3)

- **Rondas:**
  - casillas 2 y 6;
  - casillas 7, 5 y 3;
  - casillas 1, 5, 9 y 6.
  Las casillas se cuentan del 1 al 9, de izquierda a derecha y de arriba abajo, como sus etiquetas «Casilla N».
- **Guía:**
  - Mientras se encienden: «Mira qué casillas se encienden…» / «Watch which squares light up…».
  - Cuando toca responder: «Ahora tócalas en el mismo orden» / «Now tap them in the same order».
  - En la tercera ronda se añade antes: «Si aciertas, la secuencia se alarga» / «Get it right and the sequence grows longer».
- **Al fallar:** «Casi. Mira otra vez» / «Almost. Watch again», y la misma secuencia se repite.
- Los tiempos de encendido son los del juego.

### 4.2 Flechas (4 rondas)

- **Rondas:**
  - las cinco a la derecha;
  - las cinco a la izquierda;
  - centro a la derecha y lados a la izquierda;
  - centro a la izquierda y lados a la derecha.
- **Guía:**
  - Rondas 1 y 2: «Toca hacia dónde apunta la flecha del centro» / «Tap the way the middle arrow points».
  - Rondas 3 y 4: «Ojo: las de los lados quieren engañarte. Solo cuenta la del centro» / «Careful: the side arrows try to trick you. Only the middle one counts».
- **Al fallar:** «La del centro apunta a la derecha» o «…a la izquierda» / «The middle one points right» o «…left».

### 4.3 ¿Igual o distinto? (4 pasos)

- **Pasos:**
  1. Una estrella, con «Recuérdala» / «Remember it». Los botones están apagados y el paso avanza solo tras 1,5 s, como al inicio del juego.
  2. Otra estrella: «¿Es igual a la anterior?» / «Is it the same as the one before?». Respuesta: Sí.
  3. Un corazón: «¿Y esta?» / «And this one?». Respuesta: No.
  4. Otro corazón: «Compara siempre con la que vino justo antes» / «Always compare with the one just before». Respuesta: Sí.
- **Al fallar:** «Antes había una estrella: es igual» / «Before there was a star: it's the same». La pista se adapta al símbolo anterior, a «igual» o «distinto», y al género del nombre en español.
- La práctica muestra «Práctica N de 3», porque solo cuenta los pasos que piden respuesta.

### 4.4 Cambio de regla (4 rondas)

| Ronda | Regla | Centro | Izquierda | Derecha | Correcta |
|---|---|---|---|---|---|
| 1 | COLOR | círculo azul | cuadrado azul | círculo naranja | izquierda |
| 2 | COLOR | triángulo morado | triángulo naranja | cuadrado morado | derecha |
| 3 | FORMA | círculo naranja | círculo azul | cuadrado naranja | izquierda |
| 4 | FORMA | triángulo azul | cuadrado azul | triángulo morado | derecha |

- **Guía:**
  - Ronda 1: «La regla dice COLOR: busca la carta del mismo color» / «The rule says COLOR: find the card with the same color».
  - Ronda 2: «Sigue siendo COLOR: no te fijes en la forma» / «Still COLOR: ignore the shape».
  - Ronda 3: «¡Cambió la regla! Ahora busca la misma FORMA» / «The rule changed! Now find the same SHAPE».
  - Ronda 4: «Fíjate siempre en el cartel de arriba» / «Always check the sign on top».
- En la ronda 3, el cartel anima el cambio de regla igual que en el juego.
- **Al fallar:** «La regla es COLOR y el centro es azul» / «The rule is COLOR and the middle card is blue», o lo equivalente para FORMA y la forma del centro.

### 4.5 Cálculo relámpago (3 rondas)

- **Rondas:** 2 + 3 = 5; 7 − 4 = 3; 6 × 7 = 42.
- **Guía:**
  - Ronda 1: «Escribe el resultado y toca OK» / «Type the answer and tap OK».
  - Ronda 2: «¡Así! Otra» / «Like that! Another one».
  - Ronda 3: «Si una se te complica, puedes tocar Saltar» / «If one is too hard, you can tap Skip». En esta ronda valen la respuesta correcta y «Saltar».
- **Al fallar:** «Casi: 2 + 3 = 5. Inténtalo otra vez» / «Close: 2 + 3 = 5. Try again», con la operación de la ronda. La respuesta escrita se borra.

### 4.6 Resumen de reglas en «¡Listo!»

Una línea por juego. Debe nombrar la penalización, si la hay, con su número exacto.

- **Secuencia de luces:**
  - ES: «Son 8 rondas. Si aciertas, la secuencia se alarga; si fallas, se acorta.»
  - EN: «There are 8 rounds. Get one right and the sequence grows; miss and it shrinks.»
- **Flechas:**
  - ES: «Tienes 60 segundos. Cada error resta 20 puntos: responde rápido, pero sin adivinar.»
  - EN: «You have 60 seconds. Each mistake costs 20 points: be quick, but don't guess.»
- **¿Igual o distinto?:**
  - ES: «Tienes 60 segundos. Las rachas multiplican tus puntos; cada error resta 10 y reinicia la racha.»
  - EN: «You have 60 seconds. Streaks multiply your points; each mistake costs 10 and resets the streak.»
- **Cambio de regla:**
  - ES: «Tienes 60 segundos. Cada error resta 20 puntos: responde rápido, pero sin adivinar.»
  - EN: «You have 60 seconds. Each mistake costs 20 points: be quick, but don't guess.»
- **Cálculo relámpago:**
  - ES: «Tienes 60 segundos. Cada acierto suma, cada error resta 10 y saltar no resta.»
  - EN: «You have 60 seconds. Each right answer scores, each mistake costs 10, and skipping costs nothing.»
- **Guardagujas** (sin penalización: un tren en otra estación no suma):
  - ES: «Tienes 90 segundos. Cada tren que llega a su estación suma; si llega a otra, no suma. Van más rápido mientras aciertas. Con teclado: números 1 a 9.»
  - EN: «You have 90 seconds. Each train that reaches its station scores; if it reaches another, it scores nothing. They speed up while you get them right. On a keyboard: numbers 1 to 9.»
- **Lluvia de estrellas** (sin reloj y sin penalización en puntos: un número equivocado no resta; cada estrella que toca el horizonte quita una de las 3 vidas):
  - ES: «Juegas hasta perder 3 vidas: cada estrella que toca el horizonte quita una. Un número equivocado no resta. Con teclado: escribe y pulsa Enter.»
  - EN: «You play until you lose 3 lives: each star that touches the horizon takes one. A wrong number costs no points. On a keyboard: type and press Enter.»

Las cifras salen de las constantes del juego (duración, rondas, vidas y penalizaciones). Una prueba fija que coincidan.

### 4.7 Guardagujas (3 rondas, mapa de 3 estaciones)

- **Mapa y ritmo:**
  - El mapa del nivel 1 sin espejo (`mapFor(3, false)`): el cambio 1 manda a la izquierda, a la estación roja (círculo), o sigue hacia el cambio 2, que manda a la amarilla (cuadrado) o a la verde (triángulo).
  - La velocidad es la del nivel 1. Ningún tren sale solo del túnel: cada ronda trae los suyos.
  - El patio es el del juego y corre en tiempo real: los trenes avanzan solos, el humo se apaga con movimiento reducido, y los toques y los números 1 a 9 mueven los cambios como en el juego.
- **Rondas:**
  1. **«Toca el cambio».** Un tren rojo espera fuera del túnel, justo antes del cambio 1, que lo mandaría a la estación amarilla. No se mueve mientras los cambios no lo lleven a la roja. En cuanto lo llevan, arranca y llega. Si el cambio vuelve atrás antes de que el tren lo cruce, el tren sigue el nuevo camino, y llegar a otra estación cuenta como un fallo.
  2. **«Ahora en marcha».** Un tren amarillo sale enseguida y los cambios lo llevan a la estación verde. Hay que mover el cambio 2 antes de que llegue a él, unos 3 s después.
  3. **«Dos trenes».** Un tren verde sale enseguida, rumbo a la estación amarilla: hay que mover el cambio 2. Uno rojo sale 4 s después (el intervalo del nivel 1) y necesita el cambio 1 de vuelta a la izquierda cuando el verde ya pasó.
- **Guía:**
  - Ronda 1: «Toca el cambio (el círculo con flecha) para que el tren rojo vaya a la estación roja, la del círculo» / «Tap the switch (the circle with an arrow) so the red train goes to the red station, the circle one».
  - Ronda 2: «Ahora el tren avanza solo: cambia la vía antes de que llegue al cambio» / «Now the train moves on its own: switch the track before it reaches the switch».
  - Ronda 3: «Pueden venir varios a la vez: lleva cada uno a su estación» / «Several can come at once: take each one to its station».
- **Al acertar:** la ronda acierta cuando todos sus trenes llegaron a su estación. La reacción es una por ronda, no por tren. Mientras dice «¡Bien!», el tren sigue entrando en la estación, como en el juego.
- **Sin puntos:** la marca de llegada muestra el visto o la ✕, nunca «+10».
- **Cambios quietos:** mientras dice «¡Bien!», y desde un fallo hasta que la ronda empieza de nuevo, los toques y las teclas no mueven los cambios.
- **Reloj:** avanza a lo sumo 100 ms de un cuadro al siguiente, así que con la app oculta la práctica simplemente se detiene.
- **Al fallar:**
  - Un tren en otra estación muestra la pista. Un segundo después, la ronda empieza de nuevo tal como empezó, y la pista sigue a la vista durante el nuevo intento.
  - Ronda 2: «El tren amarillo va a la estación amarilla, la del cuadrado. Inténtalo otra vez» / «The yellow train goes to the yellow station, the square one. Try again».
  - Rondas 1 y 3: «Cada tren va a la estación de su color y forma. Inténtalo otra vez» / «Each train goes to the station of its color and shape. Try again».
- **Construcción:** el juego y la práctica comparten el bucle del patio (`useSwitchyardWorld`). Los puntos y el nivel de su estado no se usan en la práctica.

### 4.8 Lluvia de estrellas (3 rondas)

- **Cielo y ritmo:**
  - El cielo es el del juego: las mismas estrellas en sus tres carriles, el cometa dorado, los estallidos, el horizonte y el teclado. Las teclas y el teclado en pantalla funcionan como en el juego.
  - Ninguna estrella nace sola: cada ronda trae las suyas, siempre las mismas, con resultados distintos entre sí.
  - Las estrellas tardan 14 s en caer. El juego empieza en 9 s: más despacio, porque la práctica enseña.
  - Con movimiento reducido, todo es como en el juego: las estrellas caen igual, y los destellos, las estelas y las chispas no se dibujan.
- **Rondas:**
  1. **«Revienta la estrella».** Una estrella, 3 + 4, flota quieta en el carril del medio, a un tercio de la altura del cielo. No cae y no se puede perder. 7 y OK (o Enter) la revientan.
  2. **«Ahora caen».** 5 + 2 cae por la izquierda desde el principio, y 9 − 3 por la derecha 2 s después. Hay que reventar las dos.
  3. **«El cometa».** 8 − 5 cae por la izquierda y 2 + 6 por la derecha; 1,5 s después, el cometa dorado 4 + 5 por el medio. Reventar el cometa revienta todas y la ronda acierta. Reventar antes una estrella normal también vale.
- **Guía:**
  - Ronda 1: «Escribe el resultado de la estrella y pulsa OK para reventarla» / «Type the star's answer and press OK to pop it».
  - Ronda 2: «Las estrellas caen: revienta las dos antes de que toquen el horizonte» / «The stars fall: pop both before they touch the horizon».
  - Ronda 3: «La estrella dorada es un cometa: si la revientas, revienta todas» / «The golden star is a comet: pop it and they all pop».
- **Al acertar:** la ronda acierta cuando todas sus estrellas reventaron. La reacción es una por ronda, no por estrella, como en Guardagujas; cada estrella reventada estalla como en el juego.
- **Sin puntos ni vidas:** nada muestra puntos ni vidas. Los puntos, las vidas y las pausas del estado del juego no se usan.
- **Teclas quietas:** mientras dice «¡Bien!», y desde que una estrella toca el horizonte hasta que la ronda empieza de nuevo, los números, el borrado y OK no hacen nada.
- **Reloj:** avanza a lo sumo 100 ms de un cuadro al siguiente, así que con la app oculta la práctica simplemente se detiene. En la ronda 1 no avanza.
- **Al fallar:**
  - Un número que no está en ninguna estrella muestra la pista, y la ronda sigue: las estrellas siguen cayendo.
    - Ronda 1: «Ese número no está en el cielo: 3 + 4 = 7. Inténtalo otra vez» / «That number isn't in the sky: 3 + 4 = 7. Try again».
    - Rondas 2 y 3: «Ese número no está en ninguna estrella. Inténtalo otra vez» / «That number isn't on any star. Try again».
  - Una estrella que toca el horizonte borra el cielo, como en el juego, y muestra «Si una estrella toca el horizonte, pierdes una vida. Inténtalo otra vez» / «If a star touches the horizon, you lose a life. Try again». Un segundo después, la ronda empieza de nuevo tal como empezó, con la respuesta escrita borrada.
  - La pista sigue a la vista hasta el próximo acierto o el cambio de ronda, también durante el nuevo intento.
- **Construcción:** el juego y la práctica comparten el bucle del cielo (`useStarSky`).

## 5. Diseño técnico

### 5.1 Marco común (`src/games/shared/practice/`)

- **`PracticeFrame`.** Arriba, «Práctica N de M» / «Practice N of M» y el botón «Saltar práctica». Debajo, la burbuja del guía, con `aria-live="polite"` y tono normal, de acierto o de pista. Después, la zona de juego y la zona de controles, con la misma disposición y los mismos `data-zone` que `GameFrame`. Incluye el destello de reacción de `GameFrame`, compartido y sin copiarlo. No tiene reloj, puntos ni nivel.
- **`usePracticeRounds(total, onComplete)`.** Lleva la ronda actual y el estado: esperando, acierto o pista. `answer(correct)` dispara la reacción, y luego avanza tras ~700 ms o se queda mostrando la pista. Si la ronda era la última, llama a `onComplete`. Sus temporizadores se limpian al desmontarse.
- **Interfaz de cada práctica:** `PracticeProps { onComplete: () => void; onSkip: () => void }`.

### 5.2 Por juego

- `src/games/<id>/Practice.tsx` con sus rondas como datos y su pantalla. Reusa `ArrowRow`/`ArrowIcon`, `Board`, `CardView`/`RuleIcon`, `SymbolGlyph`, `Keypad`, el formato de operaciones del juego, el patio de Guardagujas y el cielo de Lluvia de estrellas.
- `GameDefinition` gana `Practice?: ComponentType<PracticeProps>`, y `Example` pasa a ser opcional, solo para los juegos sin práctica (§3.6).
- Textos nuevos bajo `games.<id>.practice.*` (rondas, pistas y resumen) y `practice.*` (marco: entrada, «¡Listo!», «Saltar práctica», «Práctica N de M», «¡Bien!»).

### 5.3 Pantalla de juego (`PlayScreen`)

- **Fases:**
  - `intro`, que ahora distingue primera vez (entrada de práctica) de quien ya jugó;
  - `practice`, con origen `first` o `howTo`;
  - `practiceDone`, con el resumen y «Comenzar»;
  - `playing`, `result`, etc., como hoy.
- **Pausa:**
  - `Pause = 'off' | 'sheet' | 'practice' | 'resuming'`.
  - En `practice`, la práctica se dibuja en una capa encima del juego atenuado e inerte, y recibe el foco.
  - Al cerrar la práctica vuelve `sheet`.
  - `visibilitychange` no saca de `practice`.
- **`PauseOverlay`** gana `onHowToPlay`.
- **Marca de visto:** se guarda al completar o saltar desde la primera vez, como hoy hace `markInstructionsSeen` al comenzar.

## 6. Accesibilidad y movimiento

- **Guía:** sus mensajes se anuncian (`aria-live="polite"`).
- **Botones:** «Saltar práctica» y los controles miden al menos 44 px.
- **Foco:** al abrir la práctica desde la pausa, va a la práctica; al volver, a «Continuar».
- **Movimiento reducido:** igual que en los juegos. El destello se queda como opacidad y no hay sacudida.
- **Pantalla angosta:** sin desplazamiento lateral a 320 px, en español e inglés.

## 7. Pruebas

- **Marco:**
  - `usePracticeRounds` avanza al acertar, se queda y muestra la pista al fallar, y llama a `onComplete` al terminar la última ronda.
  - «Saltar práctica» llama a `onSkip`.
  - «Práctica N de M» se ve en cada ronda.
- **Cada práctica:**
  - Completarla acertando todas las rondas: `onComplete` se llama una vez.
  - Fallar muestra la pista esperada y repite la ronda.
  - Lo específico de cada juego: la secuencia se repite al fallar; el paso de recordar avanza solo; «Saltar» vale en la ronda 3 de Cálculo; el cartel cambia a FORMA en la ronda 3.
- **Pantalla de juego:**
  - Primera vez: entrada de práctica → práctica → «¡Listo!» con resumen → «Comenzar» → juego.
  - «Saltar práctica» empieza el juego y marca visto; la ✕ no marca.
  - Quien ya jugó: «¿Cómo se juega?» abre la práctica; saltarla vuelve a la entrada.
  - Pausa → «¿Cómo se juega?» → práctica → vuelta a la hoja, con el tiempo y los puntos iguales; ocultar la app no la cierra.
  - En modo diario funciona igual.
- **Textos:** cada juego del registro tiene `Practice` o `Example` (§3.6) y sus textos en ES y EN. El resumen nombra la penalización exacta de cada juego (reemplaza la prueba actual sobre las instrucciones).
- **E2E (Playwright):**
  - Una práctica completa de principio a fin, hasta el juego: Flechas, Guardagujas y Lluvia de estrellas.
  - Los ayudantes actuales usan «Saltar práctica» cuando aparece.
  - Objetivos táctiles de al menos 44 px en la práctica.
  - Sin desplazamiento lateral a 320 px en cada práctica, en ES y EN.
  - Capturas de cada práctica (una ronda con el guía y una con la pista) para la revisión del dueño.
