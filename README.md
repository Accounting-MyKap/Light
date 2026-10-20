# Light — Ilumina tu cerebro

Light es una app web gratuita con ejercicios cortos para ejercitar la mente: memoria, atención,
velocidad, flexibilidad mental y matemáticas. Propone un entrenamiento diario de 3 juegos
(unos 5 minutos), lleva tu racha de días y muestra tu progreso. Funciona en español e inglés,
se puede instalar en el celular y sigue funcionando sin internet.

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
  screens/    pantallas: Hoy, Juegos, Partida, Progreso, Ajustes
  games/      un juego por carpeta + registro y piezas comunes (reloj, puntaje, sonido)
  core/       lógica pura: azar, fechas, dificultad, plan diario, racha, puntaje por área
  data/       base de datos local (IndexedDB con Dexie)
  play/       guardar el resultado de una partida
  sync/       sincronización opcional con Supabase: cola de subida, invitados, percentil y borrado de datos
  i18n/       textos en español (es.json) e inglés (en.json)
e2e/          pruebas de punta a punta
tests/        pruebas de integración contra el Supabase local
supabase/     base de datos: configuración, migraciones SQL y pruebas pgTAP
docs/         especificación y planes de implementación
```

## Cómo agregar un juego

1. Crea `src/games/<id>/` con el motor (`engine.ts`, lógica pura y probada), el componente
   (`Game.tsx`), un ejemplo visual (`Example.tsx`) y su definición (`index.ts`).
2. Agrega una línea en `src/games/registry.ts`.
3. Agrega `games.<id>.title`, `description` e `instructions` en `es.json` y `en.json`.

Las pruebas verifican que cada juego registrado tenga sus textos en ambos idiomas. Para la
sincronización con Supabase también hace falta una fila en la tabla `games` (en una migración nueva de
`supabase/migrations/`, con su área y su puntaje máximo); la prueba de integración comprueba que la
tabla coincida con el registro.
