# Descarga de Salary Advice en PDF

## Fuente de verdad

El administrador selecciona un empleado y periodo, introduce una tarifa y confirma ITIS, Social
Security y `Totals to Date` para el documento. El servidor calcula los importes desde los turnos
completos del intervalo y devuelve el resultado de
`POST /api/admin/salary-advice`. El navegador no vuelve a calcular bruto, ITIS, Social Security ni neto:
usa esa respuesta para construir el PDF.

No existe `payroll run`, snapshot aprobado o estado de pago. La identidad y los turnos son los datos
vigentes en el momento de cada cálculo.

## Descarga directa

El PDF se genera en el navegador con `pdf-lib` en A4 horizontal y con texto seleccionable.
Se crea un `Blob` de tipo `application/pdf` y un enlace temporal con el atributo `download`; la acción
descarga el archivo directamente y después revoca la URL temporal.

No se abre popup, vista de impresión ni diálogo de aprobación. El nombre sigue este patrón:

```text
salary-advice_<employee-number>_<period-start>_<period-end>.pdf
```

El número de empleado se normaliza para el nombre de archivo y no se incluye el nombre legal ni una
referencia fiscal en él.

El documento normal ocupa una página. Si una identidad válida no cabe en el bloque de la referencia,
se añade una segunda página con los valores completos: nunca se sustituyen por puntos suspensivos ni
se recortan silenciosamente. Todas las páginas llevan el sello `ESTIMATE`. La ruta habitual usa la
fuente PDF estándar; solo cuando una identidad queda fuera de WinAnsi se cargan de forma diferida
Archivo y GNU Unifont Latin WOFF desde assets del mismo origen y precacheados por la PWA. Los glifos
compatibles se preservan exactamente, sin transliteración.

`pdf-lib`/fontkit no ofrece shaping suficiente para garantizar identidades legales en escrituras
complejas o bidireccionales. Esos textos, un fallo al cargar las fuentes o cualquier glifo ausente
bloquean la generación antes de crear/descargar el archivo y presentan un error específico; nunca se
entrega una identidad visualmente alterada.

La prueba del camino Unicode comprueba tanto extracción exacta del texto como píxeles de tres regiones
dinámicas del PDF renderizado. Este segundo control evita aceptar fuentes que conserven el mapa de
texto interno pero dibujen los glifos en blanco.

## Campos incluidos

El PDF contiene únicamente datos del documento actual:

- título `Salary Advice`;
- sello `ESTIMATE` y aviso de que es un documento informativo;
- nombre y dirección del empleador;
- inicio y fin del periodo, fecha de pago y frecuencia semanal o mensual;
- `Allowances`: `Basic Hourly Pay`, cantidad de turnos completos, tarifa por hora, horas e importe;
- `Deductions`: tasa e importe de Income Tax / ITIS e importe de Employee Social Security; en mensual
  se aplica la selección confirmada de 6% estándar o 0% exento y en semanal se usa el importe confirmado por el operador;
- Gross total y Total deductions;
- número, nombre legal y dirección del empleado;
- Tax Ref y Social Ref del empleado;
- bloque `This advice` con Net Pay del periodo actual;
- bloque `Totals to Date` con Gross Taxable Pay y Tax Paid confirmados e inclusivos del documento actual;
- advertencia sobre el origen confirmado del Social Security cuando el periodo es semanal.

`Totals to Date` no se deriva de un ledger ni se inventa a partir de datos incompletos. El PDF copia
`yearToDateGrossTaxablePay` y `yearToDateTaxPaid`, confirmados por el operador e inclusivos del
documento actual. La respuesta conserva su procedencia en `totalsToDate.source`; también declara el
origen de la deducción en `deductions.workerSocialSecuritySource` como `calculated_monthly` u
`operator_confirmed_weekly`.

## Campos y afirmaciones excluidos

El PDF no contiene:

- Employer Social Security ni employer cost;
- Business Tax Reference ni Business Social Reference;
- datos bancarios, `Bacs` o instrucciones de transferencia; el flujo activo no solicita datos bancarios;
- el campo separado `socialSecurityNumber`; solo usa el `Social Ref` necesario para el formato;
- acumulados calculados o inferidos por la aplicación;
- estados `pending_review`, `approved`, `changes_requested` o `Payment ready`;
- ID de run, firma de aprobación, fecha de aprobación o nota de revisión;
- afirmaciones de que el salario fue pagado o presentado oficialmente.

Generar o descargar el documento no aprueba nada y no inicia un pago.

## Privacidad y controles

- El cálculo exige rol de administrador y queda acotado a la organización autenticada.
- El `POST` exige origen permitido y CSRF válido, y está sujeto a límite de tasa.
- La respuesta de API usa `Cache-Control: no-store`.
- El servidor registra el evento de cálculo sin importes ni referencias fiscales en la metadata.
- El PDF no se almacena en el servidor; queda bajo control del navegador y del dispositivo que lo descarga.

Aunque el PDF excluye datos bancarios, sí contiene identidad y referencias del empleado. Debe tratarse
como un documento sensible y no compartirse fuera de los destinatarios autorizados.

## Verificación esperada

- La acción produce un evento de descarga, no un popup.
- El archivo comienza con la firma `%PDF`, usa el nombre esperado y muestra `ESTIMATE` en cada página.
- Periodo semanal: lunes a domingo; periodo mensual: primer a último día del mes.
- En semanal falta `weeklyWorkerSocialSecurity` → el cálculo se rechaza; si está presente, el PDF usa
  exactamente ese importe sin calcularlo desde una semana aislada.
- En mensual no se solicita el importe semanal y se aplican 6% estándar o 0% exento, redondeo y SEL mensuales.
- ITIS usa el `itisRate` del perfil del empleado seleccionado, confirmado contra su aviso vigente; nunca
  usa una tasa guardada en la configuración del negocio.
- `yearToDateGrossTaxablePay` y `yearToDateTaxPaid` aparecen exactamente como entradas confirmadas e
  inclusivas del documento; no se derivan.
- Importes exactos a dos decimales y `gross - deductions = net`.
- El texto requerido está presente y los campos excluidos no aparecen.
- Identidades largas válidas aparecen completas en una página de continuación; Unicode compatible se
  conserva exactamente y un glifo o layout complejo no soportado bloquea la descarga en vez de
  producir `?`, alterar el orden visual o truncar una identidad.
- La descarga funciona en viewport móvil sin introducir scroll horizontal en la página.
- No se invoca ninguna ruta de revisión, aprobación, pago o transferencia.
