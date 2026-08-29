# Release 2026-08-29 — confirmación de fichaje y nómina personalizada

## Diagnóstico

La consulta productiva de solo lectura confirmó que el clock-in de Luis Manuel sí quedó guardado
el 29 de agosto de 2026, con su evento `clock_in` y un turno abierto en estado `working`. No se
modificó esa jornada. El fallo visible estaba en la confirmación del cliente y en la estrategia de
cache de la PWA: una shell antigua podía mantenerse mientras la API ya tenía el dato correcto.

## Cambios

- Después de un fichaje exitoso, la interfaz vuelve a consultar el turno y solo entonces presenta
  el estado confirmado por el servidor.
- El service worker usa network-first para navegaciones, incrementa su cache y nunca intercepta
  escrituras ni rutas `/api/`.
- El administrador puede elegir un trabajador aprobado e introducir sus horas para preparar un
  snapshot de nómina. Tarifa, ITIS, Social Security y datos del negocio siguen viniendo del
  backend.
- El Salary Advice identifica explícitamente las horas introducidas por el administrador.
- No hay migraciones, pagos automáticos ni escrituras de diagnóstico en producción.

## QA y seguridad

- TypeScript frontend/Worker, ESLint, build y SheetJS.
- Worker: 20/20, incluidos cálculo financiero manual, validación/rol y cache PWA.
- E2E funcional: flujo móvil de 40 horas, aprobación y Salary Advice con cifras exactas; regresión
  de clock-in/clock-out, cola offline y turno nocturno.
- E2E visual: 15/15 en Chromium, Firefox y WebKit.
- `npm audit --audit-level=high`: 0 vulnerabilidades.

## Rollback

No existe rollback de datos porque no hay migración. Para revertir, se restaura la versión anterior
del Worker y el despliegue frontend anterior, o se revierte el commit de esta release. Los runs ya
aprobados permanecen inmutables; una reversión del código no borra turnos, perfiles ni snapshots.
