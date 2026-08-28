# Reporte de QA — O.2 E2E reproducible

Fecha: 28 de agosto de 2026
Entorno: local, Chromium Playwright 1.57, API completamente simulada
Resultado: **9/9 pruebas E2E y 2/2 regresiones del Worker aprobadas**

## Alcance validado

- Nómina: enviar snapshot, dejarlo pendiente, aprobarlo, bloquearlo como listo para pago sin iniciar transferencias y solicitar cambios con nota obligatoria.
- Salary Advice final: la acción solo aparece para runs aprobados; prepara un trabajador desde el snapshot bloqueado, abre el documento imprimible con cifras exactas, todos los campos requeridos y contenido HTML escapado, sin rutas de pago.
- Autorización: un trabajador no puede ver controles administrativos de aprobación.
- Jornada flexible: crear proyecto, registrar GPS sin foto, dos breaks de 10 y 25 minutos y dos shifts completos el mismo día.
- Cálculos/UI: historial con 35 minutos de break, acumulado de 1h 25m y roster de Salary Advice en viewport móvil 390x844 sin overflow de página.
- Seguridad de sesión: todos los POST incluyen CSRF y, sin cookie CSRF, el cliente falla cerrado antes de enviar la solicitud.

## Evidencia ejecutada

```text
npm.cmd run test:e2e:list    -> 9 pruebas detectadas en 2 archivos
npm.cmd run test:e2e         -> 9 passed (10.6s), también tras React Router 7 / Vite 8
npm.cmd run test:worker      -> 2 passed (turno abierto sin filtro de fecha)
npm.cmd run test:xlsx        -> SheetJS 0.20.3 write/read/JSON/CSV correcto
npm.cmd run verify           -> typechecks, lint, build, SheetJS, Worker 2/2 y E2E 9/9 en verde; `audit` se repitió por separado porque el sandbox bloqueó el registro
npm.cmd ls caniuse-lite      -> caniuse-lite@1.0.30001810 deduplicado
npm.cmd run lint             -> 0 errores, 2 advertencias preexistentes
npm.cmd run typecheck        -> correcto
npm.cmd run typecheck:worker -> correcto
npm.cmd run build            -> correcto
npx.cmd wrangler deploy --dry-run -> correcto, sin despliegue
git diff --check             -> correcto
npm.cmd audit                -> 0 vulnerabilidades
```

El reporte HTML reproducible queda en `qa/reports/playwright/index.html`; sus trazas, videos y capturas de fallos se conservan localmente bajo `qa/reports/` y no se versionan.

## Pruebas avanzadas

- **Contrato UI/API:** el mock valida método y ruta, cuerpos exactos de proyecto, decisiones de nómina y preparación de Salary Advice, idempotency key, GPS, CSRF, ausencia de `photo` y ausencia de rutas de pago/transferencia.
- **Casos límite de seguridad:** separación de rol worker/admin, run pendiente sin controles de documento, escape de contenido malicioso en el HTML imprimible, fallo cerrado sin CSRF y bloqueo de toda solicitud hacia hosts externos durante la suite.

## Verificación adicional — O.6 (26 de agosto de 2026)

- Worker local con D1 aislada: 10 solicitudes de revelado sintético devolvieron `404`; la número 11
  devolvió `429 PAYROLL_RATE_LIMITED` con `Retry-After: 900`.
- Tras mover el contador sintético fuera de la ventana, la siguiente solicitud volvió a `404`, lo
  que confirma la recuperación sin exponer referencias, importes ni datos de perfil.
- **Carga:** no aplica a esta tarea de infraestructura E2E local. No se ejecutará carga contra producción; se difiere hasta disponer de staging aislado y datos sintéticos.

## Verificación adicional — O.8 (28 de agosto de 2026)

- **Evidencia productiva de solo lectura:** el turno investigado no contenía un evento `clock_out`; la auditoría conservaba `old_clock_out = null` hasta dos ajustes administrativos del 28 de agosto. Esto descarta una reactivación del backend y confirma una salida nunca persistida.
- **Regresión Worker:** 2/2 pruebas validan que el turno abierto se busca por organización/usuario sin limitarlo a `work_date`, y que la ausencia de turno devuelve `null`.
- **Contrato UI/API:** Playwright corta la primera respuesta de `clock_out`; la app conserva la acción, la reintenta con la misma `idempotencyKey`, completa un solo turno y vacía la cola. Otra prueba recupera y cierra un turno abierto de la fecha anterior.
- **Seguridad:** los errores HTTP/CSRF no se encolan como fallos de red, el GPS pendiente ya no se escribe en consola y la consulta de turno continúa aislada por organización/usuario. `npm audit` devolvió 0 vulnerabilidades.
- **Carga:** no aplica; el cambio añade como máximo un reintento inmediato y uno cada 15 segundos únicamente mientras exista una cola pendiente. No se ejecutó carga contra producción.
- **Bundle Worker:** `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc` correcto (151,22 KiB / 29,33 KiB gzip), sin despliegue.

## Gate y smoke de producción

La autorización explícita se recibió y el gate se completó el 25 de agosto de 2026:

- Rollback `0008/0009` probado en una D1 local aislada y recuperación previa registrada con un bookmark de Time Travel.
- Migraciones `0008_payroll_runs.sql` y `0009_worker_flexibility.sql` aplicadas sin pendientes; cero violaciones de claves foráneas.
- Worker `c910ed77-acde-4038-8544-721e2e229817` y Vercel `dpl_Bzr7miPjM5Aq9CUs8MqMeLYrDPbS` desplegados para el Salary Advice final; rollback a Worker `6a65af24-a8c2-4301-9276-9ac8aff12eba` y Vercel `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL`.
- Health directo y por proxy HTTP 200 con `ok=true`; rutas nuevas protegidas rechazan solicitudes sin sesión con HTTP 401.
- Frontend HTTP 200, cabeceras CSP/HSTS/`nosniff`/`frame-ancestors` presentes y contratos de nómina/proyectos/Salary Advice incluidos en el bundle.

No se crearon datos sintéticos ni se ejecutaron pagos en producción. Los recorridos autenticados y las mutaciones permanecen validados por la suite Playwright aislada 6/6; el detalle de esta publicación está en `docs/RELEASE-2026-08-25-final-salary-advice.md`.
