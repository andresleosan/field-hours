# Monitoreo y recuperación operativa

## Monitor de producción

`.github/workflows/production-health.yml` se ejecuta después de cada `Verify` exitoso en `main`, a los minutos 17 y 47 de cada hora y mediante ejecución manual. Solo hace solicitudes `GET` y valida:

- frontend Vercel HTTP 200 con CSP, HSTS y `nosniff`;
- `/api/health` por Vercel y directamente en el Worker, con el contrato JSON esperado;
- ruta de trabajador directa y ruta administrativa por proxy sin sesión, ambas HTTP 401.

Cada comprobación reintenta hasta tres veces. Si alguna falla, el workflow queda rojo y crea una sola incidencia abierta con la etiqueta `production-alert`; fallos posteriores actualizan esa misma incidencia. Cuando todos los contratos se recuperan, el workflow cierra la incidencia. La asignación al propietario del repositorio es de mejor esfuerzo y el log de Actions conserva la evidencia detallada.

Ejecución local de solo lectura:

```bash
node scripts/production-health.mjs
```

Los workflows programados pueden retrasarse cuando GitHub Actions tiene alta carga y pueden deshabilitarse tras periodos prolongados sin actividad del repositorio. Por eso este monitor es una alerta operativa básica, no un SLA externo. Referencia: [eventos programados de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Ensayo seguro de recuperación D1

`npm run test:ops` prueba el monitor con un servidor HTTP local y ejecuta `scripts/rehearse-d1-recovery.mjs`. El ensayo:

1. crea dos directorios temporales aislados;
2. aplica las migraciones `0001` a `0009` a una D1 local con identificador ficticio;
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

El 28 de agosto de 2026 el ensayo sintético restauró 50 objetos de esquema y comparó 13 contadores sin diferencias ni violaciones de claves foráneas. El monitor de solo lectura pasó los cinco contratos productivos y D1 devolvió un bookmark Time Travel vigente. No se ejecutaron escrituras, exportaciones ni restauraciones sobre producción.
