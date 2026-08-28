# Field Hours — Plan de Trabajo y Roadmap de Mejoras

Documento de seguimiento de tareas y validaciones paso a paso. Cada tarea pasa por desarrollo, pruebas locales y verificación antes de marcarse como completada.

---

## Fase 7: Payroll, historial administrativo y experiencia móvil (En curso)

> Estado: el perfil, configuración, preview, revisión/aprobación y Salary Advice final están desplegados en Worker/Vercel con D1 `0008/0009`; no se ejecutan transferencias automáticas.

- [x] Guardar y mostrar el historial de solicitudes de acceso, migración y restablecimiento, incluyendo aprobadas, rechazadas, motivo, administrador y fecha. Validado con typecheck/build y despliegue del Worker y Vercel.
- [x] Permitir que los trabajadores aprobados indiquen su porcentaje de ITIS (impuestos/tax rate), con validación y control administrativo. Validado en UI móvil, typecheck/build/lint y despliegue de Worker/Vercel.
- [x] Optimizar la web-app para móviles: espacios, navegación, formularios y UX/UI responsive; evaluar una auditoría con Impeccable. Validado con Playwright/Chrome a 390px para trabajador y admin, sin overflow de página, y desplegado en Vercel.
- [x] Permitir que los trabajadores vean sus horas acumuladas y la fecha estimada de cobro del primer día de cada mes. Validado con resumen de turnos completados, prueba móvil y smoke checks de producción.
- [x] Permitir al administrador exportar un borrador de payslip / recibo de salario con el formato de Salary Advice proporcionado. Validado con typecheck/build/lint, Playwright/Chrome a 390px y verificación HTTP del bundle publicado en Vercel; tarifa, ITIS y seguridad social siguen siendo entradas manuales hasta completar las reglas de Jersey.
- [x] Permitir que cada trabajador complete y mantenga los datos necesarios para generar su payslip. Validado con formulario de captura, actualización y revisión administrativa.
- [x] Crear un perfil de nómina de captura única por trabajador: nombre legal, dirección, número de empleado, número de seguro social, Tax Reference, Social Reference, porcentaje ITIS y datos bancarios si el negocio los necesita. Validado con migración D1 0006 y smoke checks de producción.
- [x] Proteger los datos sensibles de nómina con cifrado, acceso restringido al dueño/admin, enmascarado en pantalla, auditoría y opción de actualización controlada. AES-256-GCM, clave secreta de Worker, CSRF, ruta de revelado admin auditada y backup verificado.
- [x] Permitir que el administrador configure tarifa por hora, periodo de pago, datos del negocio y reglas fiscales de Jersey antes de calcular la nómina. Desplegado con migración D1 0007, endpoint admin+CSRF, cifrado de referencias, auditoría y formulario responsive; verificado en Worker/Vercel. Los cálculos automáticos siguen pendientes.
- [x] Calcular automáticamente el primer día de cada mes: horas aprobadas, salario bruto, seguro social del trabajador, ITIS/impuestos, deducciones, salario neto y totales acumulados. Desplegado como preview admin protegido con reglas Jersey 2026, advertencia de estimación y validación de Worker/Vercel; pendiente únicamente el flujo de revisión/aprobación antes de considerar una nómina lista.
- [x] Crear un proceso de revisión y aprobación de nómina antes de marcar el pago como listo; no ejecutar transferencias bancarias automáticamente sin confirmación del administrador. Desplegado con D1 `0008`, Worker `6a65af24-a8c2-4301-9276-9ac8aff12eba` y Vercel `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL`; autocrítica, E2E y smoke productivo aprobados, sin rutas de transferencia bancaria.
- Evidencia: `npm.cmd run typecheck`, `npm.cmd run typecheck:worker`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e:list`, `npm.cmd run test:e2e`, `npm.cmd run test:xlsx`, `git diff --check` y `wrangler deploy --dry-run` correctos; Playwright 5/5 y `npm audit` en 0 vulnerabilidades. Recuperación previa verificada con Time Travel bookmark `00000040-00000000-000050d3-d1141dc19fe77f08de333a18256fe5a8`; rollback SQL probado en D1 local aislada. Producción: `0008/0009` aplicadas sin pendientes, cero violaciones de claves foráneas, health directo/proxy HTTP 200 y contratos protegidos HTTP 401 sin sesión. Lint conserva dos advertencias preexistentes.
- [x] Generar y exportar el payslip de cada trabajador con el formato Salary Advice, incluyendo Allowances, Deductions, Net Pay, Gross Taxable Pay, Tax Paid, Tax Ref y Social Ref. Desplegado y verificado el 25 de agosto de 2026 con Worker `c910ed77-acde-4038-8544-721e2e229817`, Vercel `dpl_Bzr7miPjM5Aq9CUs8MqMeLYrDPbS` y smoke directo/proxy HTTP 200; rutas nuevas protegidas HTTP 401 sin sesión. Sin SSN/banco, sin recalcular importes ni iniciar pagos. Release: `docs/RELEASE-2026-08-25-final-salary-advice.md`.

## Optimizaciones operativas detectadas

- [x] **Tarea O.1 (Gobernanza Cronos/DDD)**: Restaurar o completar la adopción del proyecto al core Cronos: recuperar `.cronos/AGENCY.md` y `.cronos/MASTER_PROMPT.md`, crear o reconciliar `BRIEF.md` y `STACK.md`, y validar que `tasks.md` refleje una única fuente de verdad antes de retomar nuevas funcionalidades. Core local `4.2.0`, `BRIEF.md` y `STACK.md` restaurados y verificados; clasificación Nivel 3 y stack confirmados por el operador el 25 de agosto de 2026.
- [x] **Tarea O.2 (QA E2E reproducible)**: Playwright migrado a `@playwright/test`, runner multiplataforma con servidor Vite controlado, scripts `test:e2e*` y suite `e2e/` aislada de producción. Valida submit/aprobación/bloqueo y solicitud de cambios de nómina, separación de roles, CSRF fail-closed, proyecto creado por trabajador, dos breaks de distinta duración, dos shifts diarios, GPS sin foto, totales/historial y viewport móvil sin overflow. Evidencia actualizada: 6 pruebas y suite 6/6 en verde; reporte en `qa/TEST_REPORT.md` y HTML local en `qa/reports/playwright/`.
- [x] **Tarea O.3 (Dependencias y seguridad)**: Remediadas las 12 vulnerabilidades altas y 1 moderada iniciales. React Router 7.18.2, Vite 8.2.2, plugin React SWC 4.3.3, PostCSS 8.5.26, SheetJS CE 0.20.3 oficial y transitivas compatibles; Playwright movido a `devDependencies` y configuración Vite migrada a Rolldown. Evidencia: `npm audit` en 0 vulnerabilidades, árbol válido, smoke SheetJS, typechecks, lint sin errores, build y E2E 6/6 aprobados. Reporte: `qa/DEPENDENCY_SECURITY_REPORT.md`.
- [x] **Tarea O.4 (Gate CI y datos de navegadores)**: Comando único `npm run verify` y workflow `.github/workflows/ci.yml` ejecutan typechecks, lint, build, smoke SheetJS, E2E y audit sin secretos ni producción. `caniuse-lite@1.0.30001810` queda fijado como dependencia de desarrollo y elimina la advertencia de Browserslist. Evidencia: gate local completo en verde y política de actualización controlada documentada en `docs/CI.md`.
- [x] **Tarea O.5 (Higiene del build y paquete Vercel)**: `.vercelignore` limita el upload seco de Vercel a 129 archivos/1,25 MB (antes 199/3,50 MB), excluyendo documentación, QA, tests, configuración Cronos, backend/migraciones, `dist`, `.env.example` y locks alternativos. `sucrase@3.35.1` elimina la advertencia transitive de `glob@10.5.0`; `allowScripts` aprueba únicamente `@swc/core@1.16.1` y `esbuild@0.25.0`. Instalación limpia `npm ci` sin warnings deprecatorios, `npm approve-scripts --allow-scripts-pending` vacío, `npm audit` 0 y gate `npm run verify` completo (typechecks, lint, build, SheetJS y E2E 6/6) en verde.
- [x] **Tarea O.6 (Defensa contra abuso de operaciones sensibles)**: Implementado y desplegado el límite por organización/administrador para revelado de perfiles (10/15 min) y preparación de Salary Advice (30/15 min), con `Retry-After`, claves SHA-256 namespaced y variables diferenciadas por entorno; política en `docs/RATE_LIMITING.md`. Prueba HTTP local: intentos 1–10 `404`, intento 11 `429` con `Retry-After: 900`, y recuperación fuera de ventana `404`, sin referencias ni importes en la respuesta. Worker `aae02977-f104-407d-98d8-6d5f0174ac30`; smoke productivo `/api/health` HTTP 200 y `/api/admin/payroll-runs` sin sesión HTTP 401. Release: `docs/RELEASE-2026-08-27-rate-limiting.md`.
- [x] **Tarea O.7 (Higiene de lint/frontend)**: Separar las constantes/funciones compartidas de `src/lib/i18n.tsx` en `i18n.constants.ts`, `i18nContext.ts` y `useI18n.ts`, manteniendo el contrato de traducciones y eliminando las dos advertencias `react-refresh/only-export-components`. Verificado con `npm.cmd run verify`: typechecks, lint sin advertencias, build, smoke SheetJS, E2E 6/6 y `npm audit` con 0 vulnerabilidades.
- [x] **Tarea O.8 (Salida fiable y turnos abiertos entre días) — DESPLEGADA**: Corregida la confirmación engañosa que declaraba encolada una salida perdida por red sin guardarla; la acción se preserva con la misma `idempotencyKey`, se reintenta mientras la app está abierta y el GPS pendiente no se registra en consola. El único turno abierto se recupera aunque su `work_date` sea anterior y se prioriza en la vista administrativa. Evidencia: consulta D1 productiva de solo lectura confirmó ausencia del `clock_out` original; `npm.cmd run verify` aprobó typechecks, lint, build, SheetJS, Worker 2/2 y E2E 9/9; `npm.cmd audit` reportó 0 vulnerabilidades, Wrangler dry-run compiló el Worker y GitHub Actions `Verify #15` pasó. Despliegue autorizado explícitamente el 28 de agosto de 2026: Worker `a65b0a37-6f03-4658-9b89-7f83ea769861` y frontend Vercel `dpl_Fe5dUBNdn17sZ6PAxvKKDBXqeZTr`, con alias productivo confirmado en `dpl_EnLDeCBJWDqC5XGKgGCsmgMR8dA3`; health directo/proxy HTTP 200 y contratos protegidos 401/403. Rollback y detalle en `docs/RELEASE-2026-08-28-reliable-clock-out.md`. No se alteraron horas ni se cerraron turnos automáticamente.

