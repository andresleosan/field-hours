# Release: Salary Advice final desde snapshot aprobado

Fecha: 25 de agosto de 2026
Estado: desplegado y verificado

## Alcance

- El administrador abre el roster de un payroll run aprobado y bloqueado.
- `GET /api/admin/payroll-runs/:runId` entrega el snapshot y sus líneas sin referencias descifradas.
- `POST /api/admin/payroll-runs/:runId/payslips/:userId` prepara un documento individual, exige admin + origen permitido + CSRF y registra `payroll.payslip.generated`.
- El documento imprimible incluye Allowances, Deductions, Net Pay, Gross Taxable Pay, Tax Paid, Tax Ref y Social Ref.
- Los importes salen de peniques almacenados en `workforce_payroll_run_lines`; no se recalculan en el navegador.
- La respuesta y el documento no contienen Social Security Number completo ni datos bancarios, no afirman que se haya pagado y no inician transferencias.

## Migraciones y rollback

- No hubo cambios de esquema ni migraciones nuevas. `npx wrangler d1 migrations list field-hours-prod --remote` devolvió `No migrations to apply!`.
- Worker anterior para rollback: `6a65af24-a8c2-4301-9276-9ac8aff12eba`.
- Vercel anterior para rollback: `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL` (`fieldhours-qf393e35s-andres-leo-san-s-projects.vercel.app`).
- Si el cambio falla, revertir primero aplicación: `npx wrangler rollback 6a65af24-a8c2-4301-9276-9ac8aff12eba` desde `cloudflare/` y volver a promover el deployment anterior en Vercel. No ejecutar rollback D1 porque el release no modifica el esquema.

## Evidencia local

- `npm.cmd run typecheck`: correcto.
- `npm.cmd run typecheck:worker`: correcto.
- `npm.cmd run build`: correcto; solo conserva la advertencia conocida de Browserslist desactualizado.
- `npm.cmd run test:e2e`: 6/6 pruebas aprobadas, incluyendo aprobación/bloqueo, Salary Advice final, escape HTML, ausencia de banco/SSN/script, rol worker y viewport 390x844.
- `npm.cmd audit --audit-level=high`: 0 vulnerabilidades.
- `npx.cmd wrangler deploy --dry-run`: correcto.

## Despliegue y smoke

- Worker nuevo: `c910ed77-acde-4038-8544-721e2e229817` en `field-hours-api.andres-san1404.workers.dev`.
- Vercel nuevo: `dpl_Bzr7miPjM5Aq9CUs8MqMeLYrDPbS` (`fieldhours-i4o3vqwsw-andres-leo-san-s-projects.vercel.app`), alias `field-hours.vercel.app`.
- Health directo y por proxy: HTTP 200 con `ok=true`.
- `GET /api/admin/payroll-runs` sin sesión: HTTP 401 `UNAUTHENTICATED`.
- `POST /api/admin/payroll-runs/.../payslips/...` sin sesión: HTTP 401 `UNAUTHENTICATED`.
- Frontend: HTTP 200 con CSP, HSTS, `nosniff`, `frame-ancestors 'none'` y `Permissions-Policy`; bundle publicado contiene `Prepare Salary Advice`, la ruta de payslip y el marcador de snapshot aprobado.
- No se crearon usuarios, turnos, proyectos, payroll runs, payslips ni pagos sintéticos en producción.
