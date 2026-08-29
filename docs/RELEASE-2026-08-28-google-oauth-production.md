# Cierre productivo — Google OAuth

Fecha: 28 de agosto de 2026
Estado: validado, sin despliegue ni migración

## Alcance

Confirmar que la configuración Google OAuth vigente completa tanto el flujo de solicitud no vinculada como el acceso de una identidad existente, manteniendo aprobación administrativa, auditoría y separación de roles.

## Evidencia

- Secretos requeridos presentes por nombre, sin leer sus valores.
- Tablas `workforce_google_identities`, `workforce_auth_requests` y `workforce_oauth_states` presentes en D1 productiva.
- `mode=invalid`: HTTP 400 directo y por proxy, antes de cualquier escritura.
- Cuenta no vinculada: callback correcto, solicitud `access`, rechazo desde sesión administrativa local y evento de auditoría confirmado.
- Cuenta vinculada: callback correcto, mensaje de éxito, interfaz worker y ausencia de controles admin.
- Estado final: 2 identidades, 0 pendientes, 0 estados activos y ninguna cuenta nueva.
- La sesión administrativa y la sesión Google de prueba se cerraron al terminar.

## Seguridad y datos

No se leyeron valores de secretos, contraseñas, cookies, códigos OAuth, subjects ni correos desde D1. La evidencia documental conserva solo métricas y estados. La única escritura de QA fue la solicitud OAuth iniciada por el operador y su rechazo auditado; no se aprobaron accesos ni se crearon trabajadores.

## Reversión

No hay release que revertir: no se cambió código, Worker, Vercel, secretos, esquema o configuración Google. La solicitud de prueba quedó cerrada como rechazada y no dejó estados activos. No ejecutar el rollback destructivo de `0004_google_auth.sql` para revertir una prueba.
