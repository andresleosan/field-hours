# Reporte de QA — O.2 E2E reproducible

Fecha: 25 de agosto de 2026
Entorno: local, Chromium Playwright 1.57, API completamente simulada
Resultado: **6/6 pruebas aprobadas**

## Alcance validado

- Nómina: enviar snapshot, dejarlo pendiente, aprobarlo, bloquearlo como listo para pago sin iniciar transferencias y solicitar cambios con nota obligatoria.
- Salary Advice final: la acción solo aparece para runs aprobados; prepara un trabajador desde el snapshot bloqueado, abre el documento imprimible con cifras exactas, todos los campos requeridos y contenido HTML escapado, sin rutas de pago.
- Autorización: un trabajador no puede ver controles administrativos de aprobación.
- Jornada flexible: crear proyecto, registrar GPS sin foto, dos breaks de 10 y 25 minutos y dos shifts completos el mismo día.
- Cálculos/UI: historial con 35 minutos de break, acumulado de 1h 25m y roster de Salary Advice en viewport móvil 390x844 sin overflow de página.
- Seguridad de sesión: todos los POST incluyen CSRF y, sin cookie CSRF, el cliente falla cerrado antes de enviar la solicitud.

## Evidencia ejecutada

```text
npm.cmd run test:e2e:list    -> 6 pruebas detectadas en 2 archivos
npm.cmd run test:e2e         -> 6 passed (8.7s), también tras React Router 7 / Vite 8
npm.cmd run test:xlsx        -> SheetJS 0.20.3 write/read/JSON/CSV correcto
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
- **Carga:** no aplica a esta tarea de infraestructura E2E local. No se ejecutará carga contra producción; se difiere hasta disponer de staging aislado y datos sintéticos.

## Gate y smoke de producción

La autorización explícita se recibió y el gate se completó el 25 de agosto de 2026:

- Rollback `0008/0009` probado en una D1 local aislada y recuperación previa registrada con un bookmark de Time Travel.
- Migraciones `0008_payroll_runs.sql` y `0009_worker_flexibility.sql` aplicadas sin pendientes; cero violaciones de claves foráneas.
- Worker `c910ed77-acde-4038-8544-721e2e229817` y Vercel `dpl_Bzr7miPjM5Aq9CUs8MqMeLYrDPbS` desplegados para el Salary Advice final; rollback a Worker `6a65af24-a8c2-4301-9276-9ac8aff12eba` y Vercel `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL`.
- Health directo y por proxy HTTP 200 con `ok=true`; rutas nuevas protegidas rechazan solicitudes sin sesión con HTTP 401.
- Frontend HTTP 200, cabeceras CSP/HSTS/`nosniff`/`frame-ancestors` presentes y contratos de nómina/proyectos/Salary Advice incluidos en el bundle.

No se crearon datos sintéticos ni se ejecutaron pagos en producción. Los recorridos autenticados y las mutaciones permanecen validados por la suite Playwright aislada 6/6; el detalle de esta publicación está en `docs/RELEASE-2026-08-25-final-salary-advice.md`.
