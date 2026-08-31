# Aprobación de nómina — flujo retirado

Fecha de retiro funcional: 30 de agosto de 2026.

## Estado actual

Este archivo se conserva como marcador para enlaces históricos. El producto ya no tiene un flujo de
`payroll run`, revisión o aprobación. Un Salary Advice es un cálculo puntual para un empleado y un
periodo seleccionados por el administrador; no representa una orden de pago ni un estado de nómina.

El flujo vigente es:

1. El administrador mantiene únicamente el nombre y la dirección del negocio.
2. Elige un empleado con perfil completo.
3. Elige un periodo semanal de lunes a domingo o un mes calendario.
4. Introduce la tarifa por hora y la tasa ITIS confirmada desde el aviso para ese documento.
5. Para Social Security, elige 6% estándar o 0% exento si el periodo es mensual; si es semanal,
   introduce el importe ya confirmado contra el acumulado del mes o el aviso oficial.
6. Introduce Gross Taxable Pay y Tax Paid acumulados, confirmados e inclusivos del documento actual.
7. Pulsa **Calculate and download PDF** para calcular y descargar directamente el Salary Advice.

La respuesta del cálculo conserva `isEstimate: true`. El sistema no aprueba el resultado, no lo marca
como listo para pago y no inicia movimientos bancarios.

## Conceptos retirados

Ya no forman parte del contrato funcional:

- `pending_review`, `approved`, `changes_requested` o `Payment ready`;
- tarjetas de “Review and approve payroll” o previews automáticos de todos los empleados;
- solicitudes de cambios, bloqueo de periodos o aprobación de snapshots;
- historial o roster de `payroll runs`;
- endpoints `/api/admin/payroll-runs`, `/review` y `/payslips` asociados al flujo anterior.

La única operación administrativa de cálculo es `POST /api/admin/salary-advice`. Requiere sesión de
administrador, origen permitido, CSRF válido y está limitada por organización y por tasa de uso.

Las tablas históricas creadas por `cloudflare/migrations/0008_payroll_runs.sql`, si existen en un
entorno, no participan en el flujo actual. Su eliminación sería una migración destructiva separada y
no está autorizada por este cambio documental.

La migración aditiva `0010_salary_advice_contract.sql` separa además las lecturas y escrituras activas
de perfiles/configuración hacia tablas `workforce_salary_advice_*` que no contienen estados de
aprobación, tarifa global, datos bancarios, cotización patronal ni referencias del negocio.

## Ausencia de pago

No existe integración bancaria, transferencia, instrucción de pago ni cambio de estado financiero.
Descargar o volver a descargar un PDF solo crea un archivo local con el cálculo solicitado.
