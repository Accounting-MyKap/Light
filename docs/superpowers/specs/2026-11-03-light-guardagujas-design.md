# Light: «Guardagujas», juego de trenes (atención dividida)

Fecha: 2026-11-03 · Estado: partes 1 y 2 aprobadas en la conversación; el dueño pidió seguir con la parte 3 y con la
implementación completa sin esperar la revisión escrita («que los mapas estén bien pulidos así como los trenes, que
estos trenes boten humo y que se distingan bien dónde están los puntos para cambiar la dirección»).

## 1. Propósito

El dueño quiere ir sumando a Light juegos del tipo de los de Lumosity, empezando por el de enrutar trenes («A todo
vapor»). Light hace un juego **propio** con esa mecánica: nombre, dibujos y aspecto propios, en el estilo Luz. No se
copia arte, nombre ni diseño de Lumosity.

**Éxito:** se siente como ese tipo de juego, cabe bien en un teléfono en vertical (y en el computador), los mapas y
los trenes se ven pulidos, los trenes echan humo, los cambios de vía se distinguen a simple vista, y pasan todas las
pruebas del proyecto.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre | **Guardagujas** (es) · **Switchyard** (en) · id `switchyard` |
| Área | Atención (`attention`, color Luz `#3fd4ff`), junto a Flechas |
| Temática | Trenes sobre vías con estaciones de colores, dibujos propios sobre el fondo de noche de Luz |
| Duración | **90 s** (los demás juegos duran 60 s; la app ya admite duraciones por juego y el servidor acepta 5 s–1 h) |
| Enfoque técnico | Mapas dibujados a mano + SVG + motor puro. Sin canvas ni librerías nuevas |

## 3. Cómo se juega

- Arriba hay un **túnel** del que salen los trenes, uno a la vez. Las vías bajan y se dividen en **cambios de vía**
  (agujas) hasta terminar en **estaciones**. El mapa es un árbol: N estaciones, N − 1 cambios, sin cruces.
- Cada estación tiene un **color y una forma** (círculo, cuadrado, triángulo, rombo, estrella, cruz, corazón), así se
  juega aunque cueste distinguir colores. Cada tren lleva el color de su estación y su forma en el vagón.
- **Tocar un cambio** alterna su dirección. Cuando la punta de un tren pasa por el punto del cambio, toma la dirección
  que el cambio tenga **en ese instante**. Teclado: las teclas `1`–`9` alternan el cambio N (el número se ve en el
  cambio solo con mouse/teclado); además cada cambio es un botón alcanzable con Tab.
- **Llegada:** a su estación → puntos, sonido de acierto, anillo verde con ✓ en la estación. A otra estación → fallo:
  sonido de error, anillo rojo con ✗, sin descuento. No se usa el destello ni la sacudida de toda la zona de juego:
  sacudir el mapa mientras se tocan cambios causaría toques equivocados, y un destello cada 2 s distrae.
- Al terminar el tiempo, los trenes en camino no cuentan ni a favor ni en contra.

## 4. Puntaje y dificultad

Niveles 1–10, interpolación lineal entre los extremos.

| Parámetro | Nivel 1 | Nivel 10 | Fórmula |
|---|---|---|---|
| Intervalo entre trenes | 4000 ms | 1600 ms | `round(4000 − (L−1)·2400/9)` |
| Velocidad | 70 u/s | 130 u/s | `70 + (L−1)·60/9` (u = unidad del tablero, 360 × 600) |
| Puntos por acierto | 10 | 28 | `10 + 2·(L−1)` |

- **Escalera dentro de la partida** (la de siempre, `stepStaircase`): un paso por cada tren que llega; 4 aciertos
  seguidos suben, 2 fallos seguidos bajan. El nivel actual fija velocidad, intervalo y puntos.
- La velocidad nueva se aplica **a todos los trenes a la vez**, así la distancia entre trenes se conserva. La menor
  separación posible es 1600 ms × 70 u/s = 112 u, más que el largo de un tren (66 u).
- **Mapa según el nivel inicial** (fijo durante la partida): niveles 1–2 → 3 estaciones, 3–4 → 4, 5–6 → 5, 7–8 → 6,
  9–10 → 7. Cada mapa tiene además su versión espejo; la partida elige una al azar.
