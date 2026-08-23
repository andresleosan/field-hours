# Release: mobile workforce UX

Fecha: 2026-08-23
Git commit: `1fa0a60`

## Cambios

- Cabecera responsive con truncado seguro del nombre de la aplicación.
- Menú de navegación del administrador deslizable en pantallas estrechas.
- Padding lateral reducido en móvil para mejorar el área útil.
- Indicadores de desplazamiento horizontal en tablas grandes.
- Se conserva el bloqueo de zoom móvil.

## Evidencia

- Playwright/Chrome a 390×844 para trabajador y admin: `body.scrollWidth = 390`, igual al viewport; los únicos desplazamientos son contenedores de tablas intencionales.
- Typecheck, build y lint correctos; lint conserva dos warnings previos de i18n.
- Vercel responde HTTP 200 y el bundle contiene las mejoras móviles y el resumen de horas.

## Rollback

Revertir el commit `1fa0a60` y volver a desplegar Vercel. No modifica datos ni requiere migración.
