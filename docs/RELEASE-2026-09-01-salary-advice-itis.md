# Release 2026-09-01 — ITIS del perfil y Salary Advice automático

Estado: **desplegada y verificada en producción** el 1 de septiembre de 2026, con autorización
explícita del operador.

## Corrección

- El trabajador puede introducir el porcentaje ITIS entero de su aviso vigente en su perfil de nómina.
- El porcentaje queda guardado en `workforce_salary_advice_profiles` y se reutiliza en Salary Advice.
- El administrador continúa asignando la tarifa horaria y puede corregir tarifa e ITIS.
- Salary Advice solo ofrece empleados con identidad, tarifa e ITIS completos y muestra ambos valores
  guardados al seleccionar el empleado.
- Se eliminó la captura manual de tarifa e ITIS por documento, origen de la regresión de la descarga.

## Migración y recuperación

- Migración aplicada: `0011_automatic_salary_advice.sql` sobre D1 `field-hours-prod`.
- Bookmark Time Travel previo: `000000d3-00000000-000050d9-46083ebb862f0a0881b2728c400f1e86`.
- Preflight: `PRAGMA quick_check` devolvió `ok`; `PRAGMA foreign_key_check` devolvió cero filas.
- Verificación posterior: las columnas `hourly_rate_pence` e `itis_rate_bps` existen y no quedan
  migraciones pendientes.
- La migración es aditiva. El rollback preferido conserva las columnas y revierte primero Worker y
  frontend; no se ejecuta `DROP` ni restauración destructiva.

## Despliegues

- Worker `field-hours-api`: versión `fcabe759-3434-4bfe-b35b-a25e34112e95`.
- Frontend Vercel: `dpl_2qum157eRdQA1NvRx7RMtzfUb5fD`, URL inmutable
  `fieldhours-1ds26kb3i-andres-leo-san-s-projects.vercel.app`, alias `field-hours.vercel.app`.
- Commit de código: `5690411`.

## Evidencia

- Typecheck frontend/Worker, lint y build aprobados.
- Worker 39/39, PDF 6/6, E2E completo 45/45 y E2E móvil 16/16.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- Monitor productivo: 10/10; frontend, PWA, Worker, proxy, límites de autenticación y ruta retirada.
- Endpoints nuevos sin sesión: perfil `401` y compensación `403` tanto directo como por proxy; no hubo
  escrituras ni cálculos autenticados con datos reales.

## Rollback preparado

- Worker: volver a `6c551bca-3a7c-4a98-a019-23538c9e379f` con Wrangler.
- Frontend: promover el deployment anterior conocido-bueno `dpl_9CU4g1SLMnk1sFanSxaTBSBAAqvY`.
- D1: conservar las columnas aditivas; cualquier restauración Time Travel o eliminación requiere una
  evaluación nueva y autorización destructiva separada.
