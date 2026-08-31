# Release 2026-08-30 — corrección de Salary Advice y PWA

Estado: **desplegada y verificada en producción** el 30 de agosto de 2026, con autorización explícita
del operador. D1 `0010`, Worker `6c551bca-3a7c-4a98-a019-23538c9e379f` y Vercel
`dpl_CfgtC97pgeFRD2EkJtVuk46F1FDf` están activos.

## Comportamiento corregido

- Se retiraron el preview global automático, payroll runs, review/approve, request changes y estados
  `payment ready` del contrato y UI activos.
- Salary Advice tiene una pestaña propia. El administrador elige un empleado, semana lunes–domingo o
  mes calendario, periodo, fecha de pago, tarifa del documento, ITIS confirmado, Social Security y
  acumulados confirmados; después descarga el PDF directamente.
- Social Security mensual exige elegir explícitamente 6% estándar o 0% exento y se reinicia al
  cambiar empleado, periodo o frecuencia. Semanal exige un importe reconciliado por el operador.
- El PDF sigue la referencia de Salary Advice, muestra `ESTIMATE` en todas las páginas, no incluye
  Employer Social Security, coste patronal, referencias del negocio, banco ni aprobación. Identidades
  largas pasan completas a una segunda página; Unicode compatible usa fuentes embebidas cargadas de
  forma diferida y los glifos/layouts complejos no soportados bloquean la descarga antes de producir
  un documento alterado.
- La configuración del negocio contiene únicamente nombre y dirección. Perfil y configuración usan
  tablas activas limpias `workforce_salary_advice_*`; el legado queda intacto y fuera del flujo.
- Administrador y trabajador disponen de acción de instalación Android/PWA. El build precarga todos
  los bundles con hash, purga hashes retirados y evita devolver HTML a solicitudes JS/CSS offline.
- Se habilitó zoom móvil, se sincroniza `<html lang>` con ES/EN/PT y los diálogos/paneles restauran el
  foco y responden a Escape.

## Migración `0010`

Es aditiva y crea:

- `workforce_salary_advice_profiles`, con PK y FK de organización+usuario y número de empleado ASCII
  normalizado en mayúsculas, único por organización;
- `workforce_salary_advice_settings`, limitada a identidad del negocio y trazabilidad de actualización.

Copia únicamente perfiles completos de memberships `worker` activas, con usuario no deshabilitado, y
la identidad empresarial existente. Los preflight de números duplicados/identificadores inválidos
están comentados al inicio del SQL; ambos devolvieron cero antes del corte productivo.

La secuencia ejecutada fue bookmark/preflight → `0010` → verificación D1 → Worker → smoke
backend → candidato Vercel protegido → promoción → smoke público. Para no copiar PII financiera
a un archivo local sin cifrar, la recuperación previa quedó dentro de Cloudflare: bookmark Time Travel
`000000a4-00000000-000050d8-13e624b6916c0d631bcf5975797edda2` y el backup automático transaccional
de `migrations apply`. No se creó ningún export productivo local.

El rollback preferido revierte Worker/frontend y conserva las tablas nuevas; no restaura el workflow
alucinado. Un `DROP` o un restore de Time Travel solo puede ocurrir después de evaluar escrituras
posteriores, verificar el punto elegido y obtener autorización destructiva separada.

## Evidencia local

- Typecheck frontend y Worker: aprobados.
- ESLint y build Vite: aprobados; `dist/sw.js` contiene 57 bundles/assets con hash y ningún marcador
  vacío. Incluye fontkit y Unifont WOFF, no la variante WOFF2 que el renderer dejaba visualmente en blanco.
- Pruebas Worker: 34/34 aprobadas; una reauditoría focal adicional de backend/migración aprobó 14/14.
- Ensayo D1 local export/import: 54 objetos de esquema y 15 contadores, sin violaciones de FK;
  producción no fue accedida.
- Pruebas PDF: 6/6 aprobadas. Además de extracción exacta, el test Unicode valida píxeles de tres
  regiones dinámicas; PDF normal, continuación y Unicode fueron inspeccionados visualmente.
- E2E completo Chromium: 23/23; reauditoría independiente Salary Advice/PWA/legibilidad: 16/16.
  Service Worker: 7/7 y smoke real offline con shell controlado, Unifont cacheado y cero rutas `/api`.
- `npm audit --audit-level=high`: 0 vulnerabilidades. `git diff --check`: sin errores.
- Autocrítica funcional, seguridad, rendimiento, QA y simplicidad: sin hallazgos críticos o altos
  abiertos. El control visual detectó el falso positivo WOFF2 y se corrigió antes de cerrar la fase.
- Graphify actualizado a 0.9.53 con parser SQL: más de 3.500 nodos, más de 5.400 relaciones y más
  de 400 comunidades;
  diagnóstico final con cero endpoints ausentes, relaciones colgantes, bucles, duplicados o nodos de
  código sin verificar. El query de control distingue el flujo activo de Salary Advice del contrato
  histórico retirado, y `graph.json`, `graph.html` y `GRAPH_REPORT.md` quedaron regenerados.

## Evidencia productiva

- Preflight: duplicados `0`, identificadores inválidos `0`, `PRAGMA quick_check=ok`, cero violaciones
  FK, ledger exacto `0001–0009` y cero objetos parciales de `0010`.
- D1 posterior: ledger exacto `0001–0010`, sin migraciones pendientes, cuatro objetos nuevos, 1/1
  perfil y 1/1 configuración copiados, cero faltantes y todos los conteos históricos sin cambios.
  Bookmark posterior: `000000a8-00000000-000050d8-11ce9361a6afc61a299021333ff1cbe7`.
- Worker activo: `6c551bca-3a7c-4a98-a019-23538c9e379f`; rollback conocido-bueno:
  `900f64d6-9c0b-4814-be29-03661fe94ad9`. El smoke directo aprobó 9/9 contratos HTTP.
- Candidato Vercel protegido: 14 contratos HTTP y 4 assets críticos aprobados antes de promoverlo.
  Deployment activo: `dpl_CfgtC97pgeFRD2EkJtVuk46F1FDf`; rollback conocido-bueno:
  `dpl_9w53QSuwsVAiTm5mzgw9UBFfzhcp` (`fieldhours-rb1u8lmnl-andres-leo-san-s-projects.vercel.app`).
- Smoke público final: 10/10. Frontend, manifiesto, service worker, iconos, health directo/proxy y
  límites de autenticación aprobaron; `/api/admin/payroll-runs` permanece 404. El bundle público
  contiene Salary Advice e instalación PWA y no contiene rutas/textos de review/approve.
- No se ejecutó un cálculo autenticado sobre datos reales durante el smoke; por tanto, no se expuso
  PII ni se creó un evento financiero sintético.

## Rollback preparado

- Worker: revertir a `900f64d6-9c0b-4814-be29-03661fe94ad9` y repetir el smoke directo.
- Frontend: promover el deployment conocido-bueno `dpl_9w53QSuwsVAiTm5mzgw9UBFfzhcp` y repetir el
  monitor público.
- D1: conservar las tablas aditivas. No usar `DROP` ni Time Travel después de tráfico real sin una
  evaluación y autorización destructiva nuevas.
