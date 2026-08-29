# Release 2026-08-28 — fusión reversible de cuenta trabajadora duplicada

Estado: código y operación preparados; producción pendiente de autorización explícita.

## Objetivo

Conservar activa la cuenta de Flávia vinculada con Google, transferirle el historial operativo de la cuenta local duplicada y desactivar la cuenta local sin borrar usuarios, turnos, eventos, auditorías ni snapshots financieros.

## Diagnóstico productivo de solo lectura

- ambas cuentas están activas en la misma organización, con rol `worker` y el mismo nombre visible;
- la cuenta local tiene 3 turnos completos y 12 eventos; no tiene Google, perfil de nómina, snapshot financiero, sesión ni solicitud de restablecimiento;
- la cuenta Google tiene 3 turnos completos y 10 eventos;
- no existen colisiones de turnos abiertos, claves de idempotencia, perfiles de nómina ni líneas de payroll;
- las referencias secundarias de la cuenta local están en cero;
- todas las consultas reportaron `rows_written: 0` y `changed_db: false`.

## Cambio de aplicación

Las consultas de detalle/listado de perfiles y preview de nómina ahora unen únicamente usuarios con `disabled_at IS NULL`. Esto evita que una cuenta histórica desactivada siga apareciendo o intervenga en el cálculo, conservando su membresía para un rollback exacto.

## Operación de datos

La importación SQL remota se ejecuta como una transacción y contiene guardas que abortan si cambió cualquier precondición. La operación:

1. confirma ambas identidades, organización, roles, vínculo Google y conteos exactos;
2. reasigna únicamente los 3 turnos completos desde la cuenta local a la cuenta Google;
3. conserva sin modificaciones los 12 eventos append-only y su autor histórico; métricas e historial continúan relacionándolos mediante `shift_id`;
4. establece `disabled_at` en la cuenta local;
5. registra `account.worker_account_merged` con los IDs exactos de los turnos necesarios para rollback;
6. verifica dentro de la misma transacción que la cuenta Google quedó activa con 6 turnos y 22 eventos asociados por turno.

No se elimina ninguna cuenta, membresía, sesión activa de la cuenta Google, turno, evento, perfil ni registro financiero.

## Evidencia

- prueba Worker específica: cuentas desactivadas excluidas de perfiles y preview de nómina;
- `npm.cmd run test:worker`: 14/14;
- `npm.cmd run verify`: typechecks, lint, build, SheetJS, Worker 14/14, operaciones, D1 recovery, Playwright 16/16 y audit 0;
- ensayo D1 local aislado sobre migraciones `0001`–`0009`:
  - fusión: cuenta Google activa con 6 turnos y cuenta local desactivada con 0;
  - rollback: ambas cuentas activas con 3 turnos cada una y 0 diferencias evento/propietario;
- dry-run del Worker: 158.96 KiB / 30.55 KiB gzip.

## Rollback

Rollback primario, probado en D1 local:

1. leer el evento inmutable `account.worker_account_merged`;
2. obtener de su metadata la cuenta origen y los tres `shiftIds` exactos;
3. reasignar únicamente esos turnos a la cuenta local;
4. restaurar `disabled_at = NULL`;
5. registrar `account.worker_account_merge_rolled_back`;
6. exigir como postcondición 3 turnos por cuenta y cero diferencias entre propietario de turno y autor histórico del evento.

Si hubiera corrupción ajena a estas filas, Time Travel puede restaurar el bookmark previo, pero es destructivo y requiere una autorización separada. Después de la fusión se conserva el SQL local de rollback hasta cerrar la validación productiva.
