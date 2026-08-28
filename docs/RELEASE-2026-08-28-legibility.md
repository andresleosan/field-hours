# Release 2026-08-28 — legibilidad admin/trabajador

## Alcance

- Commit: `7334a64e811434fa13fe8258835a13f4acc90e54`.
- Frontend: contraste WCAG AA, placeholders, etiquetas accesibles, foco y diálogos de las vistas administrativa y de trabajador.
- Backend/datos: sin cambios de Worker, esquema, migraciones ni datos productivos.

## Gate previo

- Typecheck frontend/Worker, lint, build y smoke SheetJS aprobados.
- Worker: 6/6 pruebas.
- Playwright: 16/16; auditoría crítica repetida 15/15 sin reintentos.
- `npm audit --audit-level=high`: 0 vulnerabilidades.

## Despliegue observado

El push solicitado a `main` activó el despliegue automático configurado en Vercel.

- GitHub Actions `Verify #17`, run `33220506253`: `success`.
- Checks de commit `Vercel – fieldhours` y `Vercel – field-hours`: `success`.
- Alias: `https://field-hours.vercel.app`.
- Bundle servido: `assets/index-By-75Z5C.js`, HTTP 200; contiene `account menu` y `admin-project-title`, firmas introducidas por esta release.

## Smoke productivo de solo lectura

- Frontend: HTTP 200.
- Health por proxy Vercel: HTTP 200 con `ok=true`.
- Health directo del Worker: HTTP 200 con `ok=true`.
- `/api/worker/today` sin sesión: HTTP 401 directo y por proxy.
- `/api/admin/shifts/history` sin sesión: HTTP 401 por proxy.
- Cabeceras del frontend: CSP y HSTS presentes; `X-Content-Type-Options: nosniff`.

La navegación autenticada de admin/trabajador permanece validada con datos sintéticos en Playwright; este smoke no inició sesión ni escribió información productiva.

## Rollback

1. Reasignar el alias `field-hours.vercel.app` al despliegue frontend anterior documentado en O.9: `dpl_8bpJsaJuwQYupSdKxijg1PqRutZW`.
2. No modificar el Worker ni D1: esta release no cambió ninguno de los dos.
3. Repetir frontend/health HTTP 200, rutas protegidas HTTP 401 y verificación de cabeceras.
4. Registrar el motivo y la evidencia del rollback en este documento y en `tasks.md`.
