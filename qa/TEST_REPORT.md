# Reporte de QA — Field Hours

## Fase 9 — experiencia móvil workforce (31 de agosto de 2026; local, no desplegada)

Resultado: **gate funcional y matriz móvil aprobados sin reintentos**.

- Chromium: 43/43 E2E. Incluye CTA de fichaje completo en los cuatro viewports y sin solapamiento a 320×568, métricas y primer trabajador visibles a 390×844, secciones enlazables que vuelven arriba al cambiar o usar atrás/adelante y conservan `?section` al recargar, rutas clave ES/EN/PT a 360×800, targets de 44 px en los escenarios declarados, Salary Advice directo sin aprobación, PWA Android, CSRF, diálogos, listas densas de revelado progresivo, paneles de acceso compactos y ausencia de tablas/overflow horizontal en móvil.
- Matriz crítica de legibilidad: WebKit 10/10 y Firefox 10/10 sobre 320×568, 360×800, 390×844 y 430×932; cubre reflow, contraste WCAG AA, nombres accesibles, foco visible y errores, sin sustituir la cobertura funcional/idiomática de Chromium.
- Firefox: el sandbox de procesos de Windows falló antes de renderizar con `SpawnTarget/_page`, consistente con [Playwright #36594](https://github.com/microsoft/playwright/issues/36594). La suite ejecutó 10/10 con `MOZ_DISABLE_CONTENT_SANDBOX`, `MOZ_DISABLE_RDD_SANDBOX` y `MOZ_DISABLE_GMP_SANDBOX` solo en el proceso local; no se persistieron en configuración, CI o producto.
- Gate no visual: frontend/Worker typecheck, lint, build, SheetJS, Worker 34/34, PDF 6/6, operaciones 4/4 y recuperación D1 sintética aprobados. `npm audit --audit-level=high`, repetido fuera del sandbox porque este bloqueó el registro, devolvió 0 vulnerabilidades.
- Seguridad/contratos: no cambiaron endpoints, autorización, D1, cálculo ni PDF. Los mocks validan rutas/métodos/cuerpos y bloquean tráfico externo. No se usaron secretos, cuentas, producción, migraciones ni APIs de pago.
- Capacidad: no corresponde carga de backend a este cambio visual; se ejercitaron 14 trabajadores, 18 jornadas, 12 proyectos, solicitudes pendientes y 12 eventos de auditoría para detectar reflow, crecimiento y overflow.
- Inspección humana: capturas completas de trabajador, `En vivo`, historial, Salary Advice, proyectos y accesos. El CTA de fichaje queda íntegro sobre la navegación inferior a 320×568; el menú administrativo ya no trunca etiquetas; las solicitudes accionables permanecen abiertas y la invitación/auditoría secundaria se pliega en móvil.

El reporte HTML local más reciente queda en `qa/reports/playwright/index.html`. Cada ejecución reemplaza el reporte anterior; las cifras canónicas están en este documento y en `tasks.md`.

---

## Archivo histórico — Fase 7

> **Documento histórico, sustituido por las Fases 8 y 9.** Las menciones de revisión, aprobación, estados “listo para pago”, payroll runs o Salary Advice condicionado a aprobación describen una implementación retirada y no el producto vigente. El contrato actual selecciona un empleado y un periodo y descarga directamente el Salary Advice; no revisa, aprueba ni inicia pagos.

Fecha: 28 de agosto de 2026
Entorno: local, Chromium/Firefox/WebKit con Playwright 1.57, API completamente simulada
Resultado histórico: **16/16 pruebas E2E funcionales, 15/15 escenarios críticos multinavegador y 6/6 regresiones del Worker aprobadas**

### Alcance histórico validado en la Fase 7

- Nómina: enviar snapshot, dejarlo pendiente, aprobarlo, bloquearlo como listo para pago sin iniciar transferencias y solicitar cambios con nota obligatoria.
- Salary Advice final: la acción solo aparece para runs aprobados; prepara un trabajador desde el snapshot bloqueado, abre el documento imprimible con cifras exactas, todos los campos requeridos y contenido HTML escapado, sin rutas de pago.
- Autorización: un trabajador no puede ver controles administrativos de aprobación.
- Jornada flexible: crear proyecto, registrar GPS sin foto, dos breaks de 10 y 25 minutos y dos shifts completos el mismo día.
- Cálculos/UI: historial con 35 minutos de break, acumulado de 1h 25m y roster de Salary Advice en viewport móvil 390x844 sin overflow de página.
- Seguridad de sesión: todos los POST incluyen CSRF y, sin cookie CSRF, el cliente falla cerrado antes de enviar la solicitud.

## Evidencia ejecutada

```text
npm.cmd run test:e2e:list    -> 16 pruebas detectadas en 4 archivos
npm.cmd run test:e2e         -> 16 passed (19.6s), sin reintentos
npm.cmd run test:worker      -> 2 passed (turno abierto sin filtro de fecha)
npm.cmd run test:xlsx        -> SheetJS 0.20.3 write/read/JSON/CSV correcto
npm.cmd run verify           -> typechecks, lint, build, SheetJS, Worker 6/6 y E2E 16/16 en verde; `audit` se repitió por separado porque el sandbox bloqueó el registro
npm.cmd ls caniuse-lite      -> caniuse-lite@1.0.30001810 deduplicado
npm.cmd run lint             -> 0 errores, 2 advertencias preexistentes
npm.cmd run typecheck        -> correcto
npm.cmd run typecheck:worker -> correcto
npm.cmd run build            -> correcto
npx.cmd wrangler deploy --dry-run -> correcto, sin despliegue
git diff --check             -> correcto
npm.cmd audit                -> 0 vulnerabilidades
```

El reporte HTML reproducible queda en `qa/reports/playwright/index.html`; sus trazas, videos y capturas de fallos se conservan localmente bajo `qa/reports/` y no se versionan.

## Pruebas avanzadas

- **Contrato UI/API:** el mock valida método y ruta, cuerpos exactos de proyecto, decisiones de nómina y preparación de Salary Advice, idempotency key, GPS, CSRF, ausencia de `photo` y ausencia de rutas de pago/transferencia.
- **Casos límite de seguridad:** separación de rol worker/admin, run pendiente sin controles de documento, escape de contenido malicioso en el HTML imprimible, fallo cerrado sin CSRF y bloqueo de toda solicitud hacia hosts externos durante la suite.

## Verificación adicional — O.6 (26 de agosto de 2026)

- Worker local con D1 aislada: 10 solicitudes de revelado sintético devolvieron `404`; la número 11
  devolvió `429 PAYROLL_RATE_LIMITED` con `Retry-After: 900`.
- Tras mover el contador sintético fuera de la ventana, la siguiente solicitud volvió a `404`, lo
  que confirma la recuperación sin exponer referencias, importes ni datos de perfil.
- **Carga:** no aplica a esta tarea de infraestructura E2E local. No se ejecutará carga contra producción; se difiere hasta disponer de staging aislado y datos sintéticos.

## Verificación adicional — O.8 (28 de agosto de 2026)

- **Evidencia productiva de solo lectura:** el turno investigado no contenía un evento `clock_out`; la auditoría conservaba `old_clock_out = null` hasta dos ajustes administrativos del 28 de agosto. Esto descarta una reactivación del backend y confirma una salida nunca persistida.
- **Regresión Worker:** 2/2 pruebas validan que el turno abierto se busca por organización/usuario sin limitarlo a `work_date`, y que la ausencia de turno devuelve `null`.
- **Contrato UI/API:** Playwright corta la primera respuesta de `clock_out`; la app conserva la acción, la reintenta con la misma `idempotencyKey`, completa un solo turno y vacía la cola. Otra prueba recupera y cierra un turno abierto de la fecha anterior.
- **Seguridad:** los errores HTTP/CSRF no se encolan como fallos de red, el GPS pendiente ya no se escribe en consola y la consulta de turno continúa aislada por organización/usuario. `npm audit` devolvió 0 vulnerabilidades.
- **Carga:** no aplica; el cambio añade como máximo un reintento inmediato y uno cada 15 segundos únicamente mientras exista una cola pendiente. No se ejecutó carga contra producción.
- **Bundle Worker:** `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc` correcto (151,22 KiB / 29,33 KiB gzip); desplegado como `a65b0a37-6f03-4658-9b89-7f83ea769861`.
- **Producción:** frontend y asset HTTP 200; health directo/proxy HTTP 200; `/api/worker/today` sin sesión HTTP 401 y mutación directa sin CSRF HTTP 403. CSP, HSTS y `nosniff` presentes. GitHub Actions `Verify #15` (`33150543683`) aprobado tras alinear la ruta de cache de Chromium entre instalación y ejecución.

## Verificación adicional — O.9 (28 de agosto de 2026, desplegada)

- **Perfil de nómina:** la interfaz solicita una sola vez `Social Security Number`; se retiró el campo social heredado duplicado sin borrar su ciphertext existente. El endpoint ya no lo exige ni lo descifra al revelar el perfil administrativo.
- **Contrato UI/API:** el administrador crea una jornada completa mediante `POST /api/admin/shifts/create` con trabajador, proyecto opcional, entrada, salida y descripción obligatoria. La mutación usa CSRF y el historial devuelve la descripción para la interfaz del empleado.
- **Regresiones Worker:** 6/6 pruebas: creación auditada, descripción obligatoria, rol trabajador rechazado con `403`, solapamiento rechazado al crear y ajustar, y recuperación del turno abierto.
- **E2E móvil:** 11/11 en Chromium a 390x844. La prueba administrativa comprueba el cuerpo del contrato, CSRF y ausencia de overflow; la prueba del trabajador comprueba la descripción y una relación de contraste medida `>= 4.5:1`.
- **Seguridad:** trabajador y proyecto se validan dentro de la organización, la descripción se limita a 300 caracteres y React la escapa, no se fabrican eventos GPS para una jornada manual y `npm.cmd audit --audit-level=high` reportó `found 0 vulnerabilities`.
- **Pruebas avanzadas:** aplicaron pruebas de contrato y casos límite de autorización/cronología/solapamiento. No se ejecutó carga: es una mutación administrativa puntual y no una release de capacidad; tampoco se hicieron escrituras en staging o producción.
- **Gate:** `npm.cmd run verify` aprobó typechecks, lint, build, SheetJS, Worker 6/6 y E2E 11/11; el subcomando final de audit no pudo consultar el registro dentro del sandbox, por lo que se repitió de forma aislada con acceso de red y quedó en 0 vulnerabilidades. `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc` empaquetó 155.53 KiB / 29.94 KiB gzip y salió sin desplegar.
- **Estabilidad del gate:** una primera corrida detectó que `refreshToday()` borraba el aviso de éxito después de crear la jornada. Se corrigió la carrera de estado y la prueba administrativa pasó 5/5 veces consecutivas con `--retries=0`; después, el gate completo volvió a pasar 11/11 sin reintentos.
- **Producción:** commit `ade5a6d`, GitHub Actions `Verify` run `33218897389` aprobado, Worker `4b8794db-af54-42a4-b22c-8b084abd0725` y Vercel `dpl_8bpJsaJuwQYupSdKxijg1PqRutZW`. Health directo/proxy HTTP 200 con `ok=true`; historial admin sin sesión 401 directo/proxy y creación admin sin sesión 401. El bundle `index-D8UnqKpE.js` responde 200 y contiene la ruta/interfaz nueva; CSP, HSTS, `nosniff` y `frame-ancestors` están presentes. No se insertaron jornadas sintéticas ni se aplicaron migraciones.

## Verificación adicional — O.10 (28 de agosto de 2026, desplegada)

- **Baseline reproducible:** la primera corrida falló 5/5 y midió avisos de nómina en `1.07:1`, el distintivo de estimación en `1.14:1`, placeholders administrativos en `2.33:1` y la acción `Add Project` del trabajador en `2.10:1`.
- **Cobertura visual:** Playwright recorre administrador y trabajador en 1440x900 y 390x844. Incluye Live Today, historial/nómina, proyectos, perfil salarial e historial del trabajador, creación/ajuste de jornada, creación de proyecto y error de configuración de nómina.
- **Criterios automáticos:** todo texto y placeholder visible debe alcanzar WCAG AA (`4.5:1`, o `3:1` para texto grande); no puede existir overflow horizontal de página, controles o diálogos visibles sin nombre accesible, ni ausencia de indicador al navegar por teclado.
- **Correcciones:** placeholders globales opacos con `muted-foreground`; contenido textual oscuro sobre fondos semánticos translúcidos; enlaces informativos con `text-info`; selectores y menú móvil etiquetados; títulos y cierres accesibles en los diálogos de evidencia, proyectos y ajustes.
- **Inspección humana:** se revisaron capturas completas de escritorio y móvil para ambos perfiles. Los avisos de nómina, la descripción administrativa, el formulario salarial con un único Social Security Number y los modales conservan jerarquía y lectura clara.
- **Estabilidad:** la especificación crítica pasó 15/15 (`--repeat-each=3 --retries=0`) y luego el gate completo pasó Worker 6/6 y E2E 16/16 sin reintentos.
- **Seguridad y pruebas avanzadas:** no cambian endpoints, autorización, persistencia ni tratamiento de datos; el mock sigue bloqueando tráfico externo. Contratos y roles permanecen cubiertos por la suite existente. Carga no aplica a este cambio puramente visual. `npm.cmd audit --audit-level=high` reportó 0 vulnerabilidades.
- **Despliegue observado:** commit `7334a64`, GitHub Actions `Verify #17` (`33220506253`) y checks Vercel aprobados. El alias productivo sirve `index-By-75Z5C.js`; frontend y health directo/proxy responden 200, las rutas protegidas 401 sin sesión y CSP/HSTS/`nosniff` están presentes. No hubo cambios de Worker, migraciones ni escrituras productivas.

## Verificación adicional — O.11 (28 de agosto de 2026, activa en CI)

- **Matriz crítica:** `npm.cmd run test:e2e:cross-browser -- --retries=0` ejecutó únicamente `legibility-audit.spec.ts` y aprobó 15/15 casos: 5 Chromium, 5 Firefox y 5 WebKit.
- **Cobertura:** administrador y trabajador en 1440x900 y 390x844, más el estado de error de configuración de nómina; se validan contraste WCAG AA, placeholders, foco visible, nombres accesibles y ausencia de overflow horizontal.
- **Gate funcional:** `npm.cmd run verify` aprobó typechecks, lint sin advertencias, build, SheetJS, Worker 6/6 y Playwright 16/16 en Chromium. La consulta final al registro quedó bloqueada por el sandbox y `npm.cmd audit --audit-level=high`, repetido con acceso de red, devolvió 0 vulnerabilidades.
- **Incidente de entorno:** Firefox quedó bloqueado al inicializar su compositor SWGL dentro del sandbox de Windows, antes de iniciar una prueba. El caso aislado y la matriz completa pasaron fuera de ese sandbox, siempre en headless, con Vite local, datos simulados y tráfico externo bloqueado. El workflow remoto usará Ubuntu y será la evidencia independiente del entorno Windows.
- **Pruebas avanzadas:** no cambian contratos entre UI y API, endpoints, autenticación, autorización ni persistencia. La suite funcional existente mantiene las pruebas de contrato y seguridad; carga no aplica a un cambio exclusivo del gate de QA.
- **Seguridad:** el workflow mantiene permisos mínimos `contents: read`; los scripts no conocen credenciales ni endpoints productivos y no hacen despliegues, migraciones ni escrituras remotas.
- **CI remoto:** commit `dc7575a`, GitHub Actions `Verify #18` (run `33222205776`, job `99018444851`) aprobado en Ubuntu. La instalación de Chromium/Firefox/WebKit, el gate funcional y `Run critical cross-browser matrix` terminaron en `success`.
- **Producción revalidada:** checks `Vercel – fieldhours` y `Vercel – field-hours` exitosos. Frontend y `index-By-75Z5C.js` HTTP 200; health directo/proxy HTTP 200 con `ok=true`; rutas worker/admin sin sesión HTTP 401; CSP, HSTS y `nosniff` presentes. El bundle conserva `account menu` y `admin-project-title`. No hubo cambios de aplicación, Worker, D1 ni escrituras productivas.

## Verificación adicional — O.12 (28 de agosto de 2026, Google OAuth productivo)

- **Configuración sin secretos:** `wrangler secret list` confirmó los nombres `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` sin devolver valores. Una consulta D1 de metadatos confirmó las tres tablas de OAuth con `rows_written: 0`.
- **Contrato no mutante:** `GET /api/auth/google/start?mode=invalid` devolvió `400 INVALID_INPUT` directo y por Vercel; por implementación, esta validación ocurre después de cargar configuración y antes de limpiar o insertar estados.
- **Camino no vinculado:** Google redirigió al callback productivo y la UI mostró solicitud pendiente. D1 la clasificó como `access` que habría creado un trabajador; se rechazó con autorización explícita desde el panel administrativo local. La UI confirmó el rechazo y D1 registró pendientes 0 y un evento `account.google_request.rejected` con la misma marca temporal.
- **Camino vinculado:** una identidad existente volvió del callback con `Google sign-in is ready for this account.`, interfaz de trabajador, un encabezado de trabajador, cero regiones de solicitudes Google y cero botones `Approve`. La sesión se cerró al terminar.
- **Estado final:** identidades Google = 2, solicitudes pendientes = 0, estados activos = 0 y último estado consumido registrado; no se creó ningún usuario ni se modificó una identidad.
- **Pruebas avanzadas:** quedó validado el contrato Google → Worker → D1 → UI y los límites de seguridad de cuenta no vinculada, aprobación administrativa, auditoría y separación worker/admin. Carga no aplica y no debe ejecutarse contra OAuth productivo.
- **Gate de código:** no hubo cambios de aplicación. El mismo código estaba aprobado por GitHub Actions `Verify #19` (`33222532358`), incluido el gate funcional y la matriz Chromium/Firefox/WebKit.

## Verificación adicional — O.13 (28 de agosto de 2026, aprobada localmente)

- **Monitor unitario:** 2/2 pruebas con servidor HTTP local validan el camino saludable y un contrato roto sin lanzar excepciones ni hacer tráfico externo.
- **Recuperación D1:** las migraciones `0001` a `0009` y un fixture exclusivamente sintético se cargaron en una D1 local, se exportaron y restauraron en una segunda D1 local aislada. Coincidieron 50 objetos de esquema y 13 contadores; `PRAGMA foreign_key_check` devolvió cero filas en origen y destino.
- **Defensa contra error operativo:** el script exige `--local`, rechaza `--remote`, usa nombre/UUID ficticios y elimina estados, dump y log temporales en `finally`. No conoce credenciales ni exporta datos reales.
- **Contrato productivo no mutante:** frontend, health proxy, health Worker y dos límites sin sesión pasaron 5/5; respuestas HTTP 200/401, payload `field-hours-api`, CSP, HSTS y `nosniff` fueron correctos.
- **Time Travel:** `d1 info` confirmó la D1 productiva y `d1 time-travel info --json` devolvió un bookmark vigente. No se llamó `restore`, no se exportó producción y no hubo escrituras.
- **Workflow:** YAML parseado correctamente; permisos limitados a `contents: read` e `issues: write`, reintentos, incidencia deduplicada y autocierre. Se dispara después de `Verify` exitoso en `main`, cada 30 minutos y manualmente.
- **Seguridad:** los logs y la incidencia no contienen cuerpos, cookies, identidad ni datos financieros; `npm audit --audit-level=high` devolvió 0 vulnerabilidades. Se registró aparte O.14, hallazgo alto preexistente: `PASSWORD_PEPPER` ausente en secretos y fallback fijo en autenticación.
- **Pruebas avanzadas:** se probaron contratos Vercel→Worker, frontend/cabeceras y export→import D1, además de los casos límite unhealthy, ausencia de sesión y prohibición remota. Carga no aplica: el monitor hace cinco GET cada 30 minutos y no se ejecutará carga contra producción.
- **Gate limpio:** después de `npm ci`, `npm run verify` aprobó dentro del mismo comando typechecks, lint, build, SheetJS, Worker 6/6, operaciones 2/2 + ensayo D1, Playwright 16/16 y `npm audit` con 0 vulnerabilidades. Wrangler `4.127.1` empaquetó 155.53 KiB / 29.94 KiB gzip en dry-run sin desplegar.
- **CI y despliegue:** `83177aa` publicó O.13 y `5a469b3` añadió el disparo posterior a `Verify`. Runs `33228132974` y `33229050228` aprobaron el gate funcional y la matriz multinavegador; ambos contextos Vercel terminaron en `success`.
- **Monitor remoto:** `Production health` run `33229189380`, job `99038776374`, terminó en `success`. El probe, la creación de etiqueta y el camino de recuperación pasaron; apertura de incidencia y fallo final quedaron omitidos. Incidencias `production-alert` abiertas = 0.
- **Smoke posterior:** frontend, health proxy, health Worker y límites worker/admin aprobaron 5/5 con HTTP 200/401 y cabeceras CSP/HSTS/`nosniff`. No hubo escrituras, exportaciones o restauraciones productivas.

## 2026-08-28 — O.14 Pepper de contraseñas (aprobada localmente)

- **Contrato de migración:** los hashes nuevos llevan `v2$` y usan `PASSWORD_PEPPER_CURRENT`; un hash sin prefijo solo se acepta con el secreto temporal `PASSWORD_PEPPER_LEGACY` y se actualiza antes de crear la sesión.
- **Casos límite de seguridad:** falta o longitud inválida del secreto actual → `503 AUTH_NOT_CONFIGURED`; peppers iguales → `503`; versión desconocida o legado sin secreto → credenciales inválidas mediante derivación dummy; contraseña legado incorrecta no ejecuta rehash ni crea sesión.
- **Acceso administrativo:** la prueba de login legado conserva rol `admin`, escribe un hash `v2$`, registra `account.password.pepper_upgraded` y después crea la sesión. Un login ya actual no ejecuta el batch de transición.
- **Todos los escritores:** registro por invitación, cambio de contraseña, restablecimiento, creación mediante Google, bootstrap y seed escriben `v2$` con el pepper actual.
- **Higiene de secretos:** eliminado el fallback fijo del árbol de trabajo; `.dev.vars`/variantes quedaron ignorados y existe solo un ejemplo vacío. El pepper histórico permanece comprometido en el historial, por lo que solo se admite como puente temporal hasta conteo local pendiente cero.
- **Pruebas avanzadas:** Worker 13/13, contrato de rehash previo a sesión, no escritura ante contraseña inválida y compatibilidad después de retirar el legado. Prueba de carga no aplica: el doble PBKDF2 ocurre una sola vez por cuenta legado migrada y los intentos de login conservan el límite 5/15 min.
- **Gate:** typechecks, lint, build, SheetJS, operaciones/recuperación D1, Playwright 16/16 y dry-run Wrangler aprobados. `npm audit --audit-level=high` devolvió 0 vulnerabilidades al repetirse con red autorizada.
- **Producción de solo lectura:** 4 cuentas activas, 4 hashes legados, 1 administrador legado y 2 cuentas legadas sin Google; cero filas escritas. Producción no recibió secretos ni código.
- **Staging:** ambos peppers quedaron cargados por nombre y el Worker `1981cf0f-965a-4942-ab3d-fc1ec0c691ae` fue desplegado. Un primer binding actual vacío causado por incompatibilidad de PowerShell fue sobrescrito con 64 bytes aleatorios antes del deploy. Health directo/proxy 200, límites sin sesión 401 y login sintético inexistente `401 INVALID_CREDENTIALS` pasaron.
- **Datos staging:** 1 cuenta activa, 1 hash legado, 0 administradores legados y 0 cuentas legadas sin Google; consulta agregada con cero escrituras. No se creó una cuenta artificial solo para probar el rehash remoto; el contrato administrador legado → `v2$` permanece cubierto por la prueba integrada.
- **Hallazgo no bloqueante de staging:** el HTML de Pages no tiene la CSP productiva esperada; Worker/proxy 4/4 sí pasaron y producción se revalidó 5/5. O.14 no modifica el frontend.
- **Aislamiento productivo:** producción continúa sin los nombres de pepper, monitor 5/5, hashes sin cambios y cero escrituras.
- **CI remoto:** commit `f187344`; `Verify` run `33230532161` aprobó el gate y la matriz multinavegador, `Production health` run `33230686861` terminó en `success` y ambos checks Vercel quedaron verdes. El Worker productivo no fue desplegado.

## Gate y smoke de producción

La autorización explícita se recibió y el gate se completó el 25 de agosto de 2026:

- Rollback `0008/0009` probado en una D1 local aislada y recuperación previa registrada con un bookmark de Time Travel.
- Migraciones `0008_payroll_runs.sql` y `0009_worker_flexibility.sql` aplicadas sin pendientes; cero violaciones de claves foráneas.
- Worker `c910ed77-acde-4038-8544-721e2e229817` y Vercel `dpl_Bzr7miPjM5Aq9CUs8MqMeLYrDPbS` desplegados para el Salary Advice final; rollback a Worker `6a65af24-a8c2-4301-9276-9ac8aff12eba` y Vercel `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL`.
- Health directo y por proxy HTTP 200 con `ok=true`; rutas nuevas protegidas rechazan solicitudes sin sesión con HTTP 401.
- Frontend HTTP 200, cabeceras CSP/HSTS/`nosniff`/`frame-ancestors` presentes y contratos de nómina/proyectos/Salary Advice incluidos en el bundle.

No se crearon datos sintéticos ni se ejecutaron pagos en producción. Los recorridos autenticados y las mutaciones permanecen validados por la suite Playwright aislada 6/6; el detalle de esta publicación está en `docs/RELEASE-2026-08-25-final-salary-advice.md`.

## 2026-08-29 — O.15 Paridad de cabeceras Pages staging

- **Implementación:** Pages Advanced Mode aplica CSP, HSTS y las demás cabeceras estáticas desde `public/_worker.js`; `/api/*` conserva la respuesta del Worker backend.
- **Contrato local:** 2/2 pruebas nuevas verifican paridad con `vercel.json`, HSTS idéntico a producción, preservación de metadatos del asset y ausencia de sobrescritura sobre el proxy API.
- **Gate:** typechecks, lint, build, SheetJS, Worker 14/14, operaciones/Pages 4/4, recuperación D1 y Playwright 16/16 aprobados; `npm audit --audit-level=high` devolvió 0 vulnerabilidades al repetirse con red autorizada.
- **Primera vuelta:** deployment `8021b026-350a-48b4-8ce8-05e8b1a2c264`; CSP aprobó, pero el monitor detectó HSTS ausente. Se corrigió antes del cierre.
- **Segunda vuelta:** deployment `9402ae49-bf50-4bca-b8ce-ea47c60da701`; alias y URL inmutable aprobaron 5/5 cada uno con frontend/health HTTP 200, límites HTTP 401 y CSP/HSTS/`nosniff` presentes.
- **Pruebas avanzadas:** contratos navegador→Pages y Pages→Worker cubiertos; carga no aplica porque solo se copian ocho cabeceras en respuestas estáticas. No hubo cambios ni escrituras en producción, Worker backend, D1 o secretos.

## 2026-08-29 — O.14 Retiro del pepper legado

- **Precondición:** D1 agregado confirmó `legacy_admins = 0` y `legacy_without_google = 0`; los dos hashes legados activos pertenecen a identidades Google. Consulta sin escrituras.
- **Cambio autorizado:** eliminado únicamente `PASSWORD_PEPPER_LEGACY` del Worker productivo; `PASSWORD_PEPPER_CURRENT`, D1 y los demás bindings permanecen intactos.
- **Versión:** Secret Change `1f34fd8f-8449-4a0e-aa25-8da6e7c480e6`.
- **Smoke:** monitor productivo 5/5; login sintético inexistente directo/proxy HTTP 401 `INVALID_CREDENTIALS`, confirmando que la configuración actual no cae en `AUTH_NOT_CONFIGURED`.
- **Datos:** los intentos sintéticos registraron solo contadores normales de rate-limiting; no crearon usuarios ni sesiones. La consulta final mantuvo los conteos de usuarios/hashes y reportó `rows_written = 0`, `changed_db = false`.
- **Rollback:** versión compatible `e4fb038c-ca09-409b-8158-d3b1a569f2e4`; acceso Google y restablecimiento producen hashes `v2$` para las cuentas legadas restantes.

## 2026-08-29 — O.17 Confirmación fiable de fichaje y nómina personalizada

- **Evidencia productiva de solo lectura:** Luis Manuel está activo y su clock-in del 29 de agosto
  existe como turno abierto `working`, con proyecto y evento `clock_in` concordantes. No se
  modificó la jornada ni se insertaron datos de prueba.
- **Corrección de fichaje:** tras una mutación exitosa la UI recarga `/api/worker/today` y muestra
  únicamente el estado confirmado por el servidor. El service worker usa navegación network-first
  y excluye todas las rutas API y escrituras del cache.
- **Contrato financiero:** el POST administrativo acepta trabajador y horas; valida rol, rango,
  precisión, pertenencia activa y perfil aprobado. El cálculo reutiliza tarifa, ITIS y Social
  Security del servidor y persiste el snapshot mediante el batch transaccional existente.
- **Cifras exactas:** 40 horas a £20 producen bruto £800, Social Security del trabajador £48,
  ITIS £80, neto £672, Social Security del empleador £52 y coste total £852.
- **Gate local:** typechecks, lint, build, SheetJS, Worker 20/20, operaciones 4/4 más recuperación
  D1 y E2E funcional aprobaron dentro de `npm run verify`. La consulta de audit del mismo comando
  quedó bloqueada por red del sandbox; repetida con red autorizada devolvió 0 vulnerabilidades.
- **Navegadores:** 15/15 en Chromium, Firefox y WebKit, escritorio y móvil. La primera corrida de
  Firefox no pudo crear páginas dentro del sandbox; la matriz completa aprobó fuera de él.
- **Empaquetado:** Wrangler 4.127.1, dry-run explícito sobre producción correcto: 162.37 KiB /
  31.26 KiB gzip, bindings esperados y ninguna migración.
- **Seguridad:** no hay endpoints de pago, el POST conserva sesión admin, origen y CSRF, y la
  auditoría excluye importes y referencias fiscales. No se detectaron hallazgos críticos; carga no
  aplica a estas mutaciones puntuales.
- **Rollback previo al deploy:** versión Worker `1f34fd8f-8449-4a0e-aa25-8da6e7c480e6` y reversión
  del commit/frontend. Los snapshots aprobados y turnos existentes permanecen intactos.
- **Producción:** commit `d490710`; Verify `33264186422` y monitor `33264327193` aprobados;
  checks `Vercel – field-hours` y `Vercel – fieldhours` en `success`; Worker
  `900f64d6-9c0b-4814-be29-03661fe94ad9`. El bundle `index-DLfr3KtO.js` y `sw.js` v2 responden
  200, contienen ambos cambios y el smoke quedó 5/5. La ruta de nómina sin sesión/CSRF devuelve
  403 directa y por proxy.
- **Estado D1 posterior:** consulta agregada con `rows_written: 0`; Luis continúa `working`, con
  clock-in `2026-08-29T13:17:20.864Z`, un evento y sin clock-out. `payroll_runs = 0`.
