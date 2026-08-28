# STACK — Field Hours

## Resumen

SPA/PWA de gestión de personal y operaciones de obra construida con React/TypeScript, con Cloudflare Workers + D1 para fichaje/nómina y Supabase para los módulos BuildTrack; frontend publicado en Vercel.

## Nivel del proyecto

**Nivel 3 — empresarial.** Maneja autenticación, autorización por roles, geolocalización, datos personales y fiscales cifrados, nómina, auditoría, dos plataformas de datos y migraciones en producción.

- **Workflow completo de Superpowers:** no; el core documenta soporte de Superpowers solo para OpenCode y la plataforma activa es Codex CLI.
- **Ciclo de autocrítica completo:** sí; seguridad, QA y rendimiento cuando corresponda son gates obligatorios.
- **Skills avanzadas:** `advanced-qa-strategy` para la estrategia de pruebas; `technical-governance` cuando aparezca una decisión costosa de revertir; `advanced-architecture` solo si se replantea la separación actual entre Cloudflare y Supabase.

## Entorno

- Plataforma de orquestación: Codex CLI `0.150.0-alpha.8`.
- Core Cronos: `4.2.0`, restaurado en `.cronos/`; coincide con `.agencia-version`.
- Compatibilidad: el core fue verificado documentalmente contra Codex al 3 de agosto de 2026, no contra esta versión alfa exacta. En esta sesión se comprobaron lectura/escritura del workspace, permisos con aprobación y ejecución de herramientas; Playwright MCP no está expuesto.
- Superpowers instalado: no aplica en Codex CLI según el core vigente.

## Frontend

- Tecnología: React 18, TypeScript 5, Vite 8, React Router 7, TanStack Query, Tailwind CSS, shadcn/ui y Radix UI.
- PWA: `manifest.webmanifest`, service worker propio y cola offline en `localStorage`.
- Por qué: es el stack heredado y operativo del producto; permite una SPA responsive y módulos cargados de forma diferida.

## Identidad visual

- Referencia existente: sistema “site office” documentado en `src/index.css` y el plan UX de BuildTrack.
- Design DNA — paleta: fondo bone cálido, tinta charcoal y ámbar de alta visibilidad como único acento fuerte; colores semánticos para éxito, advertencia, peligro e información.
- Design DNA — tipografía: Archivo Variable para interfaz y JetBrains Mono Variable para cifras/identificadores.
- Design DNA — tono: operativo, sobrio, legible en móvil y orientado al trabajo de campo.
- Default genérico evitado: dashboards con gradientes, exceso de tarjetas anidadas y múltiples colores decorativos sin significado.
- Regla de contraste semántico: los tokens `*-foreground` se reservan para fondos semánticos sólidos; sobre fondos translúcidos (`*/10`, `*/15`) se usa `text-foreground` para contenido o el color semántico oscuro para etiquetas breves. Todo texto normal debe alcanzar al menos 4.5:1 en modo claro.

## Backend

- Tecnología principal: Cloudflare Workers en TypeScript para autenticación, fichaje, proyectos, historial, nómina y auditoría.
- Subsistema heredado: Supabase JS para módulos BuildTrack y sus flujos de datos/realtime.
- Contratos: API HTTP bajo `/api`, sesiones seguras por cookie, CSRF para escrituras y autorización por rol/organización.
- Por qué: documenta la arquitectura híbrida actualmente desplegada; no propone una migración de proveedor en esta fase.

## Base de datos

- Cloudflare D1/SQLite: fuente de datos del módulo workforce/payroll y sus migraciones versionadas en `cloudflare/migrations/`.
- Supabase/PostgreSQL: fuente de datos de los módulos BuildTrack; migraciones en `supabase/migrations/`.
- Estado: `0008_payroll_runs.sql` y `0009_worker_flexibility.sql` están aplicadas en D1 remoto; no quedan migraciones pendientes.
- Regla: toda migración lleva rollback; las destructivas requieren además backup verificado y autorización explícita.

## Hosting / Despliegue

- Frontend: Vercel.
- API: Cloudflare Workers.
- Datos: Cloudflare D1 y Supabase.
- CI/CD: `.github/workflows/ci.yml` ejecuta `npm run verify` en push/PR; Vercel se despliega asociado al repositorio y el Worker se opera con Wrangler.
- Gate: no desplegar ni migrar para “probar”; primero seguridad, E2E limpio, backup/rollback y confirmación del operador.

