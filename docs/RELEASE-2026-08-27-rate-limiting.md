# Release: Rate limiting de operaciones sensibles

Fecha: 27 de agosto de 2026
Estado: desplegado y verificado

## Alcance

- Limitar el revelado administrativo de perfiles de nómina a 10 solicitudes por 15 minutos.
- Limitar la preparación de Salary Advice a 30 solicitudes por 15 minutos.
- Responder con `429 PAYROLL_RATE_LIMITED` y `Retry-After` cuando se agote el cupo.
- Mantener claves persistidas con SHA-256 namespaced, sin almacenar nombres, referencias fiscales ni importes.

## Configuración aplicada

| Variable | Valor |
| --- | ---: |
| `PAYROLL_PROFILE_REVEAL_LIMIT` | `10` |
| `PAYROLL_PROFILE_REVEAL_WINDOW_SECONDS` | `900` |
| `PAYROLL_PAYSLIP_LIMIT` | `30` |
| `PAYROLL_PAYSLIP_WINDOW_SECONDS` | `900` |

No se aplicaron migraciones D1. La tabla `workforce_auth_attempts` ya existente conserva el contador.

## Despliegue y smoke

- Worker: `field-hours-api`.
- Nueva versión: `aae02977-f104-407d-98d8-6d5f0174ac30`.
- Health: `GET /api/health` devuelve HTTP 200 con `{"ok":true,"service":"field-hours-api"}`.
- Autorización: `GET /api/admin/payroll-runs` sin sesión devuelve HTTP 401.
- No se ejecutaron pagos, transferencias ni escrituras sintéticas en producción.

## Evidencia previa

- `npm.cmd run verify`: typechecks, lint sin advertencias, build, smoke SheetJS, E2E 6/6 y `npm audit` con 0 vulnerabilidades.
- Prueba local de rate limiting: intentos 1–10 con `404`, intento 11 con `429` y recuperación fuera de ventana con `404`.

## Rollback

Si la versión nueva presenta un problema, revertir primero el Worker a la versión anterior:

```text
npx wrangler rollback c910ed77-acde-4038-8544-721e2e229817
```

No ejecutar rollback D1: este release no modifica el esquema.
