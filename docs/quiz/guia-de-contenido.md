# Guía de contenido de Preguntas

Esta guía la siguen quienes escriben y quienes revisan las preguntas de la sección Preguntas de Light. Las reglas
vienen del diseño (`docs/superpowers/specs/2026-11-02-light-quiz-design.md`, §3). La prueba
`src/quiz/validate.test.ts` y el validador `src/quiz/validate.ts` comprueban a máquina lo que se puede comprobar
(formato, largos, ids, reparto); el resto depende de quien redacta y de quien revisa.

## 1. Qué cubre cada categoría

Hay 12 categorías, 100 preguntas cada una: 8 de cultura general (banco `trivia`) y 4 de contabilidad (banco
`accounting`).

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

Una pregunta va en una sola categoría. Si dudas entre dos, elige la que describe mejor el conocimiento que se
necesita para responder.

## 2. Reglas de calidad

### Reparto

- **Por dificultad, al lanzar:** 40 fáciles, 40 medias y 20 difíciles por categoría. Es la forma objetivo de cada
  banco nuevo; compruébala con `npm run quiz:stats`.
- **Verdadero/falso:** como máximo el 25 % de cada categoría.
- **Mínimo para validar un archivo:** 10 preguntas y al menos una de cada dificultad. Esto es solo el piso del
  validador (`validateBank`).
- **Pisos de los bancos:** cada banco tiene al menos 100 preguntas, con al menos 35 fáciles, 35 medias y 15
  difíciles, y entre todos suman al menos 1 200. `npm test` lo exige (`src/quiz/banks.test.ts`): quitar preguntas
  o cambiar dificultades hasta bajar de un piso hace fallar la prueba. Son mínimos, así que agregar preguntas no
  toca código: basta con el JSON de la categoría y su tamaño en el manifiesto.

### Solo datos estables y verificables

- Nada de «el récord actual» ni «la película más taquillera», porque cambian.
- Nada de temas políticamente divisivos ni preguntas ambiguas.
- Cada pregunta tiene **una sola respuesta defendible**.
- **No se usan «todas las anteriores» ni «ninguna de las anteriores»** (ni «all of the above» ni «none of the
  above»). El validador rechaza estas frases en las opciones.

### Distractores creíbles

Las opciones incorrectas deben parecer posibles para quien no sabe la respuesta. Que sean del mismo tipo que la
correcta (años con años, países con países, tarifas con tarifas) y de un tamaño parecido. Que sean incorrectas sin
discusión: un distractor que también podría ser correcto vuelve ambigua la pregunta.

### Largos máximos, en ambos idiomas

| Texto | Máximo |
|---|---|
| Enunciado (`question`) | 160 caracteres |
| Cada opción (`options[i]`) | 60 caracteres |
| Explicación (`explanation`) | 220 caracteres |

Todos los textos van sin espacios al principio ni al final y no pueden estar vacíos.

### Idiomas