- El primer tren sale a 1 s. Color al azar entre las estaciones del mapa, nunca 3 seguidos del mismo color.
- Cambios al empezar: dirección al azar.
- **Precisión** = aciertos ÷ trenes llegados. **Nivel alcanzado** = máximo de la escalera.
- **Puntaje de referencia 900** (área = 1000). **Puntaje máximo 2000** (techo teórico ≈ 57 trenes × 28 = 1596).
- Entre partidas rige `nextStartLevel` (≥ 85 % sube, < 60 % baja), así el mapa crece con los días.

## 5. Arquitectura

```
src/games/switchyard/
  geometry.ts   polilíneas con esquinas redondeadas, largo acumulado, punto y ángulo a cierta distancia, desplazamiento paralelo (rieles)
  maps.ts       los 5 planos dibujados a mano, su compilación a segmentos/cambios/estaciones, espejo, decoración (árboles)
  engine.ts     estado del juego, parámetros por nivel, alternar cambio, avanzar el tiempo, resultado
  smoke.ts      bocanadas de humo (emitir, envejecer); puro
  art.tsx       dibujos SVG: tren, estación, túnel, formas, árbol
  Board.tsx     el tablero: SVG por capas + botones HTML de los cambios encima
  Game.tsx      bucle de animación, reloj, teclado, reacciones
  Example.tsx   ejemplo de las instrucciones (tablero pequeño con un tren antes de un cambio)
  index.ts, switchyard.module.css
```

### 5.1 Mapas

- Plano = árbol escrito a mano en una rejilla de 360 × 500 y estirado un 20 % en vertical al tablero de 360 × 600 (cabe
  mejor en un teléfono vertical): cada tramo es una lista de puntos (vías rectas y diagonales) que va del punto anterior
  al siguiente nodo (cambio o estación). La raíz parte del túnel (arriba, al centro). Cada cambio está sobre una vía
  que llega hacia abajo y sus dos salidas también empiezan hacia abajo, así ningún tren gira bruscamente en un cruce.
- `compileMap` lo aplana: tramos con su polilínea ya redondeada (radio de curva 26 u, muestreada cada ≤ 3 u) y su
  largo; cambios con su punto, sus dos salidas y la dirección en pantalla de cada salida, medida a 48 u del cruce
  (8 rumbos, para el nombre accesible y la flecha); estaciones con color, forma y la combinación de cambios que lleva a ellas (`route`).
- `mirrorMap` refleja x → 360 − x.
- **Validez comprobada por pruebas** para los 10 mapas: N estaciones y N − 1 cambios; todo dentro del lienzo con
  margen; tramos que no se tocan salvo en sus extremos compartidos y que, a más de 70 u de un cruce compartido, quedan
  a ≥ 28 u entre sí; las dos salidas de un cambio apuntan a rumbos separados ≥ 35°; cambios a ≥ 70 u entre sí y de las estaciones;
  estaciones a ≥ 64 u entre sí; colores y formas sin repetir; cada estación alcanzable por una sola ruta.
- Decoración: árboles colocados por un azar con semilla fija en el espacio libre (≥ 30 u de vías, estaciones,
  túnel y cambios), así cada mapa siempre se ve igual.

### 5.2 Motor

```ts
interface Train { id: number; station: number; route: number[]; distance: number }  // route = tramos recorridos; distance en el último
interface Arrival { trainId: number; station: number; target: number; correct: boolean; at: number }
interface SwitchyardState { map; switches: (0|1)[]; trains; nextTrainId; nextSpawnAt; recentColors;
                            staircase; score; correct; total; now; arrivals: Arrival[] }
createSwitchyardGame(startLevel, rng, now) → estado
toggleSwitch(state, index) → estado
advanceSwitchyard(state, to, rng) → { state, arrivals }   // pasos internos de ≤ 20 ms
switchyardResult(state, durationMs) → GameResult
```

- Cada paso: sale un tren si toca; todos avanzan `velocidad·dt`; al pasar el final de un tramo que acaba en cambio,
  siguen por la salida elegida en ese momento con el sobrante; al pasar el final de un tramo que acaba en estación,
  cuenta la llegada (puntos, escalera). El tren sigue «entrando» bajo la estación hasta que su cola llega a ella y
  entonces desaparece.
