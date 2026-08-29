# Release 2026-08-28 — transición segura del pepper de contraseñas

Estado: Worker desplegado y validado en producción; administrador migrado; retiro del secreto legado pendiente de una cuenta local.

## Alcance

- elimina el pepper fijo del código del Worker y de los scripts de bootstrap/seed;
- exige `PASSWORD_PEPPER_CURRENT` con 64-256 caracteres;
- almacena hashes nuevos como `v2$<hash>` en la columna `password_hash` existente;
- admite temporalmente hashes históricos sin prefijo mediante `PASSWORD_PEPPER_LEGACY`;
- rehashea un login legado válido antes de crear la sesión y registra `account.password.pepper_upgraded`;
- aplica el formato actual a registro, cambio, restablecimiento y usuarios creados mediante Google;
- protege `.dev.vars` y sus variantes en `.gitignore`.

No hay migración de esquema. El frontend y sus contratos no cambian.

## Línea base productiva de solo lectura

Consulta agregada del 28 de agosto de 2026, sin correos, hashes ni secretos:

- cuentas activas: 4;
- hashes `v2$`: 0;
- hashes legados: 4;
- administradores legados: 1;
- cuentas legadas sin identidad Google: 2.

La consulta reportó `rows_written: 0` y `changed_db: false`. Por tanto, después de migrar al administrador todavía quedará al menos una cuenta local que debe iniciar sesión o restablecer su contraseña antes de retirar el secreto legado.

## Validación productiva

- autorización explícita del operador recibida antes de cargar secretos y desplegar;
- bookmark Time Travel vigente antes del cambio;
- `PASSWORD_PEPPER_CURRENT` aleatorio y `PASSWORD_PEPPER_LEGACY` cargados directamente en Cloudflare sin imprimir ni guardar valores;
- Worker `14f4748b-88a4-48db-aefe-174d6fe77dca`, 158.88 KiB / 30.55 KiB gzip y startup de 6 ms;
- monitor productivo 5/5: frontend y health directo/proxy HTTP 200; límites Worker/proxy HTTP 401;
- después del login local del administrador: 1 hash `v2$`, 3 hashes legados, 0 administradores legados, 1 cuenta legada sin Google y 1 evento `account.password.pepper_upgraded`;
- la consulta de verificación reportó `rows_written: 0` y `changed_db: false`.

## Evidencia local

- `npm.cmd run typecheck:worker`: aprobado.
- `npm.cmd run lint`: aprobado sin advertencias.
- `npm.cmd run test:worker`: 13/13; cubre ausencia/configuración inválida, peppers iguales, hash actual, compatibilidad legado, versión desconocida, rehash administrativo previo a sesión, contraseña inválida sin escritura y login actual sin rehash.
- `npm.cmd run verify`: typechecks, lint, build, SheetJS, Worker 13/13, operaciones, ensayo D1 y Playwright 16/16 aprobados; la única salida roja fue el `npm audit` bloqueado por red del sandbox.
- `npm.cmd audit --audit-level=high` con red autorizada: 0 vulnerabilidades.
- `npx.cmd wrangler deploy --dry-run --config cloudflare/wrangler.jsonc --env=""`: aprobado; 158.88 KiB / 30.55 KiB gzip, sin despliegue.
- D1 recovery: 50 objetos y 13 contadores iguales, cero violaciones FK, sin acceso a producción.

## Promoción ejecutada y seguimiento

1. Confirmar un bookmark Time Travel vigente y que CI continúa verde.
2. Cargar en Cloudflare, sin imprimir valores, `PASSWORD_PEPPER_CURRENT` aleatorio y `PASSWORD_PEPPER_LEGACY` con el valor histórico exacto. Durante este paso, el Worker anterior ignoraba los nombres nuevos.
3. Desplegar primero staging, validar health, límites sin sesión y configuración de login. Si staging tiene una cuenta local legado controlada, validar además legado → `v2$`; no crear datos remotos solo para forzar esta comprobación.
4. Con confirmación explícita del operador, desplegar producción. Completado con Worker `14f4748b-88a4-48db-aefe-174d6fe77dca`.
5. Iniciar sesión con el administrador local, confirmar rol `admin`, hash `v2$` y evento de auditoría mediante conteos/estado, nunca leyendo hash, contraseña o peppers. Completado.
6. Pedir a la otra cuenta local pendiente que inicie sesión o complete un restablecimiento. Pendiente.
7. Eliminar `PASSWORD_PEPPER_LEGACY` solo cuando `legacy_admins = 0` y `legacy_without_google = 0`. Los usuarios Google con contraseña aleatoria histórica pueden seguir usando Google y pasarán a `v2$` si completan un restablecimiento.

## Rollback

- Antes del primer rehash `v2$`: se puede restaurar la versión anterior del Worker y retirar los bindings nuevos; D1 no habrá cambiado.
- Después de cualquier rehash `v2$`: no revertir a un Worker que desconozca el prefijo. Volver a desplegar esta versión compatible, restaurar sus bindings/versiones de secretos y validar login. Si una cuenta queda sin acceso, usar el flujo de restablecimiento.
- Time Travel solo se considerará ante corrupción real y con autorización separada; no se usa para probar esta release.

El primer rehash `v2$` ya ocurrió en producción; por tanto, aplica únicamente el rollback compatible del segundo punto.

## Estado remoto

- Producción: ambos peppers están cargados por nombre y el Worker `14f4748b-88a4-48db-aefe-174d6fe77dca` está desplegado. El monitor pasó 5/5 y el login administrativo migró su hash antes de crear sesión. Queda una cuenta local sin Google en legado; `PASSWORD_PEPPER_LEGACY` no se retira todavía.
- Staging: `PASSWORD_PEPPER_CURRENT` y `PASSWORD_PEPPER_LEGACY` están cargados por nombre. El primer intento del pepper actual recibió entrada vacía porque la API criptográfica de PowerShell no estaba disponible; se sobrescribió inmediatamente con 64 bytes aleatorios generados por una API compatible antes de desplegar el código.
- Worker staging: versión `1981cf0f-965a-4942-ab3d-fc1ec0c691ae`, 158.88 KiB / 30.55 KiB gzip y startup de 7 ms.
- Contratos staging: health directo/proxy HTTP 200 y límites Worker/proxy HTTP 401. Un login sintético inexistente devolvió `401 INVALID_CREDENTIALS`, demostrando que la configuración de peppers es válida sin usar credenciales reales.
- D1 staging de solo lectura: 1 cuenta activa, 1 hash legado, 0 administradores legados y 0 cuentas legadas sin Google; cero escrituras de la consulta. No existe una cuenta administrativa local controlada para probar el rehash remoto sin crear datos artificiales. La transición administrador legado → `v2$` se mantiene cubierta por la prueba integrada.
- El HTML de Pages staging no cumple la CSP que exige el monitor productivo; los otros cuatro contratos pasan. Es una diferencia preexistente del frontend staging, no causada por el Worker ni bloqueante para el contrato de O.14.
- Publicación de código: commit `f187344`; GitHub `Verify` run `33230532161` y `Production health` run `33230686861` terminaron en `success`. Los dos checks Vercel también finalizaron en `success`. Este push no desplegó el Worker productivo.
