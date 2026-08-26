# Release: aprobación de nómina y flexibilidad del trabajador

Fecha: 2026-08-25
Estado: desplegado y verificado

## Alcance

- Flujo administrativo para enviar, solicitar cambios y aprobar snapshots inmutables de nómina; no realiza transferencias bancarias.
- Proyectos creados por trabajadores con nombre y descripción opcional.
- Múltiples turnos completados en una misma fecha, manteniendo un único turno abierto.
- Múltiples descansos de duración variable calculados desde eventos.
- Fichaje con GPS sin requerir fotografía.
- Actualización de dependencias con `npm audit` en cero vulnerabilidades.

## Migraciones D1

- `0008_payroll_runs.sql`: tablas e índices de snapshots de nómina.
- `0009_worker_flexibility.sql`: sustituye la unicidad diaria por un índice de consulta y añade `workforce_projects.description`.
- Base: `field-hours-prod`.
- Punto de recuperación previo (Time Travel): bookmark `00000040-00000000-000050d3-d1141dc19fe77f08de333a18256fe5a8`, registrado el 2026-08-26 a las 02:43 UTC sobre una D1 de 294.912 bytes.
- Verificación: `wrangler d1 time-travel info` resolvió el bookmark en `field-hours-prod`; Cloudflare mantiene Time Travel activo y permite restaurar por bookmark. No se creó una copia local con datos personales.

## Evidencia previa

- Typecheck de frontend y Worker, lint, build, smoke SheetJS y Wrangler dry-run correctos.
- Playwright: 5/5 escenarios en verde, incluido viewport móvil 390x844 sin overflow.
- Seguridad: `npm audit` reporta cero vulnerabilidades; no hay hallazgos críticos abiertos.
- Wrangler 4.126.0 confirma que solo `0008` y `0009` están pendientes.

## Puntos de reversión

- Worker anterior: `9e17efbb-0509-4c69-a8af-d0c67f4db332`.
- Vercel anterior: `dpl_FsUWDaxzDstU9P2DHJcrDhbrBVgs` (`fieldhours-7quysrdom-andres-leo-san-s-projects.vercel.app`).

## Procedimiento de rollback

1. Revertir Worker con `npx wrangler rollback 9e17efbb-0509-4c69-a8af-d0c67f4db332 --message "Rollback release 2026-08-25"` desde `cloudflare/`.
2. Revertir el frontend con `npx vercel rollback fieldhours-7quysrdom-andres-leo-san-s-projects.vercel.app` desde la raíz.
3. Verificar `/api/health`, autenticación protegida y carga del frontend. Este rollback de aplicación conserva las migraciones porque son compatibles con la versión anterior.
4. Solo si el esquema fuera la causa y existiera una nueva autorización explícita, elegir una de estas vías destructivas:
   - Restauración íntegra al bookmark previo con `npx wrangler d1 time-travel restore field-hours-prod --bookmark=00000040-00000000-000050d3-d1141dc19fe77f08de333a18256fe5a8`; revierte también cualquier escritura posterior al bookmark.
   - Rollback selectivo: ejecutar la consulta de duplicados documentada en `cloudflare/rollbacks/0009_worker_flexibility.sql`, aplicar ese script y después decidir si también se ejecuta el rollback destructivo de `0008`.

Los scripts SQL de reversión se prueban antes del despliegue sobre una D1 local aislada. En producción no se ejecutan como parte del despliegue normal.

## Resultado del despliegue

- Recuperación D1: bookmark previo verificado `00000040-00000000-000050d3-d1141dc19fe77f08de333a18256fe5a8`.
- Migraciones: `0008` y `0009` aplicadas; no quedan migraciones pendientes, las tablas e índices esperados existen y `pragma_foreign_key_check` devuelve cero violaciones.
- Worker nuevo: `6a65af24-a8c2-4301-9276-9ac8aff12eba` en `field-hours-api.andres-san1404.workers.dev`.
- Vercel nuevo: `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL` (`fieldhours-qf393e35s-andres-leo-san-s-projects.vercel.app`), asignado a `field-hours.vercel.app`.
- Git: despliegue realizado desde el working tree autorizado; commit y push quedan pendientes para no mezclar cambios existentes sin una instrucción explícita.
- Smoke productivo: health directo y por proxy HTTP 200 con `ok=true`; rutas de nómina y creación de proyectos rechazan sesiones ausentes con HTTP 401; frontend HTTP 200 con CSP, `nosniff` y contratos `/api/admin/payroll-runs` y `/api/worker/projects` presentes en el bundle.
- No se crearon cuentas, turnos, proyectos, snapshots ni pagos sintéticos en producción. Los flujos autenticados completos permanecen cubiertos por Playwright 5/5 con datos aislados.
