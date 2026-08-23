# Release: Jersey payroll profile

Fecha: 2026-08-23  
Worker version: `11e1276a-6270-4c2b-8b33-abe194dfc1fb`  
Git feature commit: `60335f6`

## Cambios

- Perfil de nómina de captura única para trabajadores.
- ITIS de 0 a 100%, con dos decimales y revisión administrativa.
- Cifrado AES-256-GCM de identificadores fiscales y bancarios.
- Datos sensibles enmascarados; revelado admin protegido por CSRF y auditado.
- Migración D1 `0006_payroll_profiles.sql` aplicada en producción.

## Evidencia

- Backup verificado: `cloudflare/backups/field-hours-prod-pre-0006-20260823.sql`.
- Tabla `workforce_payroll_profiles` verificada en D1 remoto.
- `/api/health`: HTTP 200.
- `/api/worker/payroll-profile` sin sesión: HTTP 401.
- UI móvil verificada con Playwright/Chrome a 390×844: formulario, guardado simulado y sin overflow horizontal.
- `typecheck`, `typecheck:worker`, `build` y `lint`: correctos; lint conserva dos warnings preexistentes de i18n.

## Rollback

No ejecutar automáticamente. Si fuera necesario, detener el uso del módulo, conservar el backup y, con una nueva confirmación explícita, eliminar manualmente `workforce_payroll_profiles` usando el rollback indicado en `docs/PAYROLL_PROFILE.md`. La clave `PAYROLL_ENCRYPTION_KEY` debe conservarse mientras existan datos cifrados que deban recuperarse.