## 📊 Estado General del Proyecto
- **Fase Actual**: Fase 7 — Payroll y aprobación administrativa (EN CURSO)
- **Última Actualización**: 28 de Agosto de 2026

---

## 📌 Fase 1: Historial, Reportes y Exportación de Horas *(Completada)*
Objetivo: Permitir al administrador y a los trabajadores consultar todas sus jornadas pasadas, totales acumulados y descargar reportes para nómina/control.

- [x] **Tarea 1.1 (Backend)**: Crear endpoint `/api/admin/shifts/history` en Cloudflare Workers para consultar el historial de turnos con filtros de fecha (`startDate`, `endDate`) y `userId`.
- [x] **Tarea 1.2 (Backend)**: Crear endpoint `/api/worker/shifts/history` para que el propio trabajador consulte su historial de horas trabajadas en la semana/mes.
- [x] **Tarea 1.3 (Frontend)**: Añadir selector de **Live Today** vs **History & Reports** en el panel de administrador con filtros rápidos (*Today, This Week, Last Week, This Month, All Records*).
- [x] **Tarea 1.4 (Frontend)**: Mostrar tarjetas de totales acumulados (Total Worked Hours, Break Time, Total Shifts, Active Staff) y selector de filtrado por trabajador individual o cuadrilla completa.
- [x] **Tarea 1.5 (Frontend)**: Modal detallado por trabajador con listado cronológico de turnos y sus evidencias GPS individuales con enlaces a OpenStreetMap.
- [x] **Tarea 1.6 (Exportación)**: Implementar exportación a Excel (.xlsx) de los partes de horas filtrados.
- [x] **Tarea 1.7 (QA & Verificación)**: Pruebas de compilación exitosas (0 errores de tipos en App y Worker, build optimizado) y despliegue a GitHub/Vercel.

