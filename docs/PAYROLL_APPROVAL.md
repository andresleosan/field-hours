# Payroll approval workflow

Fecha de implementación local: 23 de agosto de 2026

## Alcance

La nómina calculada deja de ser solo un preview y pasa a tener un snapshot por periodo. El flujo es:

1. `pending_review`: el administrador envía el preview actual para revisión.
2. `approved`: el administrador aprueba el snapshot y queda marcado como `Payment ready`.
3. `changes_requested`: el administrador devuelve el periodo con una nota; se puede corregir y reenviar.

La aprobación bloquea el periodo, pero no ejecuta transferencias bancarias ni integra un proveedor de pagos.

## Modelo de datos

- `workforce_payroll_runs`: periodo, fecha de pago, estado, totales en peniques y datos de revisión.
- `workforce_payroll_run_lines`: snapshot normalizado de cada trabajador, horas, tarifa, deducciones, totales y advertencias.
- Los nombres y correos se copian al snapshot para que una edición posterior del perfil no modifique una nómina ya revisada.
- Los cambios de estado se registran en `workforce_audit_events` con el identificador de la nómina; no se guardan importes ni identificadores fiscales en el metadata de auditoría.

Migración: `cloudflare/migrations/0008_payroll_runs.sql`.

## Contrato de API

- `GET /api/admin/payroll-runs`: lista las últimas nóminas de la organización autenticada.
- `POST /api/admin/payroll-runs`: recalcula y guarda el preview como `pending_review`. Rechaza periodos sin trabajadores o con perfiles incompletos/no aprobados.
- `POST /api/admin/payroll-runs/:id/review`: recibe `decision` (`approved` o `changes_requested`) y una nota cuando se solicitan cambios.

Las rutas de escritura requieren sesión administrativa, origen permitido y CSRF válido. Una nómina aprobada no puede sobrescribirse ni volver a revisarse.

### Nómina personalizada por horas

El administrador puede preparar el mismo snapshot para un único trabajador indicando las horas,
sin volver a introducir datos ya guardados:

```json
{
  "custom": {
    "userId": "worker-user-id",
    "hours": 40
  }
}
```

- `hours` admite de `0.01` a `744`, con un máximo de dos decimales.
- El servidor exige que el trabajador esté activo en la organización y tenga su perfil salarial
  aprobado.
- La tarifa, ITIS, Social Security, fecha de pago y datos del negocio se toman de la configuración
  y del perfil guardados; el navegador no suministra ni recalcula esos valores.
- El run conserva el límite de un snapshot por periodo. Un snapshot aprobado sigue bloqueado; uno
  pendiente puede reemplazarse intencionalmente con el nuevo cálculo.
- La auditoría registra modo, trabajador y horas, sin importes ni referencias fiscales.

El cuerpo vacío conserva el cálculo automático desde las jornadas registradas. No se añadió una
ruta de pago ni una transferencia bancaria.

## Rollback

No aplicar la migración en producción sin backup verificado y confirmación explícita del operador. El rollback manual, después del backup, es:

```sql
DROP TABLE workforce_payroll_run_lines;
DROP TABLE workforce_payroll_runs;
```

La operación elimina únicamente snapshots de nómina; no modifica turnos, perfiles, configuración ni eventos de auditoría. Debe ejecutarse con el Worker detenido o sin tráfico de nómina para evitar errores de integridad.

## Estado

Implementado localmente y con dry-run de Wrangler correcto. Backup previo a `0008` verificado en `cloudflare/backups/field-hours-prod-pre-0008-20260824.sql` (48,907 bytes; SHA-256 `7F1E2302E499E4EA270A76C611D6C1688B45D38C58ACF8F87E486F269D223486`). La migración no se ha aplicado a producción porque falta el reporte E2E limpio requerido para una app web Nivel 2/3.
