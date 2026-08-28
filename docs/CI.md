# Gate CI y actualización de Browserslist

## Comando único

`npm run verify` ejecuta, en orden, los typechecks de frontend y Worker, ESLint, build de Vite, smoke de SheetJS, Playwright E2E y `npm audit --audit-level=high`. El script usa únicamente comandos locales del repositorio, detecta Windows/Linux y no conoce credenciales ni endpoints de producción.

## Pipeline

`.github/workflows/ci.yml` corre el mismo gate en `ubuntu-latest` para cada push a `main` y cada pull request. Usa `npm ci`, instala Chromium, Firefox y WebKit, ejecuta el gate funcional completo en Chromium y después la auditoría crítica de legibilidad en los tres motores. Conserva permisos `contents: read`, timeout de 15 minutos y cancelación de ejecuciones obsoletas. El workflow no despliega, migra ni crea datos remotos; el repositorio sí tiene una integración Vercel separada que publica automáticamente los pushes a `main`.

## Browserslist

`caniuse-lite` está fijado en `1.0.30001810` dentro de `devDependencies` y `package-lock.json`. Para actualizarlo, abrir un cambio controlado con `npm install --save-dev caniuse-lite@latest`, ejecutar `npm run verify`, revisar el diff del lockfile y fusionar solo con el workflow en verde. El helper `update-browserslist-db` puede detectar `bun.lockb`; en este repositorio se usa npm explícitamente para mantener el proceso reproducible.

## Estado

Validado localmente el 28 de agosto de 2026: `npm run verify` completó typechecks, lint sin advertencias, build, SheetJS, Worker 6/6 y Playwright 16/16 en Chromium; la consulta de `npm audit --audit-level=high` se repitió fuera del sandbox y devolvió 0 vulnerabilidades. `npm run test:e2e:cross-browser -- --retries=0` aprobó 15/15 escenarios críticos: cinco en Chromium, cinco en Firefox y cinco en WebKit. La confirmación del workflow remoto queda pendiente del próximo push autorizado a `main`.

La política de scripts de npm también está fijada en `package.json`: solo `@swc/core@1.16.1` y `esbuild@0.25.0` están permitidos, porque sus binarios son necesarios para compilar; cualquier script nuevo queda pendiente de revisión explícita.

## Higiene del paquete Vercel

`.vercelignore` mantiene fuera del upload los artefactos de desarrollo, backend, documentación,
QA, `dist` y archivos de entorno. Medición seca del 25 de agosto de 2026:
`npx vercel deploy --dry --json` → 129 archivos y 1.249.592 bytes (frente a 199 archivos y
3.504.017 bytes antes del filtro). `npm ci` limpio resolvió `sucrase@3.35.1` sin la advertencia
deprecatoria de `glob@10.5.0`; el build y `npm run verify` posterior pasaron.
