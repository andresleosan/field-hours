# Release 2026-08-28 — paridad de cabeceras en Pages staging

Estado: desplegada y validada en staging el 29 de agosto de 2026.

## Alcance

- añade a las respuestas estáticas de `field-hours-staging.pages.dev` las siete cabeceras declaradas en `vercel.json` y el HSTS que Vercel sirve en producción;
- aplica la política dentro de `public/_worker.js` porque Pages usa Advanced Mode y las reglas `_headers` no cubren respuestas generadas por Pages Functions;
- conserva `status`, cuerpo, `Content-Type`, caché y demás metadatos de `env.ASSETS.fetch()`;
- deja las rutas `/api/*` bajo las cabeceras originales del Worker backend;
- incorpora una prueba de contrato que impide divergencias futuras entre Pages y Vercel.

No cambia el frontend, la API, D1, autenticación, secretos ni producción.

## Seguridad y pruebas avanzadas

- checklist de seguridad: sin endpoints, permisos, entradas, datos sensibles o secretos nuevos;
- contrato Pages estático → navegador: las siete cabeceras coinciden exactamente con `vercel.json` y HSTS coincide con producción;
- contrato Pages `/api/*` → Worker: hostname de staging conservado y sin sobrescribir cabeceras del backend;
- `npm.cmd run verify`: typechecks, lint, build, SheetJS, Worker 14/14, operaciones/Pages 4/4, recuperación D1 y Playwright 16/16 aprobados;
- `npm.cmd audit --audit-level=high`, repetido con acceso de red: 0 vulnerabilidades;
- carga no aplica: el cambio copia siete pares nombre/valor solo en respuestas estáticas.

## Despliegue y verificación

- proyecto confirmado: `field-hours-staging` (Direct Upload, dominio `field-hours-staging.pages.dev`);
- deployment productivo previo de Pages: `e3ce3163-0bba-47e2-aa72-24d685d335c3`;
- primera publicación `8021b026`: CSP y los otros seis headers aprobados; el smoke detectó HSTS ausente y obligó a una segunda vuelta del ciclo antes del cierre;
- deployment final: `9402ae49-bf50-4bca-b8ce-ea47c60da701` (`https://9402ae49.field-hours-staging.pages.dev`);
- smoke del alias y del deployment inmutable: 5/5 en ambos; frontend y health directo/proxy HTTP 200, límites Worker/proxy HTTP 401, CSP, HSTS y `nosniff` presentes.

## Rollback

Si el smoke remoto falla, restaurar desde Cloudflare Pages → `field-hours-staging` → Deployments el deployment exitoso `e3ce3163-0bba-47e2-aa72-24d685d335c3`. La reversión solo cambia archivos estáticos/Pages Functions de staging; no toca Worker, D1, secretos ni producción.
