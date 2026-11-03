# Light: estilo «Luz» para los juegos

Fecha: 2026-11-02 · Estado: diseño aprobado por partes en la conversación; pendiente de revisión escrita.

Maqueta de referencia (privada, del dueño del proyecto): https://claude.ai/artifact/RU2nAYXHSparZCR2F2w8hN — sus tres versiones mostraron los estilos candidatos, los cinco juegos y las pantallas que rodean la partida.

## 1. Propósito

Los juegos hoy se ven planos: un solo color de acento (amarillo) para todo, la mitad inferior de la pantalla vacía, un marcador con números sueltos y ninguna reacción visible al acertar o fallar (solo sonido). El dueño pidió mejorar «mucho más» las visuales y marcó las cuatro carencias:

1. **Que se sientan vivos:** reacción visible al acertar y al fallar.
2. **Color e identidad:** cada juego con su propio color.
3. **Aprovechar la pantalla:** el juego ocupa el teléfono; controles cerca del pulgar.
4. **Pulido general:** barra de tiempo, tipografía, transiciones.

**Éxito:** al jugar en un teléfono, cada juego se reconoce por su color, la pantalla está aprovechada de arriba abajo, cada acierto y cada error se notan (vista, sonido, vibración) y el dueño aprueba las capturas de los cinco juegos. Las reglas, puntajes, niveles y la sincronización no cambian.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Estilo | **Luz**: fondo de noche; cada juego brilla con el color de su área (elegido entre Luz, Juguete y Sereno). |
| Alcance | **Juego completo:** presentación e instrucciones, partida, pausa y resultado. Hoy, Juegos, Progreso y Ajustes quedan como están (salvo el interruptor nuevo de vibración). |
| Modo claro | **Siempre de noche:** las pantallas de juego son oscuras aunque el teléfono o la app estén en modo claro. El resto de la app sigue el tema elegido. |
| Vibración | Sí, con interruptor propio «Vibración» en Ajustes, encendido por defecto. |
| Enfoque técnico | Base Luz compartida (CSS + React) y rediseño de cada juego encima. Sin canvas/WebGL ni librerías de animación. |

## 3. La base Luz (común a todo)

### 3.1 Ámbito y colores

- Toda la pantalla de juego (`PlayScreen`, todas sus fases) se envuelve en un contenedor `data-luz` con `data-area="<área>"`. Dentro de él rigen los tokens de Luz, independientes del tema de la app.
- Mientras ese contenedor existe, la raíz del documento recibe un marcador (`data-luz` en `<html>`) que pinta el fondo de la página con el de Luz (evita destellos claros al desplazar o al rebotar) y `<meta name="theme-color">` pasa a `#090b19`. Al salir del juego se restauran ambos valores anteriores.

Tokens de Luz:

| Token | Valor | Uso |
|---|---|---|
| `--luz-bg` | `#090b19` | Fondo. Arriba lleva un resplandor radial del color del área (≈28 % de opacidad, se desvanece hacia el 60 % de la altura). |
| `--luz-text` | `#eef1ff` | Texto principal. |
| `--luz-muted` | `#8e94b8` | Texto secundario (nivel, etiquetas). |
| `--luz-glass` | `rgba(255,255,255,.045)` + borde interior `rgba(255,255,255,.09)` | Superficies: casillas, tarjetas, teclas. |
| `--luz-ok` | `#4dffa6` | Acierto (destello, «+N», «¡Perfecto!»). |
| `--luz-bad` | `#ff5d7a` | Error (pulso, «−N», barra de tiempo en los últimos 10 s). |
| `--luz-ink` | `#0b0d1a` | Texto sobre botones rellenos del color del área. |
| `--game` | según área | Color del juego. |

Colores por área (`--game`):

| Área | Juego | Color |
|---|---|---|
| memory | Secuencia de luces | ámbar `#ffb52e` |
| attention | Flechas | cian `#3fd4ff` |
| speed | ¿Igual o distinto? | magenta `#ff5fd2` |
| flexibility | Cambio de regla | violeta `#a98bff` |
| math | Cálculo relámpago | verde lima `#8dff6a` |

