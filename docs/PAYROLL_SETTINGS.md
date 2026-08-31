# Datos base de Salary Advice

La configuración pertenece a una organización y contiene únicamente los datos reutilizables que sí
necesita el Salary Advice. Se guarda en `workforce_salary_advice_settings`.

## Contrato administrativo

- `GET /api/admin/payroll-settings`: devuelve los datos visibles para el administrador o `null` si aún no existen.
- `POST /api/admin/payroll-settings`: guarda los datos; requiere sesión de administrador, origen permitido y `X-CSRF-Token` válido.

El cuerpo de escritura vigente es:

```json
{
  "businessName": "Libertys - Quayside Kitchen",
  "businessAddress": "Jersey"
}
```

- `businessName` y `businessAddress` identifican al empleador en el PDF.
- Cada actualización registra `salary_advice.settings.updated` sin referencias fiscales ni datos bancarios.

El endpoint rechaza campos ajenos al contrato. En particular, ya no acepta una tarifa horaria global,
frecuencia o día de pago, tasas de Social Security, Social Security del empleador, coste del empleador,
Business Tax Reference ni Business Social Reference.

## Datos elegidos para cada documento

La tarifa horaria no es configuración del negocio. El administrador la introduce al preparar cada
Salary Advice y se usa únicamente en ese cálculo; no se guarda como tarifa estándar.

La frecuencia tampoco se guarda aquí. En cada documento el administrador elige:

- un empleado;
- `weekly`, con una semana completa de lunes a domingo; o
- `monthly`, con un mes calendario completo;
- el periodo concreto, la fecha de pago y la tarifa horaria del documento;
- `itisRate`, la tasa ITIS confirmada para ese advice desde el aviso aplicable;
- para `monthly`, `workerSocialSecurityRate` con el único valor 6 (estándar) o 0 (exento), según la tarjeta/aviso confirmado;
- para `weekly`, el importe `weeklyWorkerSocialSecurity` confirmado por el operador según el
  acumulado mensual del empleado o el aviso oficial;
- `yearToDateGrossTaxablePay` y `yearToDateTaxPaid`, acumulados confirmados e inclusivos del documento actual.

ITIS y Social Security no se toman del perfil del trabajador ni de una configuración global. La
aplicación tampoco tiene un ledger que permita derivar automáticamente Social Security semanal o
`Totals to Date`: son valores confirmados por el operador para el documento.

El cálculo solo se habilita cuando existen los datos base del negocio. Los detalles de periodo y
fórmulas están en [PAYROLL_CALCULATIONS.md](PAYROLL_CALCULATIONS.md).

## Persistencia limpia y compatibilidad histórica

La migración aditiva `cloudflare/migrations/0010_salary_advice_contract.sql` crea la tabla activa con
solo `business_name`, `business_address`, fecha y actor de actualización, y copia la identidad desde
`workforce_payroll_settings`. La aplicación ya no escribe valores inertes en las columnas heredadas.

La tabla histórica de `0007` queda intacta para evitar una eliminación destructiva, pero no participa
en lecturas ni escrituras activas. Antes de aplicar `0010` en producción se exige backup verificado,
preflight, rollback revisado y autorización explícita. El rollback elimina únicamente las tablas e
índices nuevos después de exportar cualquier escritura que solo exista en ellos.

## Sin aprobación ni pago

Guardar estos datos no crea una nómina, no aprueba un cálculo y no inicia un pago. Solo habilita la
identidad del empleador que aparecerá en el documento. El flujo activo no solicita ni usa datos bancarios.
