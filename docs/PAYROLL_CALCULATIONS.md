# Cálculo automático de nómina Jersey

## Alcance actual

`GET /api/admin/payroll-preview` genera un preview para el periodo de pago configurado. Solo funciona para administradores autenticados y no cambia turnos, perfiles ni estados de pago.

El preview:

- suma minutos netos de turnos completos del periodo;
- calcula el salario bruto con la tarifa horaria de la organización;
- usa el porcentaje ITIS vigente guardado en el perfil del trabajador;
- calcula la contribución primaria del trabajador y la secundaria del empleador;
- muestra ITIS, neto, coste total del empleador y advertencias de perfiles incompletos;
- devuelve `isEstimate: true` y no autoriza pagos ni presenta una declaración oficial.

## Reglas versionadas

La implementación actual está limitada al año de reglas 2026. Si el periodo cruza otro año, devuelve `RULES_NOT_AVAILABLE` para evitar aplicar tasas antiguas silenciosamente.

- Umbral mensual mínimo: £618.
- Standard Earnings Limit mensual: £6,062.
- Upper Earnings Limit mensual: £27,632.
- Primary/employee: la tasa configurada, por defecto 6%, hasta el SEL.
- Secondary/employer: la tasa configurada, por defecto 6.5%, hasta el SEL; 2.5% entre SEL y UEL.
- Si el ingreso mensual está por debajo del umbral, no se calcula Class 1.
- Para la base de seguridad social mensual se redondea hacia abajo a libras enteras, siguiendo la indicación de la calculadora oficial.
- Si falta una tasa ITIS aprobada, se muestra una advertencia y se usa 22% como default de Jersey.
- ITIS incluye la contribución de cuidados de largo plazo (LTC); no se agrega una deducción adicional.

Fuentes oficiales consultadas el 23 de agosto de 2026:

- [Employer contribution rates and calculator](https://www.gov.je/Working/Contributions/Employers/Pages/Tables.aspx)
- [Employing staff and your responsibilities](https://www.gov.je/TaxesMoney/IncomeTax/Employers/Returns/Pages/EmployingStaff.aspx)
- [Calculating and updating your ITIS rate](https://www.gov.je/TaxesMoney/IncomeTax/Individuals/PayingTaxEarnings/Pages/EffectiveTaxRate.aspx)

Las páginas oficiales indican que los resultados de la calculadora son orientativos y que los avisos oficiales de Revenue Jersey prevalecen. Por eso la siguiente tarea debe añadir revisión/aprobación administrativa antes de considerar una nómina lista.