- `trainPose(map, train, offset)` da posición y ángulo de un punto del tren (locomotora, chimenea, vagón) siguiendo
  su ruta hacia atrás, así el vagón dobla las curvas detrás de la locomotora.

### 5.3 Dibujo (Board)

Capas SVG, de abajo arriba: suelo (panel algo más claro que el fondo, puntos tenues y árboles) → vías (balasto,
durmientes, dos rieles paralelos) → discos de los cambios → trenes → humo → estaciones → boca del túnel → anillos de
llegada. Encima, un botón HTML transparente por cambio, en porcentajes del tablero.

- **Cambios bien visibles:** disco oscuro con aro del color del área y halo; una flecha blanca apunta a la salida
  elegida; un «faro» (anillo que se expande y se apaga cada 1,6 s) los marca como tocables. Además los rieles de la
  salida elegida brillan y los de la otra se ven apagados, así se lee la ruta completa de un vistazo. Al tocar, la
  flecha gira (150 ms). El área táctil es ≥ 44 px (14 % del ancho del tablero, mínimo 44 px) y tiene anillo de foco
  visible con teclado.
- **Trenes:** vistos desde arriba. Locomotora (35 u) del color de su estación con caldera, cabina, chimenea y farol
  delantero con haz de luz; vagón acoplado (26 u) con la forma en tinta oscura (siempre derecha). Brillo suave del
  color. Al entrar a la estación el farol se apaga y el tren se desvanece bajo el edificio.
- **Humo:** bocanadas suaves (degradado radial claro) salen de la chimenea cada 80 ms, crecen (3 → 15 u), derivan un
  poco y se desvanecen en 1,5 s, dejando una estela. Se dibujan bajo los trenes, para que nunca tapen una locomotora.
  Viven en el componente (no en el motor) y usan el reloj del juego, así se congelan en la pausa.
- **Estaciones:** casita del color con techo más oscuro y la forma en un círculo claro; resplandor del color.
- **Túnel:** portal de piedra con boca oscura; los trenes salen de ella.
- El tablero conserva su proporción (360 × 600) y ocupa el mayor tamaño que quepa en la zona de juego: el juego mide
  esa zona con `ResizeObserver` (las unidades `cqh` dan 0 ahí, porque la altura de la zona no es definida para CSS).
  Sin desplazamiento horizontal a 320 px.
- La marca de llegada (✓ o ✗ y «+N») se dibuja arriba y a un lado de la estación, fuera de la vía por la que entra el
  tren.

### 5.4 Movimiento reducido

Mover los trenes es el juego, así que siguen moviéndose. Se quitan: humo, faro de los cambios, giro animado de la
flecha y crecimiento de los anillos de llegada (solo aparecen y se apagan).

### 5.5 Marco común

`GameFrame` gana la propiedad opcional `stageFlash` (por defecto `true`); Guardagujas pasa `false` y dibuja sus
propias reacciones en la estación. Sonido y vibración siguen saliendo de `useFeedback` (acierto → `correct`, fallo →
`timeout`, que no sacude).

## 6. Integración

- `src/games/registry.ts`: se agrega `switchyardGame`.
- Textos `games.switchyard.*` en `es.json` y `en.json` (título, descripción, instrucciones, nombres de cambios y
  rumbos, ejemplo).
- Supabase: migración nueva `insert into public.games values ('switchyard', 'attention', 2000)` y la prueba pgTAP
  pasa a 6 juegos. **Hay que aplicar la migración en el proyecto de Supabase antes de unir a `main`** (ver README).
- e2e: los cambios de vía entran en la prueba de objetivos táctiles; captura de revisión de una partida en curso.

## 7. Pruebas

- `geometry.test.ts`: largo, redondeo de esquinas, punto/ángulo a distancia, desplazamiento.
- `maps.test.ts`: validez de los 10 mapas (§5.1), rutas, espejo, decoración fuera de las vías.
- `engine.test.ts`: parámetros por nivel, primer tren a 1 s e intervalos, el tren sigue el cambio en el instante en
  que pasa, llegada correcta/incorrecta y puntos, escalera, nunca 3 colores seguidos, separación mínima entre trenes
  con cambios y niveles al azar, un salto grande equivale a muchos pequeños, trenes en camino no cuentan, resultado.
