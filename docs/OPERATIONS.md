# Monitoreo y recuperación operativa

## Monitor de producción

`.github/workflows/production-health.yml` se ejecuta después de cada `Verify` exitoso en `main`, a los minutos 17 y 47 de cada hora y mediante ejecución manual. No usa una sesión ni ejecuta escrituras autenticadas; valida:

- frontend Vercel HTTP 200 con CSP, HSTS y `nosniff`;
- manifiesto, service worker e iconos Android de la PWA;
- `/api/health` por Vercel y directamente en el Worker, con el contrato JSON esperado;
- ruta de trabajador directa y `POST /api/admin/salary-advice` por proxy sin sesión, ambas HTTP 401;
- la ruta retirada `/api/admin/payroll-runs` por proxy, que debe permanecer en HTTP 404.

Cada comprobación reintenta hasta tres veces. Si alguna falla, el workflow queda rojo y crea una sola incidencia abierta con la etiqueta `production-alert`; fallos posteriores actualizan esa misma incidencia. Cuando todos los contratos se recuperan, el workflow cierra la incidencia. La asignación al propietario del repositorio es de mejor esfuerzo y el log de Actions conserva la evidencia detallada.

Ejecución local de solo lectura:

```bash
node scripts/production-health.mjs
```

Los workflows programados pueden retrasarse cuando GitHub Actions tiene alta carga y pueden deshabilitarse tras periodos prolongados sin actividad del repositorio. Por eso este monitor es una alerta operativa básica, no un SLA externo. Referencia: [eventos programados de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Ensayo seguro de recuperación D1

`npm run test:ops` prueba el monitor con un servidor HTTP local y ejecuta `scripts/rehearse-d1-recovery.mjs`. El ensayo:

1. crea dos directorios temporales aislados;
2. aplica las migraciones `0001` a `0010` a una D1 local con identificador ficticio;
3. carga exclusivamente `cloudflare/test/fixtures/recovery-seed.sql`, cuyos dominios `.invalid` y valores son sintéticos;
4. exporta la primera D1 a SQL e importa el archivo en la segunda;
5. compara objetos de esquema y conteos de tablas, y exige cero violaciones de claves foráneas;
6. elimina el export y los estados locales al terminar, incluso si la prueba falla.

El script rechaza cualquier invocación que no contenga `--local` o que contenga `--remote`. No consulta, exporta ni modifica producción.

Ejecución:

```bash
npm run test:ops
```

## Time Travel productivo

Time Travel está siempre activo en D1 y permite obtener un bookmark actual sin escribir datos:

```bash
npx wrangler d1 time-travel info field-hours-prod --config cloudflare/wrangler.jsonc --json
```

Una restauración de Time Travel sobrescribe la base en el mismo lugar, cancela consultas en curso y es destructiva. Solo ante un incidente real:

1. detener o limitar las escrituras de la aplicación;
2. registrar el bookmark actual y obtener el bookmark o timestamp anterior al incidente;
3. confirmar que el punto elegido corresponde al incidente y documentar el impacto esperado;
4. obtener autorización explícita del operador;
5. ejecutar `d1 time-travel restore` con el bookmark confirmado;
6. conservar el `previous_bookmark` que devuelve Cloudflare como reversión de la restauración;
7. validar claves foráneas, migraciones, health directo/proxy y rutas protegidas antes de reabrir escrituras.

Nunca se ejecuta `time-travel restore` como prueba. Cloudflare documenta el comportamiento y la reversión en [Time Travel y backups de D1](https://developers.cloudflare.com/d1/reference/time-travel/).

## Estado verificado

El 30 de agosto de 2026 el ensayo sintético restauró 54 objetos y comparó 15 contadores. Para el
corte Salary Advice, D1 aprobó `quick_check`, cero FK rotas y ambos preflight en cero; `0010` copió
1 perfil y 1 configuración sin alterar conteos históricos. El bookmark previo fue
`000000a4-00000000-000050d8-13e624b6916c0d631bcf5975797edda2`; el posterior fue
`000000a8-00000000-000050d8-11ce9361a6afc61a299021333ff1cbe7`. No se exportó la base sensible a
un archivo local sin cifrar; la recuperación quedó en Time Travel y el backup automático de D1.

El Worker `6c551bca-3a7c-4a98-a019-23538c9e379f` y Vercel
`dpl_CfgtC97pgeFRD2EkJtVuk46F1FDf` están activos. El monitor público aprobó 10/10: frontend,
PWA, health directo/proxy, límites de autenticación y 404 de la ruta de review retirada. Rollback
conocido-bueno: Worker `900f64d6-9c0b-4814-be29-03661fe94ad9` y Vercel
`dpl_9w53QSuwsVAiTm5mzgw9UBFfzhcp`. No se ejecutaron cálculos autenticados con datos reales.

El 28 de agosto de 2026 el ensayo sintético restauró 50 objetos de esquema y comparó 13 contadores sin diferencias ni violaciones de claves foráneas. El monitor de solo lectura pasó los cinco contratos productivos y D1 devolvió un bookmark Time Travel vigente. No se ejecutaron escrituras, exportaciones ni restauraciones sobre producción.

La primera ejecución remota comprobada fue `Production health` run `33229189380` (job `99038776374`), disparada por `workflow_run` después de `Verify` exitoso. Terminó en `success` y no dejó incidencias `production-alert` abiertas.

## Rotación del pepper de contraseñas

Los hashes actuales usan el prefijo `v2$` y el secreto `PASSWORD_PEPPER_CURRENT`. Durante una transición desde hashes históricos sin prefijo, el Worker puede usar `PASSWORD_PEPPER_LEGACY` únicamente para verificar un login válido y rehashearlo inmediatamente. No existe fallback en código.

Controles operativos:

1. provisionar ambos secretos antes de desplegar el Worker compatible;
2. no imprimir, consultar ni guardar peppers en el repositorio o logs;
3. comprobar por conteos agregados que el administrador local pasó a `v2$`;
4. mantener el secreto legado mientras exista alguna cuenta local activa con hash sin prefijo;
5. retirar el legado solo con `legacy_admins = 0` y `legacy_without_google = 0`;
6. después del primer rehash, no volver a una versión del Worker que desconozca `v2$`.

El procedimiento completo, evidencia y rollback están en `docs/RELEASE-2026-08-28-password-pepper.md` y la decisión en `docs/adr/ADR-001-password-pepper-versioning.md`.

Estado productivo del 28 de agosto de 2026: Worker `14f4748b-88a4-48db-aefe-174d6fe77dca` desplegado y monitor 5/5. El administrador local migró a `v2$` y dejó un evento de auditoría; los conteos agregados quedaron en 0 administradores legados y 1 cuenta local sin Google todavía en legado. Se mantiene `PASSWORD_PEPPER_LEGACY` hasta que esa última cuenta inicie sesión o restablezca su contraseña.