**El inglés se adapta, no se traduce literalmente.** ES y EN deben decir lo mismo, pero el inglés suena natural
para quien lo lee. En las preguntas de Colombia, la versión en inglés aclara los términos locales, por ejemplo
«PUC (Colombia's chart of accounts)».

### El repositorio es público

No incluyas procesos internos, nombres de clientes ni datos de ninguna empresa. Solo conocimiento general del
oficio.

## 3. Formato

Hay un archivo JSON por categoría: `src/quiz/banks/<categoría>.json`.

- En las preguntas de opción múltiple (`"type": "choice"`), **la respuesta correcta va siempre primero** en
  `options`, y hay exactamente 4 opciones distintas por idioma. La app baraja las opciones al mostrarlas.
- Las de verdadero/falso (`"type": "truefalse"`) llevan `answer` (`true` o `false`) en lugar de `options`, y
  ningún idioma lleva `options`.
- El archivo declara su `category`; las preguntas no la repiten.
- `difficulty`: `1` (fácil), `2` (media) o `3` (difícil).
- `id`: `<categoría>-NNNN`, con cuatro dígitos (`history-0042`). Es único en todos los bancos. **Nunca se reutiliza
  un id borrado**, porque el historial local de cada jugador lo recuerda.
- `asOf` (opcional): `YYYY-MM`, por ejemplo `"2026-11"`. Ver la sección 6.

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

## 4. Ejemplos

### Tres preguntas bien hechas

**1. Un dato fijo, una sola respuesta, distractores del mismo tipo.**
«¿En qué año cayó el Muro de Berlín?» — 1989 · 1991 · 1985 · 1979.
*Por qué sirve:* la fecha no cambia, solo una opción es correcta y los distractores son años del siglo XX que
alguien podría confundir.

**2. Un verdadero/falso con una afirmación clara y falsa a propósito.**
«Cristóbal Colón llegó a América en 1592.» — Falso.
*Por qué sirve:* la afirmación es una sola idea, no tiene trampa de redacción y la explicación corrige el dato
(1492).

**3. Una norma que puede cambiar: la explicación la cita y la pregunta lleva `asOf`.**
«¿Cuál es la tarifa general del IVA en Colombia?» — 19 % · 16 % · 21 % · 12 %.
Explicación: «Es la tarifa general del IVA según el art. 468 del Estatuto Tributario.» Con `"asOf": "2026-11"`
(la app muestra «Vigente a noviembre de 2026»).
*Por qué sirve:* es una tarifa que el equipo conoce, la explicación dice de dónde sale y el `asOf` avisa cuándo
fue verificada. En inglés: «What is Colombia's general VAT rate?».

### Tres preguntas mal hechas

**1. Dato que cambia con el tiempo.**
«¿Cuál es el valor de la UVT este año?» (o «¿Cuál es la película más taquillera de la historia?»).
*Por qué falla:* la respuesta de hoy es incorrecta mañana, y la app no puede enterarse. Las cifras que se
actualizan cada año (UVT, topes del IRS, tarifas de retención vigentes) no van. *Cómo arreglarla:* preguntar por
el concepto, por ejemplo «¿Para qué se usa la UVT en Colombia?» (como unidad de medida de valores tributarios).

**2. Respuesta ambigua.**
«¿Cuál es el río más largo del mundo?» — Nilo · Amazonas · Yangtsé · Misisipi.
*Por qué falla:* según el método de medición, el Nilo y el Amazonas se disputan el primer lugar; hay más de una
respuesta defendible. *Cómo arreglarla:* una pregunta con respuesta indiscutible, como «¿Qué río atraviesa
Bagdad?» (el Tigris), o fijar el criterio sin discusión.

**3. Distractor absurdo.**
«¿Qué órgano bombea la sangre?» — Corazón · Un martillo · El color azul · El lunes.
*Por qué falla:* nadie duda entre las opciones, así que la pregunta no mide nada. *Cómo arreglarla:* distractores
del mismo tipo (Hígado, Pulmón, Riñón).

## 5. Cómo asignar la dificultad

| Dificultad | Quién debería acertar | Cómo se reconoce |
|---|---|---|
| `1` fácil | **La mayoría** de las personas adultas | Se aprende en el colegio o aparece en la vida cotidiana. No exige estudiar el tema. |
| `2` media | Quien **se interesa por el tema** | Pide haber leído, estudiado o practicado algo del tema, sin ser experto. |
| `3` difícil | **Especialistas** | Detalle fino, excepción a una regla o dato que solo maneja quien trabaja con el tema. |

Pregúntate: «Si le hago esta pregunta a diez personas al azar, ¿cuántas aciertan sin pensarlo mucho?». Casi todas →
fácil; unas pocas → media; casi ninguna fuera del oficio → difícil. La verificación independiente (sección 8)
revisa la dificultad asignada.

En contabilidad, mide la dificultad contra el oficio: «la ecuación contable» es fácil; distinguir una provisión de
un castigo, media; aplicar un tema ASC concreto, difícil.

## 6. Reglas de la parte contable

- **Sin valores anuales.** Ni valor de la UVT, ni tarifas de retención vigentes, ni topes del IRS: cambian cada
  año y quedarían mal sin que nadie lo note. Pregunta por el concepto, la mecánica o la norma.
- **Cita la norma.** Si la pregunta depende de una norma que puede cambiar (por ejemplo, el IVA general del 19 %),
  la explicación cita la norma (ley, decreto, artículo del Estatuto Tributario, tema ASC).
- **Usa `asOf` en esas preguntas.** Escribe el mes en que se verificó la norma, como `"asOf": "2026-11"`. La app lo
  muestra como «Vigente a noviembre de 2026». Cuando la norma cambie, el equipo vuelve a verificar y actualiza el
  `asOf` o reemplaza la pregunta. Las preguntas sobre conceptos que no cambian (partida doble, causación) no
  llevan `asOf`.
- **EN adaptado:** en Colombia, la versión en inglés aclara los términos locales (PUC, RUT, ICA, NIIF).
- **Nada interno:** conocimiento general del oficio, sin procesos, clientes ni datos de ninguna empresa.

## 7. Verificaciones automáticas

`validateBank` (en `src/quiz/validate.ts`) revisa cada archivo y devuelve la lista de errores; cada uno empieza con
el id de la pregunta (o `questions[N]` si la pregunta no tiene un id válido), o con `bank:` si es del archivo
completo. Comprueba:

- que `category` del archivo coincida con el archivo;
- ids con la forma `<categoría>-NNNN` y sin repetirse;
- dificultad 1, 2 o 3 y tipo `choice` o `truefalse`;
- en `choice`: 4 opciones distintas por idioma (sin importar mayúsculas ni espacios) y ninguna «todas/ninguna de
  las anteriores»;
- en `truefalse`: `answer` booleano y ninguna `options`;
- textos sin espacios en los bordes, no vacíos y dentro de los largos máximos;
- `asOf` con la forma `YYYY-MM`;
- al menos 10 preguntas, al menos una de cada dificultad y no más del 25 % de verdadero/falso.

## 8. Proceso de redacción, verificación y revisión

1. **Redacción.** Claude redacta cada categoría por lotes, siguiendo esta guía.
2. **Verificación independiente.** Una segunda pasada, con un revisor que no escribió el lote, comprueba que:
   - el dato sea correcto y la respuesta sea única;
   - los distractores sean incorrectos pero creíbles;
   - la dificultad esté bien asignada;
   - ES y EN digan lo mismo.

   Se corrige o se reemplaza lo que no pase.
3. **Revisión del equipo contable.** Para las 4 categorías de contabilidad se genera una hoja de Excel de revisión
   con estas columnas:
   - id, categoría y dificultad;
   - pregunta, opciones (la correcta marcada) y explicación, en ES y EN;
   - `asOf`;
   - «OK / corrección».

   El equipo la diligencia y Claude aplica las correcciones. **La rama no se une a `main` hasta que las 400
   preguntas contables estén aprobadas.**
4. **Validación automática.** `npm test` comprueba formato, largos, ids únicos, reparto por dificultad, proporción
   de verdadero/falso, tamaños del manifiesto y los pisos de los bancos (al menos 100 por banco, con al menos
   35 / 35 / 15, y al menos 1 200 en total).

## 9. Cómo agregar preguntas

1. Elige el id siguiente: el número más alto que haya existido **alguna vez** en ese banco más uno, con cuatro
   dígitos (`history-0101` después de `history-0100`). No basta con buscar el más alto del archivo actual: si se
   borró la última pregunta, su id tampoco se reutiliza (sección 3). Si dudas, revisa el historial del banco con
   `git log -p -- src/quiz/banks/<categoría>.json`.
2. Escribe la pregunta con el formato de la sección 3: correcta primero en `options`, ES y EN, dificultad,
   `asOf` si depende de una norma.
3. Actualiza el tamaño de esa categoría en `src/quiz/banks/manifest.ts`. La pantalla Preguntas lo usa para mostrar
   «Vistas: N de M» sin cargar los bancos.
4. Ejecuta `npm run quiz:stats`. Imprime una línea por categoría con el total, las fáciles, medias y difíciles, y
   cuántas son de verdadero/falso; compárala con el reparto 40 / 40 / 20.
5. Ejecuta `npm test`. Si el validador reporta errores, corrígelos: cada mensaje empieza con el id de la pregunta
   que falló. La prueba también comprueba los pisos de los bancos (sección 2): al menos 100 preguntas, con al
   menos 35 / 35 / 15. Agregar preguntas nunca la hace fallar; quitarlas o cambiar dificultades, sí, si el banco
   baja de un piso.
6. Pasa el lote por la verificación independiente (sección 8) antes de integrarlo; si es de contabilidad, también
   por el equipo contable.