---

## 📌 Fase 2: Ajuste y Corrección Manual de Turnos por el Administrador *(Completada)*
Objetivo: Resolver situaciones reales en obra (olvidos de fichar salida, batería agotada) manteniendo auditoría estricta.

- [x] **Tarea 2.1 (Backend)**: Crear endpoint `POST /api/admin/shifts/adjust` en Cloudflare Workers para modificar o cerrar un turno pendiente, registrando el cambio en `workforce_audit_events`.
- [x] **Tarea 2.2 (Frontend)**: Botón de "Adjust" en la tabla de historial y en el modal de trabajador con formulario para fechas de entrada/salida y motivo obligatorio de ajuste.
- [x] **Tarea 2.3 (Auditoría)**: Registro inmutable con usuario auditor, motivo del cambio, horas previas y horas corregidas; el historial del trabajador muestra que las horas fueron modificadas por un administrador, con motivo y fecha del último ajuste.
- [x] **Tarea 2.4 (QA & Verificación)**: Verificación de typecheck frontend/Worker, lint, build, SheetJS, E2E 7/7 y `npm audit` con 0 vulnerabilidades. Los timestamps de ajuste validan formato y orden entrada/salida; no requiere migración.

---

## 📌 Fase 3: PWA Instalable y Fichaje Offline *(Completada)*
Objetivo: Permitir instalar la aplicación en móviles (Android/iOS) y permitir fichar en sótanos o zonas sin cobertura.

