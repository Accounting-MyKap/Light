# Light — Ilumina tu cerebro

Light es una app web gratuita con ejercicios cortos para ejercitar la mente: memoria, atención,
velocidad, flexibilidad mental y matemáticas. Propone un entrenamiento diario de 3 juegos
(unos 5 minutos), lleva tu racha de días y muestra tu progreso. La sección **Preguntas** ofrece
rondas de 10 preguntas de cultura general y de contabilidad, con su explicación y el repaso de tus
errores. Funciona en español e inglés, se puede instalar en el celular y sigue funcionando sin internet.

Todo el progreso se guarda en el dispositivo. Si el sitio se publica con las variables de Supabase
(ver [`SETUP.md`](SETUP.md)), tus puntajes además se envían de forma anónima, sin nombre ni correo,
para compararte con otros jugadores. Light no usa publicidad ni analítica.

## Requisitos

- Node.js 22.13 o superior.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev` | Abre la app en modo desarrollo |
| `npm test` | Pruebas unitarias y de componentes (Vitest) |
| `npm run e2e` | Pruebas de punta a punta (Playwright) |
| `npm run lint` / `npm run typecheck` | Revisión de estilo y de tipos |
| `npm run build` | Genera la versión publicable en `dist/` |
| `npm run icons` | Regenera los íconos PNG a partir de `public/icon.svg` |

Las pruebas de punta a punta y `npm run icons` usan Chromium. Si ya tienes uno instalado, indica su ruta con
`PW_CHROMIUM_PATH` (por ejemplo `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`); si no,
instálalo con `npx playwright install chromium`.

## Supabase local

La base de datos de Supabase (Postgres con RLS) vive en `supabase/`: la configuración en `config.toml`,
las migraciones en `supabase/migrations/` y las pruebas pgTAP en `supabase/tests/`. Para correrla en tu
máquina necesitas Docker.

```bash
dockerd > /tmp/dockerd.log 2>&1 &                    # solo en el sandbox, si Docker no está corriendo
export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io    # solo en el sandbox, donde el registro por defecto (ECR) está bloqueado
npm run db:start
npm run db:reset && npm run db:test
```

| Comando | Qué hace |
|---|---|
| `npm run db:start` | Levanta Supabase local con solo lo necesario (base de datos, API y auth) |
| `npm run db:stop` | Lo detiene |
| `npm run db:reset` | Recrea la base de datos y aplica todas las migraciones |
| `npm run db:test` | Corre las pruebas pgTAP de `supabase/tests/` |
| `npm run test:integration` | Corre las pruebas de integración de `tests/integration/` contra el Supabase local; al terminar vacían las tablas y los usuarios, así que `db:test` sigue pasando después |

Al arrancar, `db:start` imprime `API_URL` (`http://127.0.0.1:54321`) y las claves locales.

### Pruebas de integración

`npm run test:integration` ejecuta el cliente de sincronización real contra el Supabase local: subida
sin duplicados, rechazo de un puntaje imposible, días completados, aislamiento por RLS, percentil y
recuperación de un invitado borrado. Necesita que `npm run db:start` esté corriendo (lee la URL y las
claves de `supabase status`) y no corre con `npm test`, para que las pruebas unitarias nunca requieran
Docker. En CI es el trabajo `supabase`, junto con `db:test`.

## Publicación

Cada cambio que llega a `main` se publica en GitHub Pages con el flujo `.github/workflows/deploy.yml`.
Para activarlo una sola vez: en GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
La app queda en `https://<usuario>.github.io/Light/`.

Sin configuración adicional, la app se publica solo en modo local (sin sincronización). Para conectar
Supabase y que los invitados sincronicen sus partidas, sigue [`SETUP.md`](SETUP.md): crea el proyecto,
aplica las migraciones, activa Turnstile y define las variables del repositorio `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` y `TURNSTILE_SITE_KEY`. El workflow `keep-alive.yml` consulta Supabase cada
3 días para que el plan gratuito no pause el proyecto.

## Estructura

```
src/
  app/        marco de la app: rutas, navegación, tema, errores, aviso de versión nueva
  screens/    pantallas: Hoy, Juegos, Preguntas, Partida, Progreso, Ajustes
  games/      un juego por carpeta + registro y piezas comunes (reloj, puntaje, sonido)
  quiz/       bancos de preguntas (un JSON por categoría) y su validación
  core/       lógica pura: azar, fechas, dificultad, plan diario, racha, puntaje por área
  data/       base de datos local (IndexedDB con Dexie)
  play/       guardar el resultado de una partida
  sync/       sincronización opcional con Supabase: cola de subida, invitados, percentil y borrado de datos
  i18n/       textos en español (es.json) e inglés (en.json)
e2e/          pruebas de punta a punta
tests/        pruebas de integración contra el Supabase local
supabase/     base de datos: configuración, migraciones SQL y pruebas pgTAP
docs/         especificación, planes de implementación y guía de contenido de Preguntas (docs/quiz/)
```

