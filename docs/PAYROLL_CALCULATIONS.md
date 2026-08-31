# Cálculo de Salary Advice para Jersey

## Alcance actual

`POST /api/admin/salary-advice` calcula un Salary Advice para un único empleado y un periodo elegido
por el administrador. Requiere sesión administrativa, organización válida, origen permitido, CSRF y
el límite de tasa de generación de documentos.

Ejemplo semanal:

```json
{
  "userId": "worker-user-id",
  "periodType": "weekly",
  "periodStart": "2026-08-24",
  "payDate": "2026-08-30",
  "hourlyRate": 15,
  "itisRate": 15,
  "weeklyWorkerSocialSecurity": 48.48,
  "yearToDateGrossTaxablePay": 17928.5,
  "yearToDateTaxPaid": 2554.08
}
```

Ejemplo mensual:

```json
{
  "userId": "worker-user-id",
  "periodType": "monthly",
  "periodStart": "2026-08-01",
  "payDate": "2026-08-31",
  "hourlyRate": 15,
  "itisRate": 15,
  "workerSocialSecurityRate": 6,
  "yearToDateGrossTaxablePay": 17928.5,
  "yearToDateTaxPaid": 2554.08
}
```

Además de identificar empleado, periodo, fecha de pago y tarifa, la solicitud incluye valores
confirmados para el documento:

- `itisRate`, tomada del aviso aplicable y no del perfil del trabajador;
- `weeklyWorkerSocialSecurity`, importe GBP obligatorio solo para `weekly`, confirmado usando el
  acumulado del mes calendario o el aviso oficial;
- `workerSocialSecurityRate`, obligatorio solo para `monthly` y limitado a 6 (estándar) o 0 (exento);
- `yearToDateGrossTaxablePay` y `yearToDateTaxPaid`, confirmados e inclusivos del documento actual.

`itisRate` es un porcentaje entero de 0 a 100. Los importes confirmados son no negativos, admiten
hasta dos decimales y un máximo de £10,000,000. El contrato rechaza enviar
`weeklyWorkerSocialSecurity` en mensual o `workerSocialSecurityRate` en semanal. También rechaza
campos adicionales, incluidos estados o decisiones de aprobación.

## Selección de empleado y periodo

- El cálculo consulta solo al empleado seleccionado y exige que pertenezca a la organización y tenga un perfil completo.
- `weekly`: `periodStart` debe ser lunes y el servidor deriva el domingo como fecha final.
- `monthly`: `periodStart` debe ser el primer día del mes y el servidor deriva el último día del mes.
- `payDate` no puede ser anterior al inicio del periodo; la interfaz propone como valor inicial el final del periodo.
- La interfaz permite escoger cada semana o cada mes de las reglas disponibles, no un periodo automático para toda la plantilla.

Solo se agregan turnos con estado `complete`, `clock_out_at` presente y `work_date` dentro del intervalo
inclusivo. Las pausas registradas se descuentan para obtener los minutos netos.

## Tarifa y fórmulas

La tarifa horaria se recibe para este documento, admite de £0.01 a £10,000 con hasta dos decimales y
no se persiste como configuración del negocio. Los cálculos monetarios se realizan en peniques:

1. `gross = round(netMinutes × hourlyRatePence / 60)`.
2. `ITIS = round(gross × itisRateBps / 10,000)` usando `itisRate`, confirmado para este advice.
3. En `monthly`, `workerSocialSecurity` se calcula al 6% o al 0% según la selección confirmada y las reglas mensuales indicadas abajo.
4. En `weekly`, `workerSocialSecurity` es exactamente el importe `weeklyWorkerSocialSecurity` confirmado por el operador; no se deriva del bruto semanal aislado.
5. `totalDeductions = ITIS + workerSocialSecurity`.
6. `netPay = max(0, gross - totalDeductions)`.

Social Security no puede superar el bruto del advice y las deducciones totales tampoco pueden
superarlo. Para garantizar que `Totals to Date` sea inclusivo, el bruto acumulado debe ser al menos el
bruto actual, el impuesto acumulado debe ser al menos el ITIS actual y nunca puede superar el bruto acumulado.
Un acumulado incoherente responde `400 INVALID_TOTALS_TO_DATE`; si las deducciones confirmadas
superan el bruto, responde `409 DEDUCTIONS_EXCEED_GROSS`.

No se calcula Social Security del empleador, coste del empleador, impuestos del negocio ni datos de
pago. La respuesta mantiene `isEstimate: true`.

## Reglas 2026 y Social Security