- [x] **Tarea 3.1 (PWA)**: Configuración de `manifest.webmanifest`, service worker `sw.js`, icono PWA e integración con etiquetas meta para iOS / Android.
- [x] **Tarea 3.2 (Offline Queue)**: Módulo `offlineQueue.ts` que almacena fichajes con GPS y timestamp en `localStorage` ante desconexión de red.
- [x] **Tarea 3.3 (Auto-Sync)**: Reintento y sincronización automática de fichajes encolados tan pronto como el navegador recupera la conexión a internet.
- [x] **Tarea 3.4 (Indicadores Visuales)**: Badges y avisos de estado `Online` / `Offline` y contador de acciones pendientes de sincronización.

---

## 📌 Fase 4: Geocercas y Proyectos / Obras *(Completada)*
Objetivo: Vincular fichajes a ubicaciones de obra específicas y alertar fichajes fuera de perímetro.

- [x] **Tarea 4.1 (Backend D1 & Migración)**: Tabla `workforce_projects` (nombre, código, dirección, latitud, longitud, radio de tolerancia en metros y estado) y vinculación `project_id` en `workforce_shifts`.
- [x] **Tarea 4.2 (Backend Endpoints)**: `GET /api/projects` para listar obras y `POST /api/admin/projects` para crear y editar proyectos con coordenadas GPS.
- [x] **Tarea 4.3 (Geocerca & Haversine)**: Cálculo matemático de distancia en metros entre el punto de fichaje del trabajador y el centro de la obra. Registro en auditoría si el fichaje excede el radio.
- [x] **Tarea 4.4 (Frontend Panel de Proyectos)**: Pestaña **Projects & Sites** para que el administrador cree obras, capture su GPS con un clic y fije el radio de tolerancia (ej. 200m).
- [x] **Tarea 4.5 (Frontend Vista del Trabajador)**: Selector de obra asignada al momento de pulsar "Clock in" y visualización de la geocerca.
- [x] **Tarea 4.6 (Reportes y Excel)**: Columna de Proyecto/Obra en la tabla de historial y en los reportes de exportación a Excel.

---

## 📌 Fase 5: Verificación Fotográfica Opcional y Multi-idioma *(Completada)*
Objetivo: Evitar suplantación ("buddy punching") y facilitar el uso a cuadrillas internacionales.

