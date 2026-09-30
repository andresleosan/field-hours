-- Rollback solo si no hay dos filas aprobadas/rechazadas del mismo email y tipo:
-- SELECT email, request_type, status, COUNT(*) FROM workforce_auth_requests
-- GROUP BY email, request_type, status HAVING COUNT(*) > 1;
-- Mientras tanto, el índice parcial es compatible con el Worker anterior; no hace falta revertir.
DROP INDEX IF EXISTS workforce_auth_requests_one_pending;
