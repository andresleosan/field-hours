-- Attempt to resolve linter 0014 by reinstalling pg_net outside public.
-- WARNING: This will drop and recreate pg_net functions.
CREATE SCHEMA IF NOT EXISTS extensions;

DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
