# BRIEF — Field Hours

## Resumen

Field Hours es una aplicación web/PWA para gestionar personal y operaciones de obra: fichaje móvil con evidencia de ubicación, jornadas y descansos, proyectos, historial y reportes, y generación documental de Salary Advice para Jersey. El repositorio también conserva los módulos BuildTrack de gestión de proyectos, trabajos, materiales, herramientas, facturas e invitaciones.

## Usuarios objetivo

- **Trabajador / builder:** registra entradas, descansos y salidas; selecciona o crea proyectos; consulta historial, horas y nómina; completa su perfil; ejecuta tareas operativas de obra.
- **Administrador / manager / owner:** administra usuarios, accesos, proyectos y turnos; revisa evidencias y ajustes; calcula un Salary Advice para un trabajador y periodo concretos y lo descarga; genera reportes y gestiona operaciones de obra.

## Problema que resuelve

Centralizar en una experiencia móvil y auditable la jornada laboral y la operación diaria de cuadrillas de construcción, reduciendo registros manuales dispersos y preparando información confiable para reportes y nómina.

## Alcance funcional vigente

- Autenticación propia por invitación y flujo Google OAuth sujeto a aprobación administrativa.
- Fichaje con GPS, geocercas, funcionamiento PWA/offline e historial auditable.
- Múltiples turnos y descansos, sin solapamientos, con cálculo de tiempo neto.
- Proyectos y obras seleccionables; creación simplificada de proyectos por trabajadores.
- Reportes administrativos, filtros, exportación Excel y ajustes manuales auditados.
- Perfil fiscal cifrado por trabajador, datos identificativos del negocio y reglas estimadas de Jersey 2026.
- Cálculo explícito de un trabajador y un periodo semanal (lunes a domingo) o mensual (mes calendario), seguido de descarga directa de Salary Advice.
- Instalación de la PWA desde el panel de cualquier usuario, incluida la experiencia Android compatible.
- Módulos BuildTrack para jobs, materiales, herramientas, facturas, reportes e invitaciones.
- Interfaz responsive, multi-idioma y orientada a uso móvil en obra.

## Prioridad actual

La Fase 9 implementa y verifica localmente una experiencia workforce centrada en tareas móviles, sin cambiar sus contratos de backend:

1. Colocar el fichaje y el estado operativo como primera tarea del trabajador.
2. Colocar el estado del equipo como primera tarea del administrador y separar la gestión de accesos.
3. Dividir Salary Advice en creación, datos del negocio y empleados, conservando la descarga directa sin aprobación.
4. Sustituir tablas horizontales por representaciones móviles y asegurar diálogos, foco y objetivos táctiles WCAG 2.2.
5. Ampliar el gate reproducible a varios tamaños móviles, idiomas y estados con datos densos antes de considerar terminada la fase.
6. Mantener la nómina como estimación hasta validar formalmente las reglas estatutarias aplicables.

## Reglas de negocio y restricciones

- No ejecutar transferencias bancarias automáticamente.
- El Salary Advice es un documento informativo: generarlo o descargarlo no revisa, aprueba, bloquea ni marca un pago como listo y nunca inicia una transferencia.
- Cada cálculo exige seleccionar un único trabajador y un periodo. La tarifa usada por un documento por horas pertenece a ese cálculo; no existe una tarifa estándar global del negocio.
- La configuración visible del negocio no incluye tarifa estándar, frecuencia/día de pago, cotización patronal ni referencias fiscal/social del negocio.
- El Salary Advice no muestra cotización patronal, referencias fiscal/social del negocio, datos bancarios ni estados de aprobación.
- Los datos fiscales, bancarios y de nómina se consideran sensibles: cifrado, enmascarado, autorización y auditoría son obligatorios.
- Solo puede existir un turno abierto por trabajador, aunque pueda haber varios turnos y descansos por día.
- Las migraciones de producción requieren rollback documentado, backup verificado y confirmación explícita.
- No se usan cuentas, datos reales ni escrituras de producción para pruebas automatizadas.
- Las comprobaciones operativas de producción deben ser de solo lectura; cualquier alerta debe deduplicarse y dejar evidencia accionable sin incluir datos personales.
- Las reglas de nómina actuales corresponden a Jersey 2026 y deben presentarse como estimación cuando corresponda.

## Fuera de alcance inmediato

- Transferencias bancarias o integración automática con un proveedor de pagos.
- Workflow de preview automático para toda la plantilla, revisión/aprobación de nómina, estados “payment ready” o snapshots bloqueados.
- Nómina completa, contabilidad, presentación fiscal, cálculo de coste patronal o acumulados anuales no sustentados por datos reales.
- APK/AAB nativo: la entrega móvil vigente es una PWA instalable; una app Android nativa requeriría una decisión de producto separada.
- Cálculos para jurisdicciones distintas de Jersey.
- Migraciones o despliegues automáticos sin gate humano.
- Rediseño general del subsistema BuildTrack: la fase móvil aprobada se limita a la experiencia workforce de administrador/trabajador y a primitives compartidos que use directamente.

## Criterios de éxito de la fase actual

- Typecheck, lint, build y empaquetado del Worker correctos.
- Suite E2E ejecutable y en verde para nómina, turnos, descansos, proyectos y permisos.
- Cero hallazgos críticos de seguridad abiertos.
- Riesgos altos de dependencias remediados o aceptados explícitamente con mitigaciones.
- Evidencia y rollback documentados antes de cualquier cambio en producción.

## Estado de este documento

Corregido el 30 de agosto de 2026 por instrucción del operador. Esta versión sustituye como alcance vigente las decisiones erróneas de preview global, review/approve payroll, tarifa organizacional y “payment ready” que todavía puedan aparecer en notas históricas. Revisado el 31 de agosto de 2026 tras completar y validar localmente la Fase 9 móvil; el cambio aún no está desplegado.
