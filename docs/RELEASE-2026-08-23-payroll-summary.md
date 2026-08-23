# Release: worker hours and pay date summary

Fecha: 2026-08-23
Git commit: `a56567d`
Worker version: `edf4213d-7b85-48aa-8a20-388e04f58b50`

## Cambios

- Endpoint protegido `GET /api/worker/payroll-summary`.
- Horas y turnos completados del mes actual.
- Total histórico de turnos completados.
- Próxima fecha programada de pago: primer día del mes siguiente, usando la zona horaria de la organización.
- La suma excluye turnos abiertos y no calcula todavía salario, ITIS ni seguridad social.

## Evidencia

- Typecheck frontend y Worker, build y lint correctos; lint conserva dos warnings previos de i18n.
- Prueba móvil con Playwright/Chrome a 390×844: resumen con 7h04m, fecha de cobro y sin overflow horizontal.
- Worker health: HTTP 200.
- Endpoint de resumen sin autenticación: HTTP 401.
- Vercel: HTTP 200, meta de bloqueo de zoom y bundle con la interfaz del resumen.

## Rollback

No requiere migración. Revertir el commit del frontend y volver a desplegar el Worker anterior si fuera necesario; los turnos y el historial no se modifican.
