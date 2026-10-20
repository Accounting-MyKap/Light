# Configuración de Light

Por defecto, Light funciona sin servidor: el progreso queda en el dispositivo. Esta guía conecta la
app a Supabase para que los **invitados** (quienes juegan sin crear cuenta) envíen sus partidas de
forma anónima, sin nombre ni correo, y vean cómo les va frente a otros jugadores (su percentil). Cuando
se agreguen las cuentas, más adelante, sus pasos se sumarán a esta guía.

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
   *publishable key*; las dos están en la configuración de la API del proyecto. Son públicas y van en
   la app. Copia solo la *publishable key*; nunca la *secret* / *service_role*.

2. **Aplicar las 3 migraciones** de `supabase/migrations/`, en este orden:
   1. `20261020000000_core_schema.sql`
   2. `20261020000100_percentile.sql`
   3. `20261020000200_cleanup.sql`

   Puedes pegarlas una por una en el SQL Editor de Supabase, aplicarlas con el conector de Supabase
   (por ejemplo, para que Claude lo haga) o con la CLI (`supabase link` y `supabase db push`).

   Si la tercera migración falla por `pg_cron` (el error nombra esa extensión), detente y ve al
   paso 3.

3. **Verificar `pg_cron`.** En **Database → Extensions**, comprueba que `pg_cron` quedó activa (la
   tercera migración la crea y programa la limpieza semanal de invitados abandonados). En el Supabase
   local la extensión sí está disponible (versión 1.6.4); falta confirmarlo en el proyecto real.

   Si el plan gratuito no la permite: deja aplicadas solo las migraciones 1 y 2, avisa a Claude o a
   quien mantenga el proyecto para que la limpieza semanal pase a un workflow programado de GitHub, y
   sigue con el paso 4. La sincronización funciona igual sin esa limpieza.

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
   → Variables** (la pestaña *Variables*, no *Secrets*), crea estas tres. Pega solo la *publishable
   key*; nunca la *secret* / *service_role*:

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

   GitHub desactiva los workflows programados cuando el repositorio pasa 60 días sin actividad. Si
   eso ocurre, entra a **Actions → Keep Supabase awake** y reactívalo (botón *Enable workflow*).

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