- `smoke.test.ts`: ritmo de emisión, envejecimiento y descarte.
- `Game.test.tsx`: los cambios son botones con nombre; clic y teclas alternan; nada responde en pausa; termina una
  sola vez a los 90 s con `durationMs: 90000`; enrutar bien el primer tren suma puntos y muestra ✓.
- `GameFrame.test.tsx`: `stageFlash={false}` no dibuja destello.

## 8. Versión 2: trenes de perfil, mapas nuevos y pradera (revisión del dueño, 2026-11-03)

El dueño revisó la primera versión y pidió: trenes que se reconozcan como trenes y se vean de lado, mapas con más
tramos horizontales y estaciones también en los costados, más elementos naturales, y trenes que no parezcan
descarrilados en las curvas. Aprobó este diseño en la conversación.

- **Trenes de dos vagones articulados** (`sprite.ts`): locomotora (34 u) y vagón (21 u) se apoyan cada uno en la vía
  por sus dos extremos y se dibujan en el punto medio, así doblan juntos en las curvas. Con la vía a menos de 50° de la
  horizontal se ven **de perfil** (locomotora de vapor con cabina iluminada, caldera, cúpula, chimenea, farol con haz,
  barredor, ruedas con biela; vagón con la forma en un disco blanco), mirando hacia donde avanzan e inclinados
  exactamente como la vía. Más empinada, el tren viene hacia quien juega y se ve **de frente** (puerta de la caja de
  humo con la forma de su estación, chimenea, dos faroles, haz hacia abajo).
- **Humo**: sube desde la chimenea y se queda atrás (de frente, sube derecho); en el juego se dibuja en un `<canvas>`
  con una bocanada ya pintada que se estampa, para no tocar los elementos de la página en cada cuadro.
- **Mapas nuevos** (los 5, con espejo, en coordenadas del tablero 360 × 600): vías horizontales y verticales unidas
  por diagonales y curvas; estaciones en ambos costados (x 36 / 324, a las que se llega cruzando) y abajo (y 548).
  Prueba nueva: en cada ruta, al menos el 15 % del recorrido va de lado.
- **Pradera de noche**: suelo verde azulado con manchas de pasto, estanques con la luna reflejada, nenúfar y juncos,
  pinos y árboles redondos de pie, arbustos (algunos con bayas), rocas, flores y matas de pasto, y luciérnagas que
  titilan (quietas con movimiento reducido). Todo lo coloca un generador con semilla fija por mapa, fuera de vías,
  estaciones, cambios, túnel y estanques, y se dibuja de atrás hacia adelante.
- **Rendimiento**: el tablero son tres dibujos apilados (pradera y vías; trenes y marcas; estaciones y túnel) en capas
  propias, con las luciérnagas y el faro de los cambios como elementos HTML animados por el navegador; los botones y
  discos de los cambios no se vuelven a dibujar en cada cuadro. Con la CPU 4× más lenta y la compilación de
  producción, el trabajo por cuadro bajó de 31–34 ms (versión 1) a ≈ 28 ms con toda la pradera.

## 9. Túneles laterales, estación central y margen para reaccionar (pedido del dueño, 2026-11-03)

- **Túnel en un costado** en los niveles 3–4 (4 estaciones) y 7–8 (6 estaciones): la boca queda en x 40 (o 320 en el
  espejo), mirando hacia el centro, y los trenes entran cruzando la parte de arriba del mapa, de perfil. El portal se
  dibuja girado, un poco menos profundo, en un montículo de pasto. Los niveles 1–2 conservan el túnel arriba al centro.
- **Estación en el medio del mapa** en los niveles 5–6 (5 estaciones) y 9–10 (7 estaciones), rodeada por las vías que
  van a las demás.
- Cada mapa guarda su túnel (`TrackMap.tunnel`: punto y rumbo); el espejo lo refleja. Pruebas nuevas: al menos dos
  tamaños de mapa con túnel lateral (izquierdo y derecho entre los espejos) y al menos dos con estación central.
- **Margen para reaccionar** (`SWITCH_GRACE` = 24 u): si se cambia un cambio de vía mientras un tren todavía está
  encima de él (su frente lo pasó por 24 u o menos, entre 0,18 y 0,34 s según la velocidad), el tren toma la nueva
  salida a la misma distancia. Esto reemplaza la regla de la §3 («toma la dirección que el cambio tenga en ese
  instante»): ahora vale la dirección que tenga cuando el tren termina de pasar por encima.
