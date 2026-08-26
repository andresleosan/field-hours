PRAGMA foreign_keys = ON;

-- Rollback destructivo. Ejecutar únicamente después de exportar y verificar un
-- respaldo nuevo, y con una autorización explícita adicional del operador.
DROP TABLE IF EXISTS workforce_payroll_run_lines;
DROP TABLE IF EXISTS workforce_payroll_runs;