Contraste mínimo (lo comprueba la prueba de contraste existente, ampliada): texto y texto secundario sobre el fondo ≥ 4,5:1; cada color de área sobre el fondo ≥ 3:1 (elementos gráficos y texto grande); `--luz-ink` sobre cada color de área ≥ 4,5:1; `--luz-ok` y `--luz-bad` sobre el fondo ≥ 3:1.

### 3.2 Distribución de la pantalla de juego (marco común)

De arriba abajo, ocupando toda la altura visible (`100dvh`) con márgenes de zona segura:

1. **Barra superior:** ✕ (abre la pausa), nombre del juego con «Nivel N» debajo en texto secundario, y una píldora con los puntos.
2. **Progreso:** en juegos con tiempo, una **barra de tiempo** del color del área que se vacía de forma continua; en los últimos 10 s se tiñe hacia `--luz-bad` y late. En Secuencia de luces, que va por rondas, son **8 puntitos**: los completados encendidos, el actual «respirando».
3. **Zona de juego:** ocupa todo el espacio libre.
4. **Controles:** abajo, al alcance del pulgar.

La barra de tiempo expone a lectores de pantalla los segundos que quedan (texto accesible actualizado por segundo, sin anuncios en vivo).

### 3.3 Reacción al acertar y al fallar

| Evento | Vista | Sonido | Vibración |
|---|---|---|---|
| Acierto | Destello verde que sale del centro de la zona de juego; «+N» flota desde la píldora de puntos. | tono de acierto (como hoy) | toque corto (~12 ms) |
| Error | Pulso rojo y sacudida corta de la zona de juego; «−N» flota desde la píldora. | tono de error (como hoy) | doble (~30, 50, 30 ms) |
| Tiempo agotado en una respuesta | Solo pulso rojo (sin sacudida). Sin número: no resta puntos. | tono de error | doble |

- El número flotante sale de la diferencia real de puntos (si los puntos no cambian, no hay número; si suben más de 10 por la racha, muestra el valor real).
- El sonido respeta el interruptor de sonido actual; la vibración, el nuevo interruptor. Donde `navigator.vibrate` no existe (iPhone), no pasa nada.

### 3.4 Tipografía

- **Sora** (variable, solo alfabeto latino) en todas las pantallas de juego; el resto de la app conserva la letra del sistema.
- La letra se empaqueta con la app (paquete npm de Fontsource, versión fija) y se agrega `woff2` a los archivos que guarda el service worker, para que funcione sin conexión.
- Si la letra no carga, se usa la del sistema.

### 3.5 Movimiento y accesibilidad

- Con `prefers-reduced-motion: reduce`: sin sacudidas, sin números volando, sin rayos ni chispas, sin conteo del puntaje (se muestra el final) y sin cuenta regresiva animada (la cuenta sigue existiendo, sin escalado); solo cambian los colores.
- Los controles siguen siendo `<button>` reales con sus textos accesibles actuales; el teclado sigue funcionando como hoy (`useGameKeys`).
- Los objetivos táctiles conservan al menos 44 px (prueba e2e existente).

## 4. Los cinco juegos

Comunes: zona de juego y controles según §3.2; superficies de cristal (`--luz-glass`) con radio grande; lo que «se enciende» lleva el color del área con halo (`box-shadow` del mismo color).

### 4.1 Secuencia de luces (ámbar)

- El tablero se alinea abajo, en la zona del pulgar, y crece a 4×4 y 5×5 con el nivel (como hoy).
- Casilla encendida: color del área con halo y un borde interior claro. Casilla tocada: se hunde un instante.
- Texto de estado arriba del tablero: «Observa…», «Tu turno», «¡Perfecto!» (este último en `--luz-ok`).
- Al completar bien la ronda, todas las casillas del recorrido se encienden juntas durante la pausa entre rondas que ya existe (600 ms); no se agrega tiempo.
- Progreso: los 8 puntitos de ronda (§3.2).

