# Staging OAuth

## Entorno

- Worker: `field-hours-api-staging`
- D1: `field-hours-staging`
- D1 ID: `7b945f18-96c5-4535-a117-7156474e3ca2`
- App origin: `https://field-hours-staging.pages.dev`
- Callback OAuth: `https://field-hours-staging.pages.dev/api/auth/google/callback`
- OAuth client: `field-hours-staging` (`585576689321-ers5athqittecoqj4lrr8j5llpeib90q.apps.googleusercontent.com`)

El entorno `staging` usa una D1 separada y no contiene datos de producción. Los secretos
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `PAYROLL_ENCRYPTION_KEY` deben cargarse por separado
con Wrangler; nunca se versionan ni se copian desde producción.

## Aplicación y verificación

Desde `cloudflare/`:

```sh
npx wrangler d1 migrations apply field-hours-staging --remote --env staging --config wrangler.jsonc
npx wrangler deploy --env staging --config wrangler.jsonc
```

El frontend público de staging está publicado en Pages. Registrar en Google Cloud el origen
`https://field-hours-staging.pages.dev` y exactamente el callback
`https://field-hours-staging.pages.dev/api/auth/google/callback`. Cargar los secretos de staging y
ejecutar el login real; no usar la D1 productiva para esta prueba.

Estado verificado el 27 de agosto de 2026:

- Las migraciones D1 `0001` a `0009` fueron aplicadas en remoto.
- El Worker responde `200` en `/api/health`.
- Pages responde `200` en `/` y `/auth`, y enruta `/api/health` al Worker.
- La prueba OAuth sin secretos responde `503 GOOGLE_AUTH_NOT_CONFIGURED`, como corresponde.
- El último deployment del Worker es `fdb9719e-2955-4fbb-ab2e-422aa7707b68`.

Estado final verificado el 28 de agosto de 2026:

- Los tres secretos de staging están configurados en el Worker.
- Google Cloud conserva el origen y callback únicamente en el cliente `field-hours-staging`.
- El login real con `andres.san1404@gmail.com` llegó a Google, creó una solicitud `access` pendiente,
  fue aprobada por el endpoint administrativo protegido y terminó con sesión activa en Field Hours.
- El administrador técnico usado para la aprobación quedó deshabilitado después de la prueba.

## Rollback

Este staging comienza vacío. Si la inicialización o la prueba falla, revertir la aplicación con el
`rollback` del Worker staging y eliminar únicamente la D1 de staging si se requiere reiniciar el
entorno:

```sh
npx wrangler rollback --env staging --config wrangler.jsonc
npx wrangler d1 delete field-hours-staging --config wrangler.jsonc
```

No ejecutar ningún rollback ni eliminación sobre `field-hours-prod`.
