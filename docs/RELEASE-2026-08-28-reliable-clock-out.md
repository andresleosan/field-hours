# Release 2026-08-28 — Salida fiable y turnos abiertos entre días

## Objetivo

Evitar que una pérdida de respuesta de red haga creer al trabajador que su `clock_out` quedó
guardado cuando el servidor nunca lo recibió, y mantener accesible cualquier turno todavía abierto
aunque haya cruzado la medianoche.

## Cambios

- El frontend conserva una acción perdida por red en la cola local con la misma `idempotencyKey`.
- La cola se intenta sincronizar de inmediato y cada 15 segundos mientras la aplicación siga abierta.
- Los fallos HTTP reales, incluido CSRF, no se clasifican como fallos de red ni se encolan.
- Los logs de sincronización dejan de incluir la evidencia GPS pendiente.
- El Worker recupera el único turno abierto por organización/trabajador sin limitarlo a `work_date`.
- La vista administrativa prioriza un turno abierto anterior sobre un turno completado del día actual.
- El gate incorpora regresiones específicas del Worker.

## Evidencia y causa raíz

La consulta de solo lectura sobre D1 producción confirmó que el turno investigado tenía `clock_in`
y dos ciclos de break, pero ningún evento `clock_out`. En la auditoría, `old_clock_out` seguía en
`null` antes de los ajustes administrativos del 28 de agosto. La causa fue una rama del frontend
que mostraba “acción encolada” tras un error de `fetch` sin llamar a `queueOfflineAction`.

## Gate previo

- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run typecheck:worker`: aprobado.
- `npm.cmd run lint`: aprobado, sin advertencias.
- `npm.cmd run build`: aprobado.
- `npm.cmd run test:xlsx`: aprobado.
- `npm.cmd run test:worker`: 2/2 aprobadas.
- `npm.cmd run test:e2e`: 9/9 aprobadas en Chromium.
- `npm.cmd audit --audit-level=high`: 0 vulnerabilidades.
- `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc`: aprobado.
- `git diff --check`: aprobado.

## Datos y migraciones

- No hay cambios de esquema ni migraciones D1/Supabase.
- No se modifican automáticamente horas existentes.
- El turno de Luis ya figura `complete` por ajuste administrativo; este release evita la recurrencia.

## Rollback preparado

- Worker vigente antes de esta publicación: `aae02977-f104-407d-98d8-6d5f0174ac30`.
- Vercel vigente antes de esta publicación: `dpl_ES6rStTxxg9zKg39d7UDgsQoT9xa`
  (`fieldhours-9dkdjfosk-andres-leo-san-s-projects.vercel.app`).
- Si falla el Worker: ejecutar `npx wrangler rollback aae02977-f104-407d-98d8-6d5f0174ac30`
  desde `cloudflare/` y repetir health/contratos protegidos.
- Si falla el frontend: promover nuevamente `dpl_ES6rStTxxg9zKg39d7UDgsQoT9xa` desde Vercel
  (CLI o dashboard) y verificar `field-hours.vercel.app`.
- No ejecutar rollback D1: este release no modifica datos ni esquema.

## Resultado de producción

- Código funcional: commit `1da59bd` (`fix: preserve clock-out across network failures`).
- Ajuste de infraestructura CI: commit `476e34e` (`ci: align Playwright browser cache`).
- Worker desplegado: `a65b0a37-6f03-4658-9b89-7f83ea769861` en
  `https://field-hours-api.andres-san1404.workers.dev`.
- Frontend funcional desplegado: `dpl_Fe5dUBNdn17sZ6PAxvKKDBXqeZTr`. El commit posterior de CI
  generó el deployment sin build `dpl_EnLDeCBJWDqC5XGKgGCsmgMR8dA3`, actualmente `Ready` y
  asociado a `https://field-hours.vercel.app`, sin cambiar el bundle funcional.
- Frontend y asset `index-279sHNDI.js`: HTTP 200; el bundle publicado contiene el estado de
  confirmación pendiente del servidor.
- Health directo del Worker y por proxy Vercel: HTTP 200 con `ok=true`.
- `/api/worker/today` sin sesión: HTTP 401 tanto por proxy como directamente; la mutación directa
  sin token CSRF falla cerrada con HTTP 403.
- Cabeceras CSP, HSTS y `X-Content-Type-Options: nosniff`: presentes.
- GitHub Actions `Verify #15`, run `33150543683`: aprobado. El run inicial `#14` no pudo abrir
  Chromium porque instalación y ejecución usaban caches distintas; se alineó
  `PLAYWRIGHT_BROWSERS_PATH` sin modificar lógica de producto.
- No se aplicaron migraciones ni correcciones automáticas de horas.