La implementación está limitada al año de reglas 2026. Inicio, fin del periodo y fecha de pago deben
permanecer dentro de 2026; en caso contrario responde `RULES_NOT_AVAILABLE` para evitar aplicar reglas
no configuradas.

- Mensual: el bruto se redondea hacia abajo a libras enteras; por debajo de £618 la contribución es cero.
- Mensual: la base está limitada al Standard Earnings Limit de £6,062.
- Mensual estándar: se aplica 6%; mensual exento: se aplica 0%.

### Advertencia obligatoria para periodos semanales

Un Salary Advice semanal no conoce por sí solo todas las ganancias acumuladas del empleado durante
el mes calendario. Como no existe un ledger mensual en la aplicación, el sistema **no calcula Social
Security aislando la semana**. Exige `weeklyWorkerSocialSecurity`, un importe confirmado por el
operador según las ganancias corridas del mes o el aviso oficial, y lo copia sin sustituirlo por una
fórmula semanal automática.

La respuesta conserva el código estable
`WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED`; interfaz y PDF lo traducen sin depender de un texto
inglés enviado por el servidor. El importe debe volver a confirmarse si cambian los turnos o el
acumulado mensual antes de regenerar el Salary Advice.

Fuentes oficiales de referencia:

- [Employer contribution rates and calculator](https://www.gov.je/Working/Contributions/Employers/Pages/Tables.aspx)
- [Employing staff and your responsibilities](https://www.gov.je/TaxesMoney/IncomeTax/Employers/Returns/Pages/EmployingStaff.aspx)
- [Calculating and updating your ITIS rate](https://www.gov.je/TaxesMoney/IncomeTax/Individuals/PayingTaxEarnings/Pages/EffectiveTaxRate.aspx)

Los avisos oficiales de Revenue Jersey prevalecen sobre el cálculo de la aplicación.

## Renovación anual y backlog Jersey 2027

La página oficial de contribuciones consultada el 31 de agosto de 2026 publica el calculador y los
límites 2026. Este documento no presupone cifras para 2027: hasta verificar una tabla o aviso oficial
aplicable, todo periodo o fecha de pago de 2027 debe continuar respondiendo `RULES_NOT_AVAILABLE`.

El backlog `JER-2027` de `tasks.md` exige, en este orden:

1. registrar fuentes oficiales, fecha de vigencia, tasas, límites, mínimos, redondeos y tratamiento semanal/mensual;
2. añadir un ruleset 2027 separado sin modificar los resultados reproducibles de 2026;
3. cubrir límites de año, semanas/meses, Social Security, ITIS confirmado, PDF y exclusiones negativas;
4. actualizar UI y documentación solo después del contrato backend, y desplegar únicamente con autorización y rollback.

No se reutiliza una tasa 2026 por similitud ni se activa 2027 para “probar”. Si una fuente oficial y
un aviso individual entran en conflicto, prevalece el aviso y el Salary Advice continúa presentándose
como estimación verificable.

## Resultado y persistencia

La respuesta contiene periodo, identidad mínima del empleador y del empleado, Basic Hourly Pay,
horas, ITIS, Social Security del trabajador, total de deducciones, Gross Taxable Pay y Tax Paid del
documento, Net Pay y los dos valores confirmados de `Totals to Date`. Además declara:

- `deductions.workerSocialSecuritySource`: `calculated_monthly` o `operator_confirmed_weekly`;
- `totalsToDate.grossTaxablePay` y `totalsToDate.taxPaid`;
- `totalsToDate.source: "operator_confirmed"`, para dejar explícito que los acumulados no fueron inferidos.

El cálculo registra `salary_advice.calculated` con empleado, tipo e intervalo del periodo y cantidad
de turnos, sin importes ni referencias fiscales en la metadata. No crea un snapshot, historial o
ledger y no deriva `Totals to Date`. `yearToDateGrossTaxablePay` y `yearToDateTaxPaid` son entradas
confirmadas por el operador que ya incluyen el documento actual; la aplicación no rellena ni inventa
acumulados anteriores ni persiste esos importes. Volver a calcular consulta los turnos y datos vigentes.

No existe paso de revisión, aprobación, marcado como listo para pago ni transferencia bancaria. ITIS
ya no se define en el perfil del trabajador y el flujo activo no requiere datos bancarios.

Perfiles e identidad del negocio se leen de `workforce_salary_advice_profiles` y
`workforce_salary_advice_settings`, creadas por la migración aditiva `0010`. Las tablas históricas de
perfiles, settings y runs no participan en el cálculo vigente.