### 4.2 Flechas (cian)

- La fila de cinco flechas va sobre una tarjeta de cristal en el centro; la flecha del centro brilla en el color del área y las de los lados quedan en `--luz-text`.
- Botones «Izquierda» y «Derecha» grandes, con contorno luminoso del color del área, abajo.

### 4.3 ¿Igual o distinto? (magenta)

- Los símbolos pasan de relleno a **trazo de neón** del color del área con halo (las figuras con punto conservan el punto relleno).
- Cada símbolo nuevo entra deslizándose desde la derecha, para que el cambio se note aunque sea igual al anterior.
- La racha aparece como píldora «Racha ×2» / «Racha ×3» (solo cuando el multiplicador es 2 o más) y salta al subir.
- Botones «No» y «Sí» abajo, con contorno luminoso.

### 4.4 Cambio de regla (violeta)

- La regla es una píldora rellena del color del área; cuando cambia, gira como un cartel y destella (se conserva la corrección que evita que los carteles se acumulen).
- La carta central lleva halo del color del área; las dos opciones van abajo, en la zona del pulgar, y son los controles.
- Las cartas mantienen sus colores de estímulo (azul, naranja, morado) y sus tramas (sólido, rayas, puntos) para quien no distingue colores; el contorno de las figuras pasa a `--luz-text`.

### 4.5 Cálculo relámpago (verde lima)

- La operación va grande en el centro; la respuesta se escribe en una ranura con subrayado luminoso.
- Teclado de cristal abajo; la tecla OK va rellena del color del área con `--luz-ink`. «Saltar» queda como texto pequeño bajo el teclado.
- Al acertar, la operación destella y la siguiente entra desde abajo.

## 5. Pantallas alrededor de la partida

### 5.1 Presentación e instrucciones

- Etiqueta del área (contorno y punto del color del área), título grande y pasos numerados (los textos actuales de `instructions`).
- El ejemplo de cada juego pasa a ser una **mini escena animada** en bucle dentro de una tarjeta de cristal (por ejemplo, la flecha del centro que late; las casillas que se encienden en orden). Con movimiento reducido queda fija.
- «Comenzar» es una píldora rellena del color del área, abajo. Quien ya jugó ve título, descripción, «Comenzar» y «¿Cómo se juega?», como hoy.

### 5.2 Pausa

- El juego queda detrás, oscurecido y desenfocado.
- Hoja central con «Pausado», el tiempo que queda (en juegos con tiempo) y los puntos actuales, y los botones «Continuar» (relleno) y «Salir del juego».
- Al continuar, una **cuenta regresiva 3, 2, 1** (un segundo cada número) antes de que el juego siga; el tiempo del juego permanece detenido durante la cuenta. Si la app pasa a segundo plano durante la cuenta, se vuelve a la hoja de pausa.

### 5.3 Resultado

- El puntaje grande cuenta desde 0 hasta el total (~1,2 s, desacelerando). El valor final está siempre disponible para lectores de pantalla.
- Con récord nuevo: rayos de luz que giran detrás del puntaje, chispas y «¡Nueva mejor marca!» en el color del área.
- La línea de percentil se mantiene (aparece cuando el servidor responde).
- Precisión y nivel alcanzado (y la mejor marca, si no hubo récord) en tarjetas de cristal.
- Entrenamiento diario: indicador de avance «Entrenamiento de hoy: N de 3» y «Siguiente juego» o «Ver resumen». Juego libre: «Jugar de nuevo» (relleno) y «Volver».

## 6. Ajustes

- Nuevo interruptor «Vibración» (EN «Vibration») junto al de sonido, encendido por defecto, con la nota «Solo en teléfonos que lo permiten» (EN «Only on phones that support it»).
- `Settings` gana `vibration: boolean` (por defecto `true`); las configuraciones guardadas sin ese campo lo leen como `true`.

## 7. Diseño técnico

### 7.1 Piezas nuevas

