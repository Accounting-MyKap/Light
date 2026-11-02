# Light — Sección «Preguntas»: trivia general y contabilidad

**Fecha:** 2026-11-02
**Estado:** Secciones 2, 3 y 4 (mecánica, contenido y pantallas) aprobadas por el usuario en el chat. La sección 5
(datos, código, Supabase y pruebas) la decidió Claude a pedido del usuario («planifica todo lo demás») y queda
**pendiente de su revisión**.
**Relación con la spec original:** amplía `2026-10-18-light-brain-training-design.md` sin cambiar el
entrenamiento diario, la racha, los juegos existentes ni el puntaje por área.

---

## 1. Propósito y criterios de éxito

Una sección nueva de Light con preguntas de opción múltiple por categorías, contra el reloj, en dos bloques:

- **Cultura general:** para cualquier jugador de Light.
- **Contabilidad:** para que un equipo contable practique y repase conocimientos útiles en su día a día.

Es un juego de trivia propio. Toma el estilo de los juegos de preguntas por categorías, pero no copia los
personajes, la ruleta ni las coronas de ningún juego existente.

**Decisiones del usuario (resumen):**

| Tema | Decisión |
|---|---|
| Bloques | Cultura general (8 categorías) y Contabilidad (4 subcategorías), cada uno con su «Mezcla» |
| Público de Contabilidad | Un equipo contable que practica para el trabajo |
| Normativa contable | Conceptos universales, Colombia, EE. UU. (US GAAP) y cartera/préstamos |
| Idiomas | Todo en español e inglés, como el resto de la app |
| Relación con el entrenamiento diario | Sección aparte: no entra al plan diario ni a la racha |
| Uso en equipo | Cada persona practica sola; sin nombres, sin ranking y sin vista de administrador |
| Volumen al lanzar | ~1.200 preguntas: 100 por cada una de las 12 categorías |
| Enfoque técnico | Enfoque A: juegos de preguntas registrados sobre la base actual de Light |

**Criterios de éxito:**

1. Desde la pestaña **Preguntas**, cualquiera juega una ronda de 10 preguntas de cualquiera de las 14 opciones
   (12 categorías y 2 mezclas). No necesita registrarse y, después de la primera carga, tampoco internet.
2. Al lanzar hay **1.200 preguntas**: 100 por categoría (40 fáciles, 40 medias y 20 difíciles), todas en ES y
   EN. Las pruebas automáticas validan su formato.
3. Cada respuesta muestra la opción correcta y una explicación breve. Al final de la ronda se repasan los errores.
4. Una pregunta no se repite mientras queden preguntas sin ver en esa categoría.
5. El entrenamiento diario, la racha, la pestaña Juegos, los días entrenados y el puntaje por área se
   comportan exactamente igual que antes.
6. Ninguna pregunta contable llega a `main` (es decir, a los jugadores) sin la revisión del equipo contable.
7. Agregar preguntas solo requiere editar el JSON de su categoría y su tamaño en el manifiesto. No se toca
   código.
8. El costo mensual sigue siendo USD 0.

## 2. Mecánica de una ronda

**Ronda:**
- Cada ronda tiene **10 preguntas**.
- Cada pregunta muestra el enunciado, una etiqueta con su categoría y las opciones.
- Las preguntas de opción múltiple tienen 4 opciones, mostradas en orden aleatorio. Las de verdadero/falso
  tienen 2, siempre en el orden «Verdadero, Falso».
- Hay **20 segundos por pregunta**, con una barra que muestra el tiempo restante.

**Al responder:**
- El reloj de la pregunta se detiene.
- Se marca la opción correcta y, si el jugador falló, también la suya.
- Aparece la explicación.
- El botón «Siguiente» pasa a la pregunta siguiente.

**«No sé»:**
- Muestra la respuesta y la explicación sin restar puntos.
- Es el equivalente honesto del «Saltar» de Cálculo relámpago.

**Tiempo agotado:**
- Cuenta como fallo para la precisión, pero no resta puntos.
- Muestra la respuesta y la explicación.

**Puntaje** (la regla de Light: adivinar al azar debe dar en promedio unos 0 puntos):

