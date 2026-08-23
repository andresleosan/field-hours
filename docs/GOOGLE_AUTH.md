# Google Sign-In para Field Hours

La aplicación principal (`/`, `/join`, `/clock`) mantiene la sesión HttpOnly del Worker de Cloudflare. Google solo verifica la identidad; no se guardan tokens de Google ni se sustituye la sesión local.

## Configuración de Google Cloud

1. Crear un OAuth Client ID de tipo **Web application**.
2. Añadir como redirect URI exacta:
   `https://field-hours.vercel.app/api/auth/google/callback`
3. En Cloudflare Workers configurar:

```text
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

`GOOGLE_REDIRECT_URI` y `APP_ORIGIN` están en `cloudflare/wrangler.jsonc`; deben coincidir con el entorno desplegado. El secreto nunca se imprime ni se envía al navegador.

## Flujo

- Un usuario pulsa **Continue with Google**.
- El Worker valida `state`, el código OAuth, la firma RS256 del ID token, el emisor, la audiencia y `email_verified`.
- Si Google ya está vinculado, se crea la sesión normal de Field Hours.
- Si no está vinculado, se crea una solicitud pendiente. Un correo que ya existe se clasifica como `migration`; un correo nuevo como `access`.
- El administrador aprueba o rechaza desde el panel principal. Aprobar una migración vincula Google a la cuenta existente; aprobar una cuenta nueva crea un trabajador y vincula su identidad.
- Una persona con sesión puede usar **Set up Google sign-in** en el menú de usuario. Para migrar, el correo de Google debe ser exactamente el correo actual.

## Migración y reversión

La migración `0004_google_auth.sql` es aditiva y no elimina ni modifica datos existentes. Antes de aplicarla en producción debe existir un backup verificado. Para revertirla, detener el uso de la función Google, conservar el backup y ejecutar manualmente los tres `DROP TABLE` comentados al final de la migración, en orden inverso de dependencias. Esto elimina solicitudes e identidades Google, por lo que exige confirmación explícita del operador.

Si Google está caído o mal configurado, el login con correo y contraseña sigue disponible; el callback informa un error controlado y no crea una sesión.