## Cómo agregar un juego

1. Crea `src/games/<id>/` con el motor (`engine.ts`, lógica pura y probada), el componente
   (`Game.tsx`), la manera de enseñarlo y su definición (`index.ts`). Para enseñarlo hay dos opciones,
   y cada juego tiene exactamente una:
   - **una práctica guiada** (`Practice.tsx`, que recibe `onComplete` y `onSkip`), la recomendada y la de
     los 7 juegos de entrenamiento; va en `index.ts` como `Practice`;
   - **o la pantalla de instrucciones**, como los juegos de preguntas: un ejemplo estático (`Example.tsx`,
     en `index.ts` como `Example`) junto a los pasos.
2. Agrega una línea en `src/games/registry.ts`.
3. Agrega `games.<id>.title`, `skill` y `description` en `es.json` y `en.json`, y además:
   - con práctica, `games.<id>.practice.*`, donde `practice.recap` es el resumen de las reglas en una
     línea que se ve en la pantalla «¡Listo!»;
   - con instrucciones, `games.<id>.instructions` (al menos 2 pasos), o `instructionsKey` en la definición
     cuando varios juegos comparten los mismos pasos, como los de preguntas con `quiz.instructions`.

Las pruebas verifican que cada juego registrado tenga una práctica o un ejemplo, y sus textos en ambos
idiomas. Para la
sincronización con Supabase también hace falta una fila en la tabla `games` (en una migración nueva de
`supabase/migrations/`, con su área y su puntaje máximo); la prueba de integración comprueba que la
tabla coincida con el registro.

**Aplica esa migración en el proyecto de Supabase antes de unir el cambio a `main`**, porque unir a
`main` publica la app. Si el juego nuevo llega a los jugadores antes que su fila en `games`, el
servidor rechaza cada uno de sus resultados y los dispositivos los marcan como no sincronizables para
siempre (no se reintentan).

## Cómo agregar preguntas

Las preguntas viven en `src/quiz/banks/`, un archivo JSON por categoría (12 en total).

1. Edita `src/quiz/banks/<categoría>.json` y agrega la pregunta con el id siguiente: el número más alto que
   haya existido **alguna vez** en ese banco más uno, con cuatro dígitos (`history-0101` después de
   `history-0100`). No basta con mirar el archivo actual: si se borró la última pregunta, su id tampoco se
   reutiliza, porque el historial local de cada jugador lo recuerda. Si dudas, revisa
   `git log -p -- src/quiz/banks/<categoría>.json`. Sigue el formato de la guía, con la pregunta en español y en
   inglés.
2. Actualiza el tamaño de esa categoría en `src/quiz/banks/manifest.ts`; la pantalla Preguntas lo usa para
   mostrar «Vistas: N de M».
3. Corre `npm run quiz:stats`, que imprime por categoría el total, el reparto por dificultad y la cantidad de
   verdadero/falso (compáralo con la forma objetivo 40 / 40 / 20), y `npm test`, que valida el formato, los ids,
   los largos, que el manifiesto coincida con los archivos y los pisos de los bancos: al menos 100 preguntas por
   banco, con al menos 35 fáciles, 35 medias y 15 difíciles, y al menos 1 200 en total. Son mínimos: agregar
   preguntas no toca código.

Las reglas de calidad, los ejemplos, la asignación de dificultad y el proceso de revisión están en
[`docs/quiz/guia-de-contenido.md`](docs/quiz/guia-de-contenido.md). Agregar preguntas no requiere migración:
los bancos son parte de la app y se precargan para que funcione sin conexión.

Lo que sí requiere migración son los 14 juegos de preguntas (`supabase/migrations/20261102000000_quiz_games.sql`),
igual que cualquier juego nuevo: **aplícala en el proyecto de Supabase antes de unir el cambio a `main`**, porque
unir a `main` publica la app. Si los juegos llegan a los jugadores antes que sus filas en `games`, el servidor
rechaza cada uno de sus resultados y los dispositivos los marcan como no sincronizables para siempre.