| Caso | Puntos |
|---|---|
| Acierto | 20 + bonus de rapidez de 0 a 10. Se calcula con `speedBonus(rt, 20 000)`, la misma función de Flechas y Cambio de regla |
| Error en opción múltiple | −10, porque 0,25 × 30 − 0,75 × 10 = 0 |
| Error en verdadero/falso | −30, porque 0,5 × 30 − 0,5 × 30 = 0 |
| «No sé» o tiempo agotado | 0 |

- El puntaje nunca baja de 0.
- El máximo por ronda es **300**.
- Una respuesta dada antes de 150 ms (`MIN_RT_MS`) desde que aparece la pregunta se ignora, porque suele ser un
  doble toque accidental.

**Dificultad:**
- Cada pregunta tiene una etiqueta: fácil (1), media (2) o difícil (3).
- El nivel 1–10 de Light decide la probabilidad de cada dificultad:

| Nivel | Fácil | Media | Difícil |
|---|---|---|---|
| 1–3 | 70 % | 30 % | 0 % |
| 4–7 | 20 % | 60 % | 20 % |
| 8–10 | 0 % | 40 % | 60 % |

- El nivel cambia dentro de la ronda con la escalera de siempre: 4 aciertos seguidos lo suben y 2 fallos
  seguidos lo bajan. «No sé» y el tiempo agotado cuentan como fallo.
- Entre partidas cambia según la precisión (≥ 85 % sube, < 60 % baja), como en los demás juegos.
- `levelReached` es el nivel máximo alcanzado.
- `accuracy` es el número de aciertos dividido entre 10.

**Al terminar:**
- La pantalla de resultado normal de Light: puntaje, mejor marca, precisión y percentil.
- Debajo, **«Repasa tus errores»**: cada pregunta fallada, sin respuesta o con «No sé», con la respuesta del
  jugador, la correcta y la explicación.

## 3. Contenido

### 3.1 Categorías

| Bloque | Categoría (id) | Qué incluye |
|---|---|---|
| Cultura general | Historia (`history`) | Historia universal y de América Latina, incluida Colombia |
| | Ciencias (`science`) | Física, química, biología, astronomía, cuerpo humano |
| | Geografía (`geography`) | Países, capitales, ríos, montañas, regiones |
| | Matemáticas (`math`) | Conceptos, geometría, cálculo sencillo, historia de las matemáticas |
| | Arte y literatura (`arts`) | Pintura, autores y obras, música clásica, mitología |
| | Entretenimiento (`entertainment`) | Cine, música y televisión |
| | Deportes (`sports`) | Mundiales, Juegos Olímpicos, reglas de cada deporte |
| | Tecnología (`technology`) | Inventos, computación, historia de internet |
| Contabilidad | Conceptos (`concepts`) | Partida doble, ecuación contable, causación vs. caja, depreciación, conciliaciones, estados financieros, razones financieras básicas |
| | Colombia (`colombia`) | Clases del PUC, grupos NIIF (Ley 1314 de 2009), IVA, retención en la fuente, ICA, RUT, factura y nómina electrónica, revisor fiscal |
| | EE. UU. (`us`) | US GAAP y FASB, temas ASC (606, 842, 326/CECL), formularios 1099, W-9, 1120 y 1065, sales tax vs. use tax, conceptos de QuickBooks |
| | Cartera y préstamos (`lending`) | Capital e interés, amortización, APR vs. tasa nominal, payoff, aging 30/60/90, mora, provisiones y castigos, LTV y DTI, bases 30/360 vs. actual/365, pagos balloon |

### 3.2 Reglas de calidad

- **Reparto por dificultad al lanzar:** 40 fáciles, 40 medias y 20 difíciles por categoría.
- **Preguntas de verdadero/falso:** como máximo el 25 % de cada categoría.
- **Solo datos estables y verificables:**
  - Nada de «el récord actual» ni «la película más taquillera», porque cambian.
  - Nada de temas políticamente divisivos ni preguntas ambiguas.
  - Cada pregunta tiene una sola respuesta defendible.
  - No se usan «todas las anteriores» ni «ninguna de las anteriores».
