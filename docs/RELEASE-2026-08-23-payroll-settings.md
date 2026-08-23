# Release: configuración de nómina

Fecha: 23 de agosto de 2026

## Incluido

- El administrador puede configurar tarifa por hora, frecuencia mensual, día de pago, datos del negocio y tasas de seguridad social del trabajador y del empleador.
- La configuración se guarda por organización en `workforce_payroll_settings`.
- Las referencias fiscales del negocio se cifran con `PAYROLL_ENCRYPTION_KEY` y no se devuelven completas en la respuesta administrativa.
- Cada cambio registra `payroll.settings.updated` sin almacenar referencias en el metadata de auditoría.
- El resumen del trabajador calcula el periodo y la próxima fecha usando el día configurado; sin configuración mantiene el día 1.
- Salary Advice usa la tarifa y los datos del negocio configurados cuando existen.

## Despliegue

- Commit: `b8c7ca1` (`feat: configure organization payroll settings`).
- Migración aplicada: `0007_payroll_settings.sql`.
- Backup previo verificado: `cloudflare/backups/field-hours-prod-pre-0007-20260823.sql`.
- Backup: 38,006 bytes.
- SHA-256: `AAC88171B2F6A30D9EEA1E59A360FFBE2BB3D80210DB1D34457CE631AB70D7DF`.
- Worker version: `8ded3898-f096-4932-a3ca-6838398f0042`.
- URL Worker: `https://field-hours-api.andres-san1404.workers.dev`.
- URL aplicación: `https://field-hours.vercel.app`.

## Evidencia

- Frontend typecheck: correcto.
- Worker typecheck: correcto.
- Frontend build: correcto.
- ESLint: 0 errores; dos advertencias preexistentes de Fast Refresh en `src/lib/i18n.tsx`.
- `git diff --check`: correcto.
- Siete migraciones aplicadas en SQLite temporal: correcto.
- Playwright/Chrome a 390×844: guardado de configuración y `scrollWidth = 390`.
- Worker `/api/health`: HTTP 200.
- `GET /api/admin/payroll-settings` sin sesión: Unauthorized.
- Vercel: HTTP 200; bundle contiene `Payroll configuration` y `/api/admin/payroll-settings`.

## Rollback

Si hay que revertir la configuración, usar el backup verificado y aplicar el rollback documentado en `docs/PAYROLL_SETTINGS.md` con aprobación explícita. El rollback elimina solo `workforce_payroll_settings`; el commit anterior de aplicación es `e014c9a`.

## Pendiente

Los porcentajes y la tarifa ahora son configuración. Todavía no se ejecutan cálculos estatutarios automáticos de Jersey, aprobación de nómina ni pagos bancarios.

