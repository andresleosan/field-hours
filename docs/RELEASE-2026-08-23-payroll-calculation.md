# Release: preview automático de nómina Jersey

Fecha: 23 de agosto de 2026

## Incluido

- Endpoint protegido `GET /api/admin/payroll-preview`.
- Cálculo de horas netas de turnos completos del periodo configurado.
- Cálculo de salario bruto con la tarifa de la organización.
- Cálculo de ITIS con la tasa del trabajador y default de 22% cuando falta.
- Cálculo de Class 1 primaria del trabajador y secundaria del empleador usando reglas Jersey 2026.
- Totales de bruto, deducciones, neto, seguridad social patronal y coste total patronal.
- Tabla responsive para el administrador y advertencia visible de que el resultado es estimado.
- Los perfiles no aprobados aparecen con advertencia y sin importes calculados.

## Reglas y límites

- El preview solo calcula periodos del año de reglas 2026; evita aplicar tasas antiguas a futuros años.
- No crea un estado de nómina, no aprueba pagos y no ejecuta transferencias.
- Las reglas están documentadas en [PAYROLL_CALCULATIONS.md](PAYROLL_CALCULATIONS.md) con enlaces a Revenue Jersey.

## Despliegue y evidencia

- Commit: `3971995` (`feat: calculate Jersey payroll preview`).
- Migración adicional: ninguna; usa `workforce_payroll_settings` de la migración 0007 ya desplegada.
- Worker version: `9e17efbb-0509-4c69-a8af-d0c67f4db332`.
- Worker health: HTTP 200.
- Preview sin sesión: HTTP 401.
- Vercel: HTTP 200; bundle contiene `Automatic payroll preview` y `/api/admin/payroll-preview`.
- Frontend build y typecheck: correctos.
- Worker typecheck: correcto.
- ESLint: 0 errores; dos advertencias preexistentes en `src/lib/i18n.tsx`.
- Playwright/Chrome a 390×844: bruto £70.67, ITIS £10.60, neto £60.07 y `scrollWidth = 390`.

## Siguiente paso

Crear el proceso de revisión y aprobación de nómina; el preview no debe convertirse automáticamente en una instrucción de pago.

