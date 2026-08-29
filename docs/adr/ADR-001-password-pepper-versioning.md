# ADR-001: Versionado y rotación segura del pepper de contraseñas

Fecha: 2026-08-28
Estado: aceptada

## Contexto

Los hashes locales existentes fueron derivados con un pepper fijo incluido históricamente en el código. Sustituirlo directamente por un secreto nuevo invalidaría todas las contraseñas, incluida la cuenta administrativa local que no depende de Google. Mantener el valor en el repositorio tampoco es aceptable.

## Decisión

Los hashes nuevos se almacenan como `v2$<hash-hexadecimal>` y usan exclusivamente el secreto obligatorio `PASSWORD_PEPPER_CURRENT`. Los hashes históricos sin prefijo se consideran `legacy` y solo pueden verificarse durante la transición con `PASSWORD_PEPPER_LEGACY`, suministrado como secreto del Worker.

Después de un inicio de sesión legado correcto, el Worker vuelve a derivar la contraseña con el pepper actual, guarda un hash `v2$` mediante una actualización condicional y registra el evento `account.password.pepper_upgraded`. Registro, cambio de contraseña, restablecimiento y altas mediante Google escriben directamente `v2$`.

El código nunca contiene un pepper de respaldo. Si falta o es inválido `PASSWORD_PEPPER_CURRENT`, las operaciones de contraseña fallan con `503 AUTH_NOT_CONFIGURED`. Si el hash es legado y ya no existe `PASSWORD_PEPPER_LEGACY`, la autenticación falla como credencial inválida sin revelar si la cuenta existe.

## Protocolo de promoción

1. Verificar pruebas, dry-run del Worker, Time Travel D1 vigente y plan de rollback.
2. Crear `PASSWORD_PEPPER_CURRENT` y `PASSWORD_PEPPER_LEGACY` como secretos en staging y producción antes del despliegue. El Worker anterior ignora ambos nombres, por lo que esta preparación no cambia la autenticación activa.
3. Desplegar el Worker compatible y comprobar salud y límites de autenticación.
4. Iniciar sesión con la cuenta administrativa local. Confirmar que conserva rol `admin` y que su hash pasó a `v2$`, sin consultar ni registrar contraseña, hash o pepper.
5. Consultar únicamente conteos agregados de hashes legados. Los usuarios locales pendientes deben iniciar sesión o completar un restablecimiento.
6. Eliminar `PASSWORD_PEPPER_LEGACY` solo cuando no queden cuentas locales que dependan de hashes sin prefijo. Mantener `PASSWORD_PEPPER_CURRENT`.

## Alternativas consideradas

- Reemplazar el pepper en una sola operación: descartado porque bloquea todas las cuentas existentes.
- Conservar indefinidamente el fallback versionado: descartado porque un valor público no aporta la defensa esperada frente a una filtración de hashes.
- Reescribir hashes directamente en D1: descartado porque no se puede derivar un hash nuevo sin conocer la contraseña en texto claro.
- Añadir una columna de versión: descartado por ahora; el prefijo cabe en la columna `TEXT` existente y evita una migración de esquema innecesaria.

## Consecuencias

- La transición mantiene disponible el acceso local y permite migración gradual al iniciar sesión.
- Durante la ventana de transición, las cuentas no migradas siguen dependiendo de un pepper históricamente público; la ventana debe ser corta y medible.
- Tras el primer rehash `v2$`, no es seguro revertir a una versión antigua del Worker que desconozca el prefijo. El rollback debe usar esta versión compatible, restaurar sus bindings o completar un restablecimiento de contraseña; nunca volver al fallback histórico.
- No hay migración de esquema. Las únicas escrituras productivas son rehashes condicionados por un inicio de sesión válido y su evento de auditoría.
