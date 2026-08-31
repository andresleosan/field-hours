# Gate CI y actualización de Browserslist

## Comando único

`npm run verify` ejecuta, en orden, los typechecks de frontend y Worker, ESLint, build de Vite, smoke de SheetJS, pruebas del Worker, `test:ops`, Playwright E2E y `npm audit --audit-level=high`. `test:ops` usa un servidor HTTP simulado y dos D1 locales con datos sintéticos; el gate no conoce credenciales ni consulta endpoints de producción.

## Pipeline

`.github/workflows/ci.yml` corre el mismo gate en `ubuntu-latest` para cada push a `main` y cada pull request. Usa `npm ci`, instala Chromium, Firefox y WebKit, ejecuta el gate funcional completo en Chromium y después la auditoría crítica de legibilidad en los tres motores. Conserva permisos `contents: read`, timeout de 15 minutos y cancelación de ejecuciones obsoletas. El workflow no despliega, migra ni crea datos remotos; el repositorio tiene una integración Vercel separada para los pushes a `main` y el runbook manual controlado de abajo.

## Browserslist

`caniuse-lite` está fijado en `1.0.30001810` dentro de `devDependencies` y `package-lock.json`. Para actualizarlo, abrir un cambio controlado con `npm install --save-dev caniuse-lite@latest`, ejecutar `npm run verify`, revisar el diff del lockfile y fusionar solo con el workflow en verde. El helper `update-browserslist-db` puede detectar `bun.lockb`; en este repositorio se usa npm explícitamente para mantener el proceso reproducible.

## Estado

Validado el 28 de agosto de 2026: `npm run verify` completó typechecks, lint sin advertencias, build, SheetJS, Worker 6/6 y Playwright 16/16 en Chromium; la consulta local de `npm audit --audit-level=high` se repitió fuera del sandbox y devolvió 0 vulnerabilidades. `npm run test:e2e:cross-browser -- --retries=0` aprobó 15/15 escenarios críticos: cinco en Chromium, cinco en Firefox y cinco en WebKit. GitHub Actions `Verify #18`, run `33222205776`, confirmó en Ubuntu que tanto el gate funcional como el paso independiente `Run critical cross-browser matrix` finalizaron en `success`.

La política de scripts de npm también está fijada en `package.json`: `@swc/core@1.16.1`, `esbuild@0.25.0`, `esbuild@0.28.1` y `workerd@1.20260828.1` están permitidos porque sus binarios son necesarios para compilar o ejecutar Wrangler/D1 local; cualquier script nuevo queda pendiente de revisión explícita. Wrangler queda fijado exactamente en `4.127.1`.

## Monitor operativo

`.github/workflows/production-health.yml` es independiente del gate de código: corre después de cada `Verify` exitoso en `main`, cada 30 minutos y manualmente. Usa permisos `contents: read` e `issues: write` y solo hace comprobaciones HTTP de lectura. Deduplica una incidencia `production-alert` y la cierra al recuperarse. El runbook completo está en `docs/OPERATIONS.md`.

## Publicación manual controlada en Vercel

Cuando el operador autoriza un corte sin `git push`, usar una versión exacta del CLI y el proyecto
local enlazado `fieldhours`:

```powershell
npx.cmd --yes vercel@59.10.0 inspect https://field-hours.vercel.app
npx.cmd --yes vercel@59.10.0 deploy --prod --skip-domain --yes
npx.cmd --yes vercel@59.10.0 inspect https://<deployment-inmutable> --logs
npx.cmd --yes vercel@59.10.0 promote https://<deployment-inmutable> --yes
node scripts/production-health.mjs
```

La URL inmutable puede estar protegida. En ese caso `vercel curl <ruta> --deployment
https://<deployment-inmutable>` genera y usa el bypass sin imprimirlo. Validar allí API, PWA y assets
antes de promover. No desplegar `.vercel/output` creado localmente cuando `vercel build` haya sustituido
secretos no descargables por `[SENSITIVE]`; el deploy de fuente deja que el build remoto use las
variables reales. Registrar siempre el deployment anterior y la URL inmutable para rollback. La
evidencia e IDs del corte Salary Advice están en `docs/RELEASE-2026-08-30-salary-advice-correction.md`.

## Higiene del paquete Vercel

`.vercelignore` mantiene fuera del upload los artefactos de desarrollo, backend, documentación,
QA, `dist` y archivos de entorno. Medición seca del 25 de agosto de 2026:
`npx vercel deploy --dry --json` → 129 archivos y 1.249.592 bytes (frente a 199 archivos y
3.504.017 bytes antes del filtro). `npm ci` limpio resolvió `sucrase@3.35.1` sin la advertencia
deprecatoria de `glob@10.5.0`; el build y `npm run verify` posterior pasaron.