## Testing

- Herramientas actuales: TypeScript (`tsc`), ESLint, build de Vite, Wrangler dry-run, script smoke del Worker y Playwright Test.
- Playwright MCP habilitado: **no**; no está configurado en un `.codex/config.toml` de proyecto ni expuesto en la sesión actual.
- Ruta elegida: Playwright Test CLI con fixtures y datos sintéticos, sin cuentas ni escrituras de producción.
- Ubicación de la suite E2E: `e2e/`; runner reproducible en `scripts/run-playwright.mjs` y scripts `test:e2e*` en `package.json`.
- Reportes: `qa/reports/` y artefactos de Playwright, no versionados.
- Última corrida: 16/16 pruebas aprobadas en Chromium; cubren nómina/Salary Advice, separación de roles, CSRF, flexibilidad de jornada y auditoría de contraste/foco/nombres accesibles/overflow para admin y trabajador en escritorio y móvil, sin tráfico externo.
- Matriz crítica: la auditoría integral de legibilidad se ejecuta además en Chromium, Firefox y WebKit mediante `npm run test:e2e:cross-browser`; no reemplaza el gate completo de Chromium.

## Integraciones externas

- Google OAuth.
- Cloudflare Workers y D1.
- Vercel.
- Supabase Auth/Database/Storage/Realtime.
- OpenStreetMap mediante enlaces/recursos permitidos por CSP.
- SheetJS CE 0.20.3 (`xlsx` desde el tarball oficial con integridad fijada en el lockfile) para importación/exportación local de hojas de cálculo.

## Costo

- Servicios con posible facturación: Vercel, Cloudflare y Supabase; el plan y gasto mensual reales no están documentados en el repositorio.
- APIs de pago nuevas: ninguna.
- Límites/alertas de facturación: no verificables desde el repositorio; no se autoriza gasto nuevo en esta fase.

## Gestión de secretos

- `.gitignore`: sí; excluye `.env*`, credenciales, claves, backups y estado local de Wrangler, conservando ejemplos.
- `.env.example`: existe y documenta la conexión pública de Supabase; no debe contener secretos privilegiados.
- Producción: variables de entorno de Vercel, secretos de Cloudflare Worker y configuración segura de Supabase.
- Datos sensibles de nómina: AES-256-GCM con clave del Worker; revelado administrativo protegido y auditado.

## Dependencias y seguridad

- Auditoría inicial del 25 de agosto de 2026: 12 vulnerabilidades altas, 1 moderada y 0 críticas.
- Estado corregido: `npm audit` reporta 0 vulnerabilidades después de actualizar React Router 7.18.2, Vite 8.2.2, PostCSS 8.5.26, SheetJS CE 0.20.3 y transitivas compatibles; Playwright quedó correctamente limitado a `devDependencies`.
- Regresión: typecheck frontend/Worker, lint, build, 5/5 E2E y smoke SheetJS aprobados. Evidencia detallada en `qa/DEPENDENCY_SECURITY_REPORT.md`.

## Modelo recomendado

- Activo: `gpt-5.6-sol`, esfuerzo `xhigh`, adecuado para la restauración documental, implementación y QA de esta fase.
- Seguridad: para la autocrítica de un Nivel 3 conviene, si el selector `/model` ofrece otra opción fuerte, usar un modelo distinto al que implementó; no bloquea la construcción, pero reduce el punto ciego de autoauditoría.
- Alterno ante caída: no hay alterno documentado ni cambio automático; debe elegirse manualmente desde `/model` o configurarse mediante un proveedor compatible.

## Convenciones de código

- Estilo: TypeScript estricto, componentes funcionales React, imports por alias `@/`, ESLint y utilidades Tailwind.
- Estructura: `src/` para SPA, `cloudflare/src/` para Worker, migraciones separadas por proveedor, `docs/` para decisiones y releases.
- Nomenclatura: componentes React en PascalCase; funciones/variables en camelCase; migraciones con prefijo numérico; endpoints REST bajo `/api`.
- Idioma: interfaz actualmente mayormente en inglés con soporte i18n; documentación de Cronos en español.

## Estado de este documento

Reconstruido y confirmado por el operador el 25 de agosto de 2026. Actualizado ese mismo día después de cerrar la infraestructura E2E y la remediación de dependencias.
