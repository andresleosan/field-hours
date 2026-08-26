# Exportación final de Salary Advice

## Fuente de verdad

El documento final se genera únicamente desde un `workforce_payroll_run` con estado `approved` y su línea inmutable en `workforce_payroll_run_lines`. El navegador no recalcula bruto, ITIS, Social Security ni neto, y no permite editar esos importes.

- Snapshot aprobado: periodo, fecha de pago, turnos, minutos netos, tasa ITIS e importes en peniques.
- Perfil cifrado vigente: nombre legal, dirección, Tax Ref y Social Ref.
- Configuración vigente: nombre y dirección del negocio.

Las referencias y la identidad no se duplican en el snapshot para evitar otra copia de datos sensibles. Si cambian después de la aprobación, el documento usa el perfil vigente; los importes financieros permanecen bloqueados en el snapshot.

## Contrato API

- `GET /api/admin/payroll-runs/:runId`: detalle del snapshot y líneas de trabajadores, sin referencias fiscales descifradas.
- `POST /api/admin/payroll-runs/:runId/payslips/:userId`: prepara un único Salary Advice final. Requiere sesión admin, origen permitido y CSRF; solo acepta un run `approved` y una línea perteneciente a ese run.
- La respuesta incluye únicamente los datos necesarios para el documento. Excluye número completo de Social Security y datos bancarios.
- Cada preparación registra `payroll.payslip.generated` con run, periodo y trabajador, sin importes ni referencias en metadata.

Errores esperados:

- `404 NOT_FOUND`: run, línea o perfil inexistente.
- `409 PAYROLL_RUN_NOT_APPROVED`: el snapshot todavía no está aprobado.
- `409 PAYROLL_PROFILE_INCOMPLETE`: faltan Tax Ref, Social Ref o identidad necesaria.

## Interfaz y documento

Se conserva el sistema visual “site office” definido en `STACK.md`:

- Paleta: bone/charcoal para lectura documental y ámbar solo como señal de control.
- Tipografía: Archivo para texto y JetBrains Mono para identificadores e importes.
- Layout: el historial de runs funciona como un archivador; cada run aprobado abre su roster bloqueado y desde ahí se prepara un documento por trabajador.
- Elemento firma: banda `Approved · locked snapshot` con ID de run y cifras monoespaciadas.

El Salary Advice muestra Allowances, horas, deducciones, Net Pay, Gross Taxable Pay, Tax Paid, Tax Ref y Social Ref. No afirma que la nómina o la transferencia esté `Paid`, no inicia transferencias y aclara que la aprobación confirma el cálculo, no el movimiento bancario.

## Estrategia de pruebas

- Contrato: run pendiente rechazado; run aprobado devuelve exactamente su línea; usuario ajeno al run devuelve 404; POST exige CSRF.
- Seguridad: trabajador sin controles; datos HTML escapados; sin Social Security completo ni banco; sin rutas de pago/transferencia.
- Finanzas: peniques a libras sin recalcular, total de deducciones coherente y documento con valores exactos del snapshot.
- UI: preparación intencional, popup final, contenido A4 y viewport móvil sin overflow de página.

No se ejecutan pruebas de carga contra producción. El payload es pequeño y acotado a un trabajador; el riesgo relevante es contrato/seguridad, no throughput.

## Implementación local y autocrítica

Estado al 25 de agosto de 2026: implementación local lista, todavía no desplegada.

- Corrección financiera: `grossPay`, ITIS, Social Security y `netPay` salen de la línea guardada en peniques; el navegador solo presenta los valores. La preparación se bloquea con `PAYROLL_RUN_NOT_APPROVED` si el run no está aprobado.
- Seguridad: ambas rutas requieren admin y permanecen acotadas a la organización; el POST exige origen permitido, sesión y CSRF. La respuesta no contiene Social Security Number completo ni datos bancarios, usa `Cache-Control: no-store`, y la auditoría guarda únicamente run, periodo y trabajador.
- Inyección: nombre, dirección, referencias, ID de run y descripciones se escapan antes de escribir el HTML del popup. El documento no carga recursos externos ni ejecuta scripts embebidos.
- UX: se eliminó el flujo anterior de importes manuales. La preparación asíncrona y la impresión son acciones separadas para que `window.open` ocurra directamente desde el clic del administrador y no sea bloqueado por el navegador.
- QA Nivel 3: Playwright valida snapshot pendiente sin acción de documento, snapshot aprobado, cifras exactas, campos obligatorios, escape de HTML, ausencia de rutas de transferencia, separación de rol y viewport 390x844. La API de la suite es simulada; el contrato del Worker se valida además por TypeScript y bundle dry-run, y requerirá smoke autenticado después de un despliegue autorizado.

No se detectaron hallazgos críticos. Como defensa en profundidad no bloqueante se registró la Tarea O.6 en `tasks.md` para limitar el abuso repetitivo de las operaciones privilegiadas de descifrado/preparación.
