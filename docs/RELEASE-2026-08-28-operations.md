# Release operativa — alertas y recuperación D1

## Alcance

- Monitor GitHub Actions después de cada `Verify` exitoso, cada 30 minutos y manual.
- Cinco contratos HTTP productivos de solo lectura.
- Incidencia `production-alert` deduplicada y autocierre al recuperarse.
- Ensayo export/import entre dos D1 locales con datos sintéticos.
- Wrangler `4.127.1` fijado para reproducibilidad local y CI.
- Runbook de Time Travel sin ejecutar restauraciones en producción.

No cambia el frontend, el Worker, el esquema D1, los secretos ni la configuración de Vercel/Cloudflare. Un push a `main` sí activará CI, el nuevo schedule y la integración automática de Vercel, por lo que requiere autorización explícita del operador.

## Evidencia previa

- `npm ci`: 399 paquetes instalados, 0 vulnerabilidades.
- `npm run verify`: typechecks, lint, build, SheetJS, Worker 6/6, operaciones 2/2 más ensayo D1, Playwright 16/16 y audit en verde.
- Recuperación: 50 objetos de esquema y 13 contadores idénticos; cero violaciones FK; producción no accedida.
- Wrangler dry-run: 155.53 KiB / 29.94 KiB gzip, sin despliegue.
- Producción de solo lectura: 5/5 contratos; bookmark Time Travel vigente.

## Procedimiento de publicación y validación

1. Obtener autorización explícita.
2. Crear commit y enviar a `main`.
3. Confirmar GitHub Actions `Verify` en verde.
4. Ejecutar manualmente `Production health` y confirmar sus cinco checks.
5. Confirmar que no se abrió una incidencia `production-alert` y que Vercel terminó correctamente.
6. Repetir smoke HTTP de solo lectura.

## Resultado de publicación

- Implementación: `83177aa`; refuerzo `workflow_run`: `5a469b3`.
- GitHub Actions Verify: `33228132974` y `33229050228`, ambos `success`.
- Production health: run `33229189380`, job `99038776374`, `success`.
- Vercel: contextos `field-hours` y `fieldhours` en `success` para `5a469b3`.
- Incidencias `production-alert` abiertas: 0.
- Smoke independiente posterior: cinco contratos aprobados.

El release quedó desplegado sin modificar Worker, D1, secretos ni datos productivos.

## Rollback

Revertir el commit de esta release y enviar el revert a `main`. Esto elimina el workflow programado y retira `test:ops`/Wrangler del gate. Si existe una incidencia `production-alert` creada por el monitor, cerrarla indicando que el monitor fue retirado. No hay Worker que revertir, migración que deshacer, secreto que rotar ni dato productivo que restaurar.

## Hallazgo separado

O.14 queda fuera de esta release: `PASSWORD_PEPPER` no está configurado como secreto y autenticación conserva un fallback fijo. No se debe rotar ni endurecer en producción hasta probar un procedimiento que mantenga acceso a la cuenta administrativa local.
