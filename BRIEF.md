# BRIEF — Field Hours

## Resumen

Field Hours es una aplicación web/PWA para gestionar personal y operaciones de obra: fichaje móvil con evidencia de ubicación, jornadas y descansos, proyectos, historial y reportes, y un módulo de nómina de Jersey con controles administrativos. El repositorio también conserva los módulos BuildTrack de gestión de proyectos, trabajos, materiales, herramientas, facturas e invitaciones.

## Usuarios objetivo

- **Trabajador / builder:** registra entradas, descansos y salidas; selecciona o crea proyectos; consulta historial, horas y nómina; completa su perfil; ejecuta tareas operativas de obra.
- **Administrador / manager / owner:** administra usuarios, accesos, proyectos y turnos; revisa evidencias y ajustes; configura y aprueba nómina; genera reportes y Salary Advice; gestiona operaciones de obra.

## Problema que resuelve

Centralizar en una experiencia móvil y auditable la jornada laboral y la operación diaria de cuadrillas de construcción, reduciendo registros manuales dispersos y preparando información confiable para reportes y nómina.

## Alcance funcional vigente

- Autenticación propia por invitación y flujo Google OAuth sujeto a aprobación administrativa.
- Fichaje con GPS, geocercas, funcionamiento PWA/offline e historial auditable.
- Múltiples turnos y descansos, sin solapamientos, con cálculo de tiempo neto.
- Proyectos y obras seleccionables; creación simplificada de proyectos por trabajadores.
- Reportes administrativos, filtros, exportación Excel y ajustes manuales auditados.
- Perfil de nómina cifrado por trabajador, configuración organizacional y reglas estimadas de Jersey 2026.
- Preview de nómina, revisión/aprobación administrativa y generación de Salary Advice.
- Módulos BuildTrack para jobs, materiales, herramientas, facturas, reportes e invitaciones.
- Interfaz responsive, multi-idioma y orientada a uso móvil en obra.

## Prioridad actual

Cerrar la Fase 7 con evidencia verificable:

1. Restaurar la gobernanza Cronos/DDD del proyecto.
2. Reparar y ejecutar la suite E2E reproducible.
3. Validar el flujo de revisión/aprobación de nómina y la flexibilidad laboral.
4. Solo con autorización del operador, aplicar las migraciones D1 `0008` y `0009` y desplegar.
5. Completar después el payslip final con todos los campos de Salary Advice.

## Reglas de negocio y restricciones

- No ejecutar transferencias bancarias automáticamente.
- Un pago solo puede quedar listo después de revisión y aprobación administrativa explícita.
- Los datos fiscales, bancarios y de nómina se consideran sensibles: cifrado, enmascarado, autorización y auditoría son obligatorios.
- Solo puede existir un turno abierto por trabajador, aunque pueda haber varios turnos y descansos por día.
- Las migraciones de producción requieren rollback documentado, backup verificado y confirmación explícita.
- No se usan cuentas, datos reales ni escrituras de producción para pruebas automatizadas.
- Las reglas de nómina actuales corresponden a Jersey 2026 y deben presentarse como estimación cuando corresponda.

## Fuera de alcance inmediato

- Transferencias bancarias o integración automática con un proveedor de pagos.
- Cálculos para jurisdicciones distintas de Jersey.
- Migraciones o despliegues automáticos sin gate humano.
- Rediseño general de los módulos que ya están operativos mientras se cierra el gate de QA.

## Criterios de éxito de la fase actual

- Typecheck, lint, build y empaquetado del Worker correctos.
- Suite E2E ejecutable y en verde para nómina, turnos, descansos, proyectos y permisos.
- Cero hallazgos críticos de seguridad abiertos.
- Riesgos altos de dependencias remediados o aceptados explícitamente con mitigaciones.
- Evidencia y rollback documentados antes de cualquier cambio en producción.

## Estado de este documento

Reconstruido el 25 de agosto de 2026 a partir del código, `tasks.md`, documentos de release y configuración existente. Requiere confirmación del operador junto con `STACK.md` antes de retomar cambios funcionales.
