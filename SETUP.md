# Configuración de Light

Light funciona sin servidor: todo el progreso queda en el dispositivo. Esta guía conecta la app a
Supabase para que los **invitados** (sesiones anónimas, sin cuenta) sincronicen sus partidas y vean
su percentil. Es la parte del Plan 2; cuando llegue el Plan 3 (cuentas) se agregarán aquí sus pasos.

Si no haces nada de esto, la app sigue publicándose y funcionando igual que hasta ahora, sin red y
sin sincronización.

## Antes de empezar

- Una cuenta personal de [Supabase](https://supabase.com) (el plan gratuito alcanza).
- Una cuenta gratuita de [Cloudflare](https://www.cloudflare.com) para Turnstile.
- Permisos de administrador en el repositorio de GitHub, con Pages ya activado (**Settings → Pages →
  Source: GitHub Actions**, ver `README.md`).

## Pasos

1. **Crear el proyecto en Supabase.** En tu cuenta personal, crea un proyecto nuevo. Anota la **URL**
   del proyecto (por ejemplo `https://abcdefghijklmnopqrst.supabase.co`, sin barra final) y la
   *publishable key*. Las dos son públicas y van en la app.

2. **Aplicar las 3 migraciones** de `supabase/migrations/`, en este orden:
   1. `20261020000000_core_schema.sql`
   2. `20261020000100_percentile.sql`
   3. `20261020000200_cleanup.sql`

   Puedes pegarlas una por una en el SQL Editor de Supabase, aplicarlas con el conector de Supabase
   (por ejemplo, para que Claude lo haga) o con la CLI (`supabase link` y `supabase db push`).

3. **Verificar `pg_cron`.** En **Database → Extensions**, comprueba que `pg_cron` quedó activa (la
   tercera migración la crea y programa la limpieza semanal de invitados abandonados). Si el plan
   gratuito no la permitiera, la limpieza se cambia a un workflow programado de GitHub; anótalo
   para resolverlo en ese momento. En el Supabase local la extensión sí está disponible (versión
   1.6.4); falta confirmarlo en el proyecto real.

4. **Activar los invitados.** En **Authentication → Sign In / Providers**, activa *Anonymous
   sign-ins*.

5. **Configurar Cloudflare Turnstile** (el CAPTCHA que protege la creación de invitados):
   1. En Cloudflare, crea un sitio gratuito de Turnstile en modo *Invisible* para
      `accounting-mykap.github.io`.
   2. Copia la *site key* y la *secret key*.
   3. En Supabase, **Authentication → Bot and Abuse Protection**, activa CAPTCHA con Turnstile y pega
      la *secret key*.

   > **Haz el paso 5 y el paso 6 seguidos, y vuelve a publicar (paso 7).** Si activas CAPTCHA en
   > Supabase sin que la app tenga la variable `TURNSTILE_SITE_KEY`, todos los inicios de sesión de
   > invitado fallan y la sincronización queda sin conexión (la app sigue funcionando en local). Se
   > arregla creando la variable y volviendo a publicar.

6. **Crear las variables en GitHub.** En el repositorio, **Settings → Secrets and variables → Actions
   → Variables** (la pestaña *Variables*, no *Secrets*), crea estas tres:

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | La URL del proyecto del paso 1 |
   | `SUPABASE_PUBLISHABLE_KEY` | La *publishable key* del paso 1 |
   | `TURNSTILE_SITE_KEY` | La *site key* del paso 5 |

7. **Volver a publicar y comprobar.** Ve a **Actions → Deploy to GitHub Pages → Run workflow**. Cuando
   termine:
   1. Juega una partida en `https://accounting-mykap.github.io/Light/`.
   2. En Supabase, **Table editor → results**, debe aparecer una fila.
   3. Ejecuta **Actions → Keep Supabase awake → Run workflow** y verifica que termine en verde.

   El workflow *Keep Supabase awake* consulta la tabla `games` cada 3 días para que el plan gratuito
   no pause el proyecto. Mientras la variable `SUPABASE_URL` no exista, ese trabajo se omite (no
   falla), así que solo cuenta como verificación después del paso 6.

## Probar en tu máquina (opcional)

Para que `npm run dev` hable con un Supabase, crea un archivo `.env.local` en la raíz con:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_TURNSTILE_SITE_KEY=...   # opcional: solo si el proyecto tiene CAPTCHA activado
```

`.env.local` no se sube al repositorio (está en `.gitignore`). Con el Supabase local (`npm run
db:start`, ver `README.md`) usa la `API_URL` y la `PUBLISHABLE_KEY` que imprime el comando; ahí no
hace falta Turnstile.

## Qué NO hacer

- **Nunca pegues la clave de servicio** (*service role* / *secret key* de Supabase) en GitHub, en
  `.env.local` ni en la app. La clave secreta de Turnstile tampoco: solo se pega en Supabase
  (**Authentication → Bot and Abuse Protection**).
- Las únicas claves públicas son la *publishable key* de Supabase y la *site key* de Turnstile.
  Todo lo que empieza con `VITE_` termina visible en el código que se publica.
- No crees las tres variables como *Secrets*: el workflow lee *Variables*, y sin ellas la app se
  publica sin sincronización.
- No subas `.env.local` al repositorio.