| Pieza | Responsabilidad |
|---|---|
| Hoja de estilos Luz | Tokens de §3.1, colores por `data-area` y la letra Sora, limitados a `[data-luz]`. |
| `LuzScope` | Envuelve `PlayScreen`; pone `data-luz` y `data-area`; mientras está montado marca la raíz del documento y cambia `theme-color`, y los restaura al desmontarse. |
| Contexto de partida | Lo provee `PlayScreen`: nombre del juego, acción de pausa y un canal para que el marco informe puntos y tiempo restante (los usa la hoja de pausa). |
| `GameFrame` | Marco común (§3.2): barra superior, barra de tiempo o puntitos de ronda, zona de juego, controles y capa de reacción (destello, pulso, sacudida, número flotante). Reemplaza a `GameHud`. |
| Reacción (`useFeedback`) | Pasa a aceptar `'correct' | 'wrong' | 'timeout'`; dispara sonido, vibración y la capa visual del marco. Los juegos llaman `'timeout'` donde hoy llaman `'wrong'` por tiempo agotado. |
| Vibración | Función que llama a `navigator.vibrate` con el patrón de §3.3 si existe y si el ajuste está activo. |
| Conteo del puntaje | Hook que anima un número hasta su valor final; con movimiento reducido devuelve el final de inmediato. |

### 7.2 Cambios en lo existente

- Los cinco `Game.tsx` usan `GameFrame` y sus estilos se rehacen según §4. Los motores (`engine.ts`) no cambian.
- Los cinco `Example.tsx` se animan con CSS.
- `PlayScreen`: envuelve sus fases en `LuzScope`; la barra superior pasa al marco; la pausa gana la cuenta regresiva.
- `PauseOverlay`, `Instructions` y `ResultView` se rehacen según §5; `ResultView` recibe el avance del entrenamiento diario (ya disponible en el plan que devuelve el registro del resultado).
- `symbols.tsx` de ¿Igual o distinto? pasa a trazo.
- Configuración del service worker: agregar `woff2`.
- Textos nuevos en ES y EN (interruptor y nota de vibración, «Racha ×N», «Entrenamiento de hoy: N de M», «quedan» y «puntos» en la hoja de pausa), con la prueba de paridad vigente. La cuenta regresiva solo muestra números y no agrega textos; es decorativa para lectores de pantalla (el foco vuelve al juego al terminar).

### 7.3 Fuera de alcance

- Rediseño de Hoy, Juegos, Progreso y Ajustes (más allá del interruptor).
- Una versión clara de Luz.
- Sonidos nuevos.
- Cambios de reglas, puntajes, niveles, tiempos o sincronización.

## 8. Pruebas

- **Se mantienen** todas las pruebas actuales de los cinco juegos, de `PlayScreen` y de Ajustes (se basan en roles y textos). Donde cambie un texto o un rol, se actualiza la prueba con el nuevo comportamiento acordado aquí, nunca para tapar una regresión.
- **Nuevas pruebas unitarias:**
  - `GameFrame` muestra la barra de tiempo con los segundos accesibles y los 8 puntitos en Secuencia.
  - Al cambiar los puntos aparece «+N» o «−N» con la diferencia real; sin cambio no aparece nada.
  - La reacción llama al sonido y a la vibración solo con sus interruptores activos, y no falla sin `navigator.vibrate`.
  - La cuenta regresiva de la pausa reanuda solo al terminar y vuelve a la hoja si se oculta la app.
  - El resultado expone el puntaje final de inmediato a lectores de pantalla.
  - `LuzScope` restaura `theme-color` y la raíz al desmontarse.
  - Ajuste de vibración: por defecto `true`, se guarda y se lee.
- **Contraste:** la prueba de tema se amplía a los tokens de Luz con los mínimos de §3.1.
- **E2E (Playwright):** con la app en modo claro, la pantalla de juego tiene fondo oscuro; los objetivos táctiles siguen ≥ 44 px; se toman capturas de los cinco juegos (en juego y en resultado) para la revisión del dueño.
