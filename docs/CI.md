# Gate CI y actualización de Browserslist

## Comando único

`npm run verify` ejecuta, en orden, los typechecks de frontend y Worker, ESLint, build de Vite, smoke de SheetJS, Playwright E2E y `npm audit --audit-level=high`. El script usa únicamente comandos locales del repositorio, detecta Windows/Linux y no conoce credenciales ni endpoints de producción.

## Pipeline

`.github/workflows/ci.yml` corre el mismo gate en `ubuntu-latest` para cada push a `main` y cada pull request. Usa `npm ci`, instala solo Chromium para Playwright y tiene permisos `contents: read`, timeout de 15 minutos y cancelación de ejecuciones obsoletas. No despliega, migra ni crea datos remotos.

## Browserslist

`caniuse-lite` está fijado en `1.0.30001810` dentro de `devDependencies` y `package-lock.json`. Para actualizarlo, abrir un cambio controlado con `npm install --save-dev caniuse-lite@latest`, ejecutar `npm run verify`, revisar el diff del lockfile y fusionar solo con el workflow en verde. El helper `update-browserslist-db` puede detectar `bun.lockb`; en este repositorio se usa npm explícitamente para mantener el proceso reproducible.

## Estado

Validado el 25 de agosto de 2026: `npm run verify` completó todos los gates, Playwright 6/6 y audit 0. ESLint conserva únicamente dos advertencias preexistentes de Fast Refresh en `src/lib/i18n.tsx`.
