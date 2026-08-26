# Reporte de seguridad de dependencias — O.3

Fecha: 25 de agosto de 2026
Resultado: **0 vulnerabilidades en `npm audit`**

## Cambios aplicados

| Área | Antes | Después | Motivo y validación |
|---|---|---|---|
| Router | `react-router-dom` 6.30.1 | 7.18.2 | Corrige redirecciones externas y avisos posteriores; la aplicación usa modo declarativo y conserva la API. Typecheck, build y E2E aprobados. |
| Build | Vite 5.4.19 | 8.2.2 | Corrige bypass de `server.fs.deny` en Windows y elimina la dependencia vulnerable de esbuild. Configuración migrada de `manualChunks` objeto a función Rolldown. |
| React/Vite | plugin SWC 3.11.0 y `lovable-tagger` 1.1.11 | 4.3.3 y 1.3.3 | Versiones con peer support para Vite 8. |
| Hojas de cálculo | `xlsx` 0.18.5 de npm | SheetJS CE 0.20.3, tarball oficial | Corrige prototype pollution y ReDoS manteniendo la API usada para importación/exportación. Smoke de write/read/JSON/CSV aprobado. |
| CSS y transitivas | PostCSS 8.5.6 y versiones vulnerables de lodash, nanoid, picomatch, ws, glob/minimatch/brace-expansion/yaml | Versiones compatibles corregidas | Aplicadas mediante `npm audit fix` sin scripts de instalación. |
| Playwright | Dependencia de producción | `devDependency` | Evita incluir tooling E2E en el árbol productivo. |

El tarball de SheetJS queda fijado por URL, versión e integridad SHA-512 en `package-lock.json`. La instalación recomendada proviene de la [documentación oficial de SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Evidencia de regresión

```text
npm.cmd audit                -> found 0 vulnerabilities
npm.cmd ls --depth=0         -> árbol válido, exit 0
npm.cmd run test:xlsx        -> correcto
npm.cmd run typecheck        -> correcto
npm.cmd run typecheck:worker -> correcto
npm.cmd run lint             -> 0 errores, 2 advertencias preexistentes
npm.cmd run build            -> correcto con Vite 8.2.2
npm.cmd run test:e2e         -> 5 passed
git diff --check             -> correcto
```

## Fuentes y criterio

- [SheetJS: instalación oficial de la versión 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- [React Router: advisory de redirección, corregido desde 7.18.0](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6).
- [React Router: la alerta SSR no afecta el modo declarativo](https://github.com/advisories/GHSA-337j-9hxr-rhxg).
- [Vite 8: requisitos, compatibilidad y migración a Rolldown](https://vite.dev/blog/announcing-vite8).
- [Plugin React SWC: soporte de Vite 8 desde 4.3.0](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc/CHANGELOG.md).

## Autocrítica de seguridad

- No se añadieron endpoints, permisos, secretos ni integraciones con datos reales.
- La fuente externa nueva es el CDN oficial de SheetJS y el lockfile verifica su integridad.
- No quedan vulnerabilidades conocidas según el audit ejecutado.
- El aumento del chunk `xlsx` (aprox. 16 KiB gzip) se acepta frente a eliminar dos vulnerabilidades altas en un parser que procesa archivos aportados por usuarios.
- No hubo despliegue, migración D1 ni interacción con producción.