- **Distractores creíbles:** las opciones incorrectas deben parecer posibles.
- **Contabilidad sin cifras que cambian cada año:** ni valor de la UVT, ni tarifas de retención vigentes, ni
  topes del IRS.
  - Si una pregunta depende de una norma que puede cambiar (por ejemplo, el IVA general del 19 %), la
    explicación cita la norma.
  - Esa pregunta lleva `asOf` (por ejemplo, `"2026-11"`), que se muestra como «Vigente a noviembre de 2026».
- **El inglés se adapta, no se traduce literalmente.** En las preguntas de Colombia, la versión en inglés aclara
  los términos locales, por ejemplo «PUC (Colombia's chart of accounts)».
- **El repositorio es público**, así que no incluye procesos internos, nombres de clientes ni datos de ninguna
  empresa. Solo conocimiento general del oficio.
- **Largos máximos**, en ambos idiomas: enunciado ≤ 160 caracteres, opción ≤ 60 y explicación ≤ 220.

Estas reglas, con ejemplos buenos y malos, quedan en `docs/quiz/guia-de-contenido.md`. Esa guía la siguen
quienes escriben y quienes revisan preguntas.

### 3.3 Formato

Hay un archivo JSON por categoría: `src/quiz/banks/<categoría>.json`.

- En las preguntas de opción múltiple, **la respuesta correcta va siempre primero** en `options`. La app baraja
  las opciones al mostrarlas.
- Las de verdadero/falso llevan `answer` en lugar de `options`.

```json
{
  "category": "history",
  "questions": [
    {
      "id": "history-0042", "difficulty": 2, "type": "choice",
      "es": { "question": "¿En qué año cayó el Muro de Berlín?",
              "options": ["1989", "1991", "1985", "1979"],
              "explanation": "Cayó el 9 de noviembre de 1989; Alemania se reunificó en 1990." },
      "en": { "question": "In what year did the Berlin Wall fall?",
              "options": ["1989", "1991", "1985", "1979"],
              "explanation": "It fell on 9 November 1989; Germany reunified in 1990." }
    },
    {
      "id": "history-0043", "difficulty": 1, "type": "truefalse", "answer": false,
      "es": { "question": "Cristóbal Colón llegó a América en 1592.",
              "explanation": "Llegó en 1492, en su primer viaje financiado por los Reyes Católicos." },
      "en": { "question": "Christopher Columbus reached the Americas in 1592.",
              "explanation": "He arrived in 1492, on his first voyage funded by the Catholic Monarchs." }
    }
  ]
}
```

- `id`: `<categoría>-NNNN`, único en todos los bancos. Nunca se reutiliza un id borrado, porque el historial
  local lo recuerda.
- `asOf` (opcional): `YYYY-MM`.
- `src/quiz/banks/manifest.ts` guarda el tamaño de cada banco. La pantalla Preguntas lo usa para mostrar
  «Vistas: N de M» sin cargar los bancos. Una prueba comprueba que coincida con el archivo.

### 3.4 Proceso de escritura y revisión

1. **Redacción:** Claude redacta cada categoría por lotes, siguiendo la guía de contenido.
2. **Verificación independiente:** una segunda pasada, con un revisor que no escribió el lote, comprueba que:
   - el dato sea correcto y la respuesta sea única;
   - los distractores sean incorrectos pero creíbles;
   - la dificultad esté bien asignada;
   - ES y EN digan lo mismo.

   Se corrige o se reemplaza lo que no pase.
3. **Revisión del equipo contable:** para las 4 subcategorías de Contabilidad se genera una **hoja de Excel de
   revisión** con estas columnas:
   - id, subcategoría y dificultad;
   - pregunta, opciones (la correcta marcada) y explicación, en ES y EN;
   - `asOf`;
   - «OK / corrección».

   El equipo la diligencia y Claude aplica las correcciones. **La rama no se une a `main` hasta que las 400
   preguntas contables estén aprobadas.**
4. **Validación automática** (§6): formato, largos, ids únicos, reparto por dificultad, proporción de
   verdadero/falso y tamaños del manifiesto.

## 4. Pantallas

**Navegación:**
- Una pestaña nueva, **Preguntas** (EN: «Quiz»), entre Juegos y Progreso:
  `Hoy · Juegos · Preguntas · Progreso · Ajustes`.
- La barra pasa de 4 a 5 columnas. En un celular de 320 px las cinco caben, con al menos 44 px de alto cada una.

**Pantalla Preguntas** (`/#/quiz`):
- Dos bloques: Cultura general y Contabilidad.
- Cada bloque empieza con su tarjeta **Mezcla** (destacada) y sigue con sus categorías.
- Cada tarjeta muestra:
  - nombre y descripción corta;
  - mejor marca («Mejor marca: —» si no hay ninguna);
  - **«Vistas: N de M»**: preguntas distintas respondidas en esa categoría (en la Mezcla, en todo el bloque),
    contra el total del banco.
- Al tocar una tarjeta se abre `/#/play/<id>`.

**Partida:** reutiliza `PlayScreen`: instrucciones con ejemplo la primera vez, pausa automática al ocultar la
pestaña y salida con ✕.

- **Arriba:**
  - El HUD de siempre: tiempo restante de la pregunta en segundos, puntos y nivel.
  - La línea «Pregunta N de 10».
  - Una barra de tiempo.
- **Tarjeta de la pregunta:** la categoría en mayúsculas pequeñas y el enunciado.
- **Opciones:**
  - Van una debajo de otra, a todo el ancho, numeradas 1–4 (o 1–2).
  - Cada una es un botón de al menos 44 px de alto, y un texto largo puede ocupar varias líneas.
- **Botón «No sé»:** debajo de las opciones.
- **Después de responder:**
  - La opción correcta lleva «✓ Correcta».
  - La del jugador, si fue errónea, lleva «✗ Tu respuesta». Si se acabó el tiempo aparece «Se acabó el
    tiempo».
  - Debajo van la explicación y, si existe, la línea «Vigente a {mes} de {año}».
  - Luego el botón «Siguiente».
- **Teclado:** `1`–`4` eligen una opción, `0` es «No sé» y `Enter` es «Siguiente».
- Después de la décima pregunta, el botón «Siguiente» se llama «Ver resultado».

**Resultado:**
- La vista de resultado de siempre.
- Debajo, la sección «Repasa tus errores». Si no hubo errores: «¡Sin errores en esta ronda!».
- «Volver» lleva a `/#/quiz`, no a `/#/games`. La ✕ dentro de una partida abierta sin historial también vuelve a
  `/#/quiz`.

**Progreso:**
- **Lo de entrenamiento queda igual**:
  - Racha, días entrenados, puntaje por área y gráficos por juego.
  - «Días entrenados» y «Por juego» cuentan **solo los juegos de entrenamiento**.
- **Bloque nuevo «Preguntas»** (aparece solo si hay alguna partida de preguntas), con Cultura general y
  Contabilidad. Para cada categoría con datos muestra:
  - **Dominio:** porcentaje de aciertos de los últimos 30 días, como barra de 0 a 100 %. Cuenta todas las
    preguntas de esa categoría, también las que salieron en Mezcla. «No sé» y el tiempo agotado cuentan como no
    acertadas.
  - Preguntas vistas.
  - Mejor marca de la categoría.

**Sin cambios:** Hoy y Ajustes. El aviso de privacidad sigue siendo cierto tal como está.

## 5. Datos y código

### 5.1 Cambios en el contrato de juego (`src/games/types.ts`)

```ts
export type Area =
  | 'memory' | 'attention' | 'speed' | 'flexibility' | 'math' | 'logic' | 'language'
  | 'trivia' | 'accounting';

export const V1_AREAS: readonly Area[] = ['memory', 'attention', 'speed', 'flexibility', 'math']; // sin cambios
export const QUIZ_AREAS: readonly Area[] = ['trivia', 'accounting'];

export interface GameResult {
  score: number;
  accuracy: number;
  levelReached: number;
  durationMs: number;
  /** Solo en los juegos de preguntas: lo necesario para el repaso y el historial local. */
  quiz?: QuizRoundDetails;
}

export interface GameDefinition {
  // …campos actuales…
  /** Presente solo en los juegos de la sección Preguntas. */
  quiz?: QuizConfig;
  /** Clave i18n de las instrucciones; por defecto `games.<id>.instructions`. */
  instructionsKey?: string;
  /** Bloque opcional que la vista de resultado muestra debajo de las estadísticas. */
  ResultDetails?: ComponentType<{ result: GameResult }>;
}
```

- `QuizConfig = { bank: 'trivia' | 'accounting'; categories: readonly QuizCategory[] }`. Una categoría, o todas
  las del bloque en la Mezcla.
- El `area` de un juego de preguntas es su `bank`.
- Los 5 juegos actuales no cambian: los campos nuevos son opcionales.

**Registro** (`src/games/registry.ts`):
- `GAMES` agrega los 14 juegos de preguntas al final.
- Exporta `TRAINING_GAMES` (los que no tienen `quiz`) y `QUIZ_GAMES` (los que sí).
- Usan **`TRAINING_GAMES`**:
  - el plan diario (`src/data/dailyPlans.ts`);
  - la pantalla Juegos;
  - en Progreso, el puntaje por área, «Por juego» y los días entrenados.
- Las demás partes siguen usando `GAMES`: `getGame`, la sincronización y la prueba de integración del catálogo.

**Ids de los 14 juegos:**
- `trivia-mix`, `trivia-history`, `trivia-science`, `trivia-geography`, `trivia-math`, `trivia-arts`,
  `trivia-entertainment`, `trivia-sports`, `trivia-technology`;
- `accounting-mix`, `accounting-concepts`, `accounting-colombia`, `accounting-us`, `accounting-lending`.

**Factoría:** se crean con `makeQuizGame({ id, bank, categories })`, que fija:
- `referenceScore = 200` y `maxScore = 300`;
- `instructionsKey = 'quiz.instructions'`;
- `ResultDetails = QuizReview`;
- el componente y el ejemplo comunes.

**Textos** (i18n, ES y EN):
- `games.<id>.title|description` para los 14.
- `nav.quiz`.
- `quiz.*`: título de la pantalla, nombres de bloques y categorías, instrucciones (incluyen −10 / −30, «No sé»
  y 20 s), «Pregunta N de M», «No sé», «Siguiente», «Verdadero/Falso», «Correcta», «Tu respuesta», «Se acabó el
  tiempo», «Vigente a…», «Repasa tus errores», «Sin errores», «Vistas: N de M», carga y error de carga.
- `progress.quiz*`.

Las preguntas **no** van en `es.json`/`en.json`: viven en los bancos, con ambos idiomas dentro de cada pregunta.

### 5.2 Módulo de preguntas

```
src/quiz/
  types.ts          Question (choice | truefalse), QuizCategory, QuizBank, CATEGORIES_BY_BANK
  validate.ts       validateBank(json): errores legibles (lo usan las pruebas)
  banks/
    <categoría>.json   uno por categoría (12)
    manifest.ts        tamaño de cada banco
    load.ts            loadQuestions(categories): carga perezosa con import.meta.glob
  banks.test.ts     valida todos los bancos y el manifiesto
src/games/quiz/
  selection.ts      elegir la siguiente pregunta (lógica pura, §5.3)
  engine.ts         estado de la ronda, puntaje y resultado (lógica pura, §5.4)
  makeQuizGame.ts   factoría de GameDefinition
  index.ts          los 14 juegos
  Game.tsx          carga preguntas e historial; luego juega la ronda
  QuestionView.tsx  tarjeta, opciones, «No sé», respuesta y explicación
  QuizReview.tsx    «Repasa tus errores» (ResultDetails)
  Example.tsx       pregunta de ejemplo estática para las instrucciones
  quiz.module.css
src/data/quizAnswers.ts   historial local de respuestas (§5.5)
src/screens/QuizScreen.tsx
src/screens/progress/QuizProgress.tsx
```

**Carga perezosa:**
- `import.meta.glob('./*.json')` genera un fragmento JS por banco, de unos 50 KB sin comprimir.
- Un fragmento solo se descarga al jugar su categoría; abrir la app no tarda más.
- Workbox ya guarda de antemano todos los `*.js` (`globPatterns`), así que los bancos quedan disponibles sin
  conexión desde la primera visita. El plan verifica que aparezcan en `dist/sw.js`.

### 5.3 Selección de preguntas (`selection.ts`)

**Entradas:**
- el banco (o los bancos, en la Mezcla);
- el historial local `Map<questionId, últimaVezMs>`;
- los ids ya usados en la ronda;
- las categorías ya preguntadas en la ronda, en orden;
- el nivel actual y el `rng`.

**Pasos:**

1. **Dificultad:** se sortea según la tabla de §2.
2. **Categoría** (solo con más de una):
   1. Se consideran las categorías que aún tienen preguntas sin usar en la ronda.
   2. Se descarta la categoría de las dos últimas preguntas si ambas fueron de la misma.
   3. De las que quedan, se toman las menos usadas en la ronda y se elige una al azar.
3. **Candidatas:** las preguntas de esa categoría y dificultad que no se han usado en la ronda.
   - Si no hay, se prueba la dificultad más cercana: primero ±1 y luego ±2, prefiriendo la menor si empatan.
   - Si aun así no hay, se elige otra categoría.
4. **Elección:**
   - Si alguna candidata **nunca se ha respondido**, se elige al azar entre ellas.
   - Si no, se elige al azar entre las **10 respondidas hace más tiempo**. Así, una vez agotado el banco, vuelven
     primero las más antiguas.

Con el mismo `rng` sembrado, la función es determinista, así que se puede probar.

### 5.4 Motor de la ronda (`engine.ts`)

Funciones puras al estilo de los demás motores:

- `createQuizRound(pool, history, startLevel, rng)` → estado inicial con la primera pregunta. Para una pregunta
  de opción múltiple, el orden de las opciones es una permutación aleatoria.
- `answer(state, shownIndex, rtMs)`, `dontKnow(state)`, `timeOut(state)`: pasan a la fase `feedback` y aplican
  el puntaje y la escalera de §2. `answer` ignora `rtMs < MIN_RT_MS`.
- `next(state, history, rng)`: siguiente pregunta, o fin de la ronda después de la décima.
- `quizResult(state, durationMs)` → `GameResult` con `quiz.items`.

**Datos de la ronda:**

```ts
interface QuizRoundDetails {
  items: { question: Question; outcome: 'correct' | 'wrong' | 'skipped' | 'timeout'; chosen: number | null }[];
}
```

`chosen` es el índice en el orden **canónico** de la pregunta, no en el orden mostrado:
- en opción múltiple, 0 es la correcta;
- en verdadero/falso, 0 es «Verdadero» y 1 es «Falso».

**Constantes:**

| Constante | Valor |
|---|---|
| `QUIZ_ROUND_LENGTH` | 10 |
| `QUIZ_QUESTION_MS` | 20 000 |
| `QUIZ_CORRECT_POINTS` | 20 |
| `QUIZ_WRONG_PENALTY` | `{ choice: 10, truefalse: 30 }` |
| `QUIZ_MAX_SCORE` | 300 |
| `QUIZ_REFERENCE_SCORE` | 200 |

**Componente (`Game.tsx`):**
1. Carga el pool y el historial.
2. Muestra «Cargando preguntas…» mientras tanto. El reloj de la pregunta no corre hasta que la primera está en
   pantalla.
3. Usa `useGameClock(paused)` y `useTrialTimeout` para los 20 s. Durante la fase `feedback` no hay ventana de
   tiempo.
4. `durationMs` es el tiempo activo total de la ronda (`clock.now()` al terminar), que incluye la lectura de las
   explicaciones.

### 5.5 Datos locales

Dexie pasa a la versión 3 con una tabla nueva:

```ts
db.version(3).stores({ quizAnswers: '[resultId+questionId], questionId, category, answeredAt' });

interface QuizAnswer {
  resultId: string;      // id de la partida guardada
  questionId: string;
  category: QuizCategory;
  outcome: 'correct' | 'wrong' | 'skipped' | 'timeout';
  answeredAt: string;    // ISO
}
```

- **Escritura:** `recordGameResult` escribe las respuestas cuando `result.quiz` existe, justo después de
  `addResult`.
  - La clave compuesta hace que reintentar un guardado fallido (mismo `resultId`) no duplique filas.
  - Una ronda abandonada no se registra, igual que las demás partidas, así que sus preguntas pueden volver a
    salir.
- **Lecturas** (`src/data/quizAnswers.ts`):
  - `answerHistory(categories)` → `Map<questionId, últimaVezMs>`, para la selección y para «Vistas».
  - `seenCounts()` → preguntas distintas por categoría.
  - `masteryByCategory(since)` → `{ answered, correct }` por categoría.
- **Volumen:** 10 filas por ronda; un año jugando a diario son unas 3.650 filas.
- **Privacidad:** estas filas **nunca salen del dispositivo**. A Supabase solo sube el resultado agregado
  (puntaje, nivel, precisión, duración y fecha), como cualquier partida.
- «Borrar mis datos» ya borra todas las tablas (`clearAllData` recorre `db.tables`).

### 5.6 Supabase

Migración nueva, `supabase/migrations/20261102000000_quiz_games.sql`:

1. Reemplaza la restricción de área de `public.games` (`games_area_check`; el plan confirma ese nombre antes de
   borrarla) por una que también acepta `'trivia'` y `'accounting'`.
2. Inserta los 14 juegos con `max_score = 300`.

Así el trigger de validación ya rechaza puntajes de preguntas por encima de 300. No hay tablas nuevas: las
respuestas pregunta por pregunta no se suben.

**Pruebas pgTAP:**
- `01_core_schema.test.sql` compara solo las 5 filas de entrenamiento.
- `04_quiz_games.test.sql` es nueva y comprueba:
  - que estén las 14 filas;
  - que se acepten `trivia` y `accounting` y se rechace un área desconocida;
  - que un resultado con 300 se acepte y uno con 301 se rechace.

**Publicación:** como dice el README, la migración se aplica en el proyecto real **antes** de unir la rama a
`main`. `SETUP.md` pasa de «3 migraciones» a 4.

### 5.7 Manejo de errores

| Situación | Comportamiento |
|---|---|
| No carga un banco (caché dañada, sin conexión antes de la primera visita) | «No pudimos cargar las preguntas» + «Reintentar» y «Salir». No se registra nada |
| No se puede leer el historial local | Se juega con historial vacío (alguna pregunta puede repetirse); nunca bloquea |
| Falla el guardado | El flujo actual de «Reintentar» con el mismo `resultId`; las respuestas no se duplican |
| Ronda de menos de 5 s o más de 1 h activa | El servidor la rechaza (regla actual de `duration_ms`); queda guardada en el dispositivo |
| Una pregunta con un dato equivocado | Se corrige su JSON y se publica una versión nueva; su id se mantiene |

## 6. Pruebas

**Unitarias (Vitest):**
- **Bancos** (`banks.test.ts`), sobre los 12 archivos:
  - esquema y tipos;
  - ids con formato válido y únicos entre todos los bancos;
  - 4 opciones distintas por idioma (sin distinguir mayúsculas) en las de opción múltiple;
  - cada idioma tiene los campos de su tipo (`options` en opción múltiple; ninguno extra en verdadero/falso);
  - largos máximos;
  - sin «todas/ninguna de las anteriores» ni «all/none of the above»;
  - `asOf` con formato `YYYY-MM`;
  - al menos 100 preguntas, con ≥ 35 fáciles, ≥ 35 medias y ≥ 15 difíciles;
  - verdadero/falso ≤ 25 %;
  - el manifiesto coincide con cada archivo.
- **Selección:**
  - bandas de dificultad;
  - preferencia por las no vistas;
  - vuelta a las más antiguas cuando se agota el banco;
  - reparto en la Mezcla, sin tres seguidas del mismo tema;
  - dificultad o categoría agotada;
  - determinismo con semilla.
- **Motor:**
  - puntaje de acierto con bonus, error −10 / −30, «No sé», tiempo agotado y piso en 0;
  - máximo 300;
  - escalera y precisión;
  - `MIN_RT_MS`;
  - fin a las 10 preguntas;
  - `quiz.items` con `chosen` canónico.
- **Datos locales:** respuestas idempotentes, historial, preguntas vistas, dominio con ventana de 30 días y
  borrado total.
- **Registro:**
  - los juegos de preguntas son válidos (área = bloque, textos en ambos idiomas, instrucciones en
    `instructionsKey`);
  - `TRAINING_GAMES` tiene los 5 de siempre;
  - el plan diario nunca elige un juego de preguntas.
- **Componentes:**
  - pantalla Preguntas: 14 tarjetas, «Vistas» y mejor marca;
  - juego de preguntas: responder, explicación, siguiente, teclado, «No sé», tiempo agotado, pausa y error de
    carga;
  - resultado con «Repasa tus errores» y «Volver» a Preguntas;
  - Progreso: bloque Preguntas, y días entrenados y «Por juego» solo de entrenamiento;
  - Juegos sigue mostrando 5;
  - navegación con 5 pestañas.

**Base de datos:** `04_quiz_games.test.sql` y el ajuste de `01`.

**Integración:**
- La prueba existente «la tabla games coincide con el registro» cubre los 14 juegos nuevos.
- Se agrega la subida de un resultado de preguntas con 300 puntos.

**Punta a punta (Playwright):**
- jugar una ronda completa desde la pestaña Preguntas hasta el repaso;
- jugar una ronda sin conexión después de la primera visita;
- zonas táctiles de 44 px en la barra de 5 pestañas, las tarjetas y las opciones;
- textos en inglés.

## 7. Accesibilidad

- Cada opción es un `<button>` con su número visible.
- El resultado de cada respuesta se anuncia con `aria-live="polite"` («Correcta», o «Incorrecta: la respuesta
  era …»).
- Los aciertos y errores se marcan con ✓/✗ y texto, no solo con color.
- Se cumple el contraste WCAG AA (lo comprueba la prueba de contraste existente) y se respeta
  `prefers-reduced-motion` en la barra de tiempo.
- Se puede jugar entero con teclado.
- **Una mejora frente a los demás juegos:** el texto es legible por lectores de pantalla. Aun así, el límite de
  20 s puede ser corto para quien lo usa, y este diseño no añade un modo sin tiempo (ver §8).

## 8. Fuera de alcance

- Duelos o partidas contra otras personas, tablas de líderes con nombres y una vista de administrador del
  equipo.
- Preguntas con imágenes o mapas.
- Botón «Reportar pregunta» (requeriría un canal de reportes).
- Preguntas guardadas en Supabase o editables sin publicar una versión nueva.
- Modo sin tiempo, comodines o pistas, y logros.
- Un importador desde Excel. La hoja de revisión es solo de salida y las correcciones las aplica Claude.
- Publicar la trivia antes que la parte contable. Si el equipo tarda en revisar y se quiere lanzar la trivia
  antes, se quitan temporalmente del registro los 5 juegos contables. Esa decisión queda para cuando llegue el
  caso.

## 9. Riesgos y puntos a verificar

| # | Riesgo o punto | Mitigación |
|---|---|---|
| 1 | Errores de contenido en 1.200 preguntas | Verificación independiente de cada lote, revisión del equipo para contabilidad y corrección rápida por JSON |
| 2 | Normas colombianas o de EE. UU. que cambian | Evitar cifras anuales, citar la norma y usar `asOf` |
| 3 | Nombre de la restricción de área en Postgres | El plan lo confirma con `\d public.games` antes de escribir la migración |
| 4 | Los bancos no quedan en la caché sin conexión | El plan revisa `dist/sw.js` y la prueba e2e sin conexión |
| 5 | Cinco pestañas en 320 px | Prueba e2e de zonas táctiles y etiquetas cortas («Preguntas» / «Quiz») |
| 6 | Tiempo y costo de escribir 1.200 preguntas bilingües | Lotes de 50 por sesión de redacción, con verificación aparte; el plan lo divide en tareas independientes |
