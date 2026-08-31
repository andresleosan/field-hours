# Release 2026-08-31 — experiencia móvil workforce

Estado: **desplegada y verificada en producción** el 31 de agosto de 2026, con autorización explícita del operador.

## Alcance

- Trabajador: navegación `Hoy`, `Historial` y `Horas y pago`; fichaje y proyecto priorizados, turno activo accesible desde vistas secundarias y CTA completo incluso a 320×568.
- Administrador: `En vivo`, `Historial`, `Salary Advice`, `Proyectos` y `Más`; métricas/equipo primero y accesos secundarios compactados.
- Salary Advice: secciones `Crear`, `Negocio` y `Empleados`, selección explícita empleado+periodo y descarga directa. No existe review/approve, payroll run ni “payment ready”.
- Listas densas: 8 registros iniciales y revelado progresivo. Navegar entre secciones, también con Atrás/Adelante, restablece el scroll.
- Accesibilidad: targets táctiles, nombres accesibles, foco confinado y devuelto, Escape, `100dvh`, safe areas y navegación localizada ES/EN/PT.

No se modificaron Worker, endpoints, D1, reglas de cálculo ni PDF.

## Evidencia previa y CI

- Commit funcional: `6386063deae2ad5c0b03deabe67a9fa912dc1ea2` (`feat: optimizar experiencia movil workforce`).
- Local: Chromium 43/43, WebKit 10/10 y Firefox 10/10, todos con `retries=0`; Worker 34/34, PDF 6/6, operaciones 4/4, recuperación D1 sintética, SheetJS, typechecks, lint y build aprobados; auditoría npm con 0 vulnerabilidades.
- GitHub `Verify`: run `33422470403`, job `99587955106`, `success`; incluye gate completo y matriz crítica cross-browser.
- GitHub `Production health`: run `33422929412`, job `99589472743`, `success`; no abrió incidencia.

## Evidencia productiva

- Vercel: `dpl_9CU4g1SLMnk1sFanSxaTBSBAAqvY`, URL inmutable `fieldhours-7ljop9brq-andres-leo-san-s-projects.vercel.app`, objetivo `production`, estado `READY` y alias `field-hours.vercel.app`.
- Los logs de Vercel confirman rama `main`, commit `6386063`, 2.374 módulos transformados, build Vite en 3,40 s y deployment completado.
- Bundle inicial: `index-BjWcdz1P.js`. Contiene `Show more`/`Mostrar más` y descarga directa de Salary Advice; no contiene `Review and approve payroll` ni `Automatic payroll preview`.
- Monitor público 10/10: frontend y headers 200, manifest 200, service worker 200, iconos 200, health proxy/directo 200, límites de autenticación 401 y ruta retirada de payroll review 404.
- Worker productivo sin cambios: deployment `0679ff1a-f75e-4465-8eab-ba5f8a342f5e`, versión `6c551bca-3a7c-4a98-a019-23538c9e379f` al 100%.
- No se usaron credenciales de usuario, no se ejecutaron cálculos Salary Advice autenticados y no hubo escrituras productivas.

## Baseline de rendimiento

Medición Chromium headless sobre `field-hours.vercel.app` a 390×844, tres contextos sin caché de navegador:

- HTTP 200 y 391.619 bytes en 11 recursos iniciales; documento y viewport ambos de 390 px, sin overflow horizontal.
- Primera carga observada: DCL 3.470 ms, `load` 3.473 ms y espera `networkidle` 4.433 ms.
- Repeticiones con CDN caliente: DCL/load 655 ms y 583 ms; espera total 1.399 ms y 1.516 ms.
- Fontkit y Unifont del PDF permanecen diferidos y no aparecen en los recursos iniciales. El build conserva el aviso conocido de chunk `fontkit` mayor a 500 kB, sin regresión de la ruta móvil inicial.

No se aplicó una optimización especulativa: la ruta inicial se mantiene por debajo de 400 kB transferidos y no hay un baseline previo equivalente que demuestre una regresión.

## Rollback preparado

El rollback es exclusivamente frontend:

1. Promover `dpl_26y4U66jrPjnn85GPPkpgAnKn6ph` (`fieldhours-6tjyj73h3-andres-leo-san-s-projects.vercel.app`), deployment `READY` inmediatamente anterior construido desde `main@5898d78`.
2. Ejecutar `node scripts/production-health.mjs` y exigir 10/10.
3. Verificar el bundle/alias y registrar el motivo del rollback.

No revertir Worker ni D1: esta release no los modificó. No usar Time Travel, migraciones ni scripts destructivos para revertir una publicación exclusivamente visual.

Los commits posteriores que solo actualicen estos documentos están excluidos del upload por `.vercelignore`; si la integración Git genera otro deployment, debe conservar el mismo bundle funcional y verificarse nuevamente el alias.