- [x] **Tarea 5.1 (Foto Evidencia)**: Captura de selfie frontal en tiempo real con la cámara del dispositivo al pulsar "Clock in", con compresión ultraligera en canvas (JPEG base64 ~15-20KB), opción de omitir o repetir foto y almacenamiento inmutable en eventos de auditoría.
- [x] **Tarea 5.2 (Visor de Evidencia en Panel Admin)**: Miniaturas interactivas y visor modal a pantalla completa para que el administrador inspeccione las fotos de fichaje en el panel de hoy y en el historial.
- [x] **Tarea 5.3 (Multi-idioma i18n)**: Sistema completo de internacionalización (`i18n.tsx`) con selector visual en cabecera (🇪🇸 Español, 🇺🇸 Inglés, 🇧🇷 Portugués) disponible tanto en pantalla de acceso como en la app principal.
- [x] **Tarea 5.4 (QA & Verificación)**: Build de Vite completado con 0 errores, typecheck de frontend y worker con 0 errores y despliegue del worker a Cloudflare.

---

## 📌 Fase 6: Inicio de sesión con Google y aprobación administrativa *(En revisión)*

Objetivo: Permitir acceso con Google manteniendo la sesión segura del Worker, con aprobación del administrador para nuevos accesos y migraciones de cuentas existentes.

- [x] **Tarea 6.1 (Backend/OAuth)**: Flujo Google OAuth con `state` de un solo uso, validación de firma RS256, emisor, audiencia y correo verificado.
- [x] **Tarea 6.2 (Datos)**: Migración D1 `0004_google_auth.sql` para identidades Google, solicitudes pendientes y estados OAuth, con rollback manual documentado.
- [x] **Tarea 6.3 (Aprobación)**: Endpoints protegidos para listar, aprobar y rechazar solicitudes; la aprobación registra auditoría y vincula o crea el trabajador.
- [x] **Tarea 6.4 (Frontend)**: Botón de Google, opción de migración desde el menú de usuario y panel administrativo de solicitudes pendientes.
- [x] **Tarea 6.5 (Configuración/QA)**: OAuth staging configurado y verificado. Evidencia: Worker `field-hours-api-staging`, D1 remota `field-hours-staging` (`7b945f18-96c5-4535-a117-7156474e3ca2`), migraciones `0001` a `0009`, frontend público `https://field-hours-staging.pages.dev`, secretos cargados sin versionarlos, cliente Google `field-hours-staging`, callback `https://field-hours-staging.pages.dev/api/auth/google/callback`, `GET /api/auth/google/start?mode=invalid` responde `400`, y login real completado con Google: solicitud `access` creada, aprobada mediante endpoint administrativo protegido y sesión activa confirmada en la aplicación. Typecheck/build, lint y suite E2E existente pasan.

---

## 📌 Backlog: Flexibilidad de jornada y proyectos creados por trabajadores *(Pendiente)*

Objetivo: dar mayor flexibilidad a los trabajadores durante su jornada, manteniendo el registro correcto de horas, ubicación y sitio de trabajo.

- [x] **Tarea B.1 (Breaks)**: Permitir que cada trabajador inicie tantos breaks como necesite al día y durante el tiempo que necesite. El contador de tiempo trabajado se detiene durante cada break y registra inicio, fin y duración para historial y reportes.
- [x] **Tarea B.2 (Turnos)**: Permitir múltiples shifts separados durante el mismo día sin solapamientos; desplegado con D1 `0009` y conservando el índice de un único turno abierto.
- [x] **Tarea B.3 (Proyectos)**: Permitir que los trabajadores creen proyectos con nombre y descripción breve; contrato desplegado y protegido por sesión/CSRF.
- [x] **Tarea B.4 (Fichaje y ubicación)**: Fichaje sin foto obligatoria, conservando GPS y selección de proyecto.
- [x] **Tarea B.5 (QA)**: E2E 5/5: dos breaks (10 y 25 min), dos shifts el mismo día, total de 1h 25m, historial, GPS, contrato sin foto, CSRF y viewport 390x844 sin overflow. Smoke productivo aprobado después de `0009`: esquema/índices correctos, health directo/proxy HTTP 200, rutas nuevas protegidas y bundle publicado.

> Desplegado el 25 de agosto de 2026 con D1 `0009`, Worker `6a65af24-a8c2-4301-9276-9ac8aff12eba` y Vercel `dpl_AixYHr6JEu5RTYTNLXeX65PN3hUL`; rollback y recuperación documentados en `docs/RELEASE-2026-08-25-payroll-worker-flexibility.md`.
