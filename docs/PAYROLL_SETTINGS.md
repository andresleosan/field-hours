# Configuración de nómina

La configuración pertenece a una organización y se guarda en `workforce_payroll_settings`.

## Contrato administrativo

- `GET /api/admin/payroll-settings`: devuelve la configuración visible para el administrador o `null` si aún no existe.
- `POST /api/admin/payroll-settings`: guarda la configuración; requiere sesión de admin, origen permitido y `X-CSRF-Token` válido.

El cuerpo de escritura contiene:

```json
{
  "hourlyRate": 12.5,
  "payFrequency": "monthly",
  "payDay": 1,
  "businessName": "Libertys - Quayside Kitchen",
  "businessAddress": "Jersey",
  "businessTaxReference": "optional",
  "businessSocialReference": "optional",
  "workerSocialSecurityRate": 6,
  "employerSocialSecurityRate": 6.5
}
```

La tarifa se persiste en peniques y los porcentajes en puntos básicos. El día de pago se limita a 1–28 para que sea válido en todos los meses. Las referencias fiscales del negocio se cifran con la clave existente `PAYROLL_ENCRYPTION_KEY`; la respuesta nunca devuelve sus valores completos. Los campos opcionales en blanco conservan el valor cifrado existente.

Cada actualización registra `payroll.settings.updated` en la auditoría sin incluir referencias fiscales ni otros secretos. El resumen del trabajador utiliza el día configurado para calcular el inicio del periodo y la próxima fecha de pago; si no existe configuración, mantiene el valor seguro por defecto del día 1.

## Migración y rollback

- Migración: `cloudflare/migrations/0007_payroll_settings.sql`.
- Antes de aplicarla en producción se debe crear y verificar un backup D1 reciente.
- Rollback manual, solo con aprobación explícita y después de verificar el backup:

```sql
DROP INDEX IF EXISTS workforce_payroll_settings_updated_idx;
DROP TABLE workforce_payroll_settings;
```

El rollback elimina únicamente la configuración de nómina de la organización; no modifica perfiles de trabajadores ni turnos.

