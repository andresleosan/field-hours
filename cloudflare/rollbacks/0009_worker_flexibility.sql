PRAGMA foreign_keys = ON;

-- Precondiciones obligatorias antes de ejecutar este rollback en producción:
-- 1. Revertir primero el Worker para impedir nuevos turnos múltiples.
-- 2. La consulta siguiente debe devolver cero filas. Si devuelve alguna, detenerse
--    y reconciliar esos turnos con autorización explícita del operador.
--
-- SELECT organization_id, user_id, work_date, COUNT(*) AS shift_count
-- FROM workforce_shifts
-- WHERE work_date IS NOT NULL
-- GROUP BY organization_id, user_id, work_date
-- HAVING COUNT(*) > 1;

DROP INDEX IF EXISTS workforce_shifts_org_user_date_idx;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_shift_per_worker_day
  ON workforce_shifts (organization_id, user_id, work_date)
  WHERE work_date IS NOT NULL;

-- `description` se conserva: retirar una columna requiere reconstruir la tabla
-- en SQLite y no es necesario para que la versión anterior de la app funcione.
