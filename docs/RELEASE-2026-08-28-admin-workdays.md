# Release 2026-08-28 — Jornadas administrativas y limpieza de datos de nómina

## Objetivo

Eliminar la captura duplicada del número de seguridad social, permitir que un administrador cree
una jornada completa con descripción obligatoria visible para el empleado y corregir la legibilidad
del aviso de intervención administrativa en móvil.

## Cambios

- El perfil de nómina deja de solicitar y revelar el campo social heredado duplicado; su ciphertext
  existente se conserva y no se migra ni elimina.
- El administrador puede crear una jornada completada para un trabajador de su organización, con
  proyecto opcional, entrada, salida y descripción obligatoria de 3 a 300 caracteres.
- El Worker valida rol admin, CSRF, pertenencia de trabajador/proyecto, cronología y ausencia de
  solapamientos, y registra `shift.admin_created` en la auditoría.
- El historial del empleado distingue una jornada creada por administración y muestra su descripción.
- Los ajustes administrativos también rechazan intervalos solapados y recalculan `work_date` cuando
  cambia la entrada.
- El aviso administrativo usa colores con contraste medido `>= 4.5:1` y un layout legible en móvil.
- Un refresh de la vista ya no borra el aviso de éxito después de crear o ajustar una jornada.

## Gate previo

- `npm.cmd run verify`: aprobado — typechecks, lint, build, SheetJS, Worker 6/6, E2E 11/11 y
  `npm audit` con 0 vulnerabilidades.
- Regresión de estabilidad: prueba administrativa 5/5 con `--repeat-each=5 --retries=0`.
- `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc`: aprobado,
  155.53 KiB / 29.94 KiB gzip.
- `git diff --check`: aprobado.
- GitHub Actions `Verify`, run `33218897389`: aprobado para el commit funcional `ade5a6d`.

## Datos y migraciones

- No hay cambios de esquema ni migraciones D1/Supabase.
- No se eliminó ni reescribió el ciphertext social heredado.
- No se crearon jornadas sintéticas ni se modificaron horas existentes durante el despliegue.

## Rollback preparado

- Worker anterior: `a65b0a37-6f03-4658-9b89-7f83ea769861`.
- Vercel anterior: `dpl_9GuBZxc2JW8i81eF9q5cjRbdWqdo`.
- Worker: `npx.cmd wrangler rollback a65b0a37-6f03-4658-9b89-7f83ea769861 --config cloudflare/wrangler.jsonc --env= --yes`.
- Frontend: `npx.cmd vercel promote dpl_9GuBZxc2JW8i81eF9q5cjRbdWqdo --yes`.
- Después de cualquier rollback, repetir health directo/proxy, rutas protegidas y verificación del bundle.
- No ejecutar rollback D1: esta release no modifica datos ni esquema.

## Resultado de producción

- Código funcional: commit `ade5a6d` (`feat: add audited admin workdays`).
- Worker: `4b8794db-af54-42a4-b22c-8b084abd0725` en
  `https://field-hours-api.andres-san1404.workers.dev`.
- Frontend: `dpl_8bpJsaJuwQYupSdKxijg1PqRutZW`, alias
  `https://field-hours.vercel.app`, estado `Ready`.
- Bundle publicado `assets/index-D8UnqKpE.js`: HTTP 200 y contiene el contrato
  `/api/admin/shifts/create` y la interfaz de creación de jornadas.
- Health directo del Worker y por proxy Vercel: HTTP 200 con `ok=true`.
- Historial admin sin sesión: HTTP 401 directo y por proxy; creación admin sin sesión: HTTP 401.
- CSP, HSTS, `X-Content-Type-Options: nosniff` y `frame-ancestors`: presentes.
- No se ejecutó una creación autenticada en producción para evitar insertar una jornada ficticia;
  la mutación está validada por las regresiones aisladas Worker y Playwright.
