-- Fix function search_path for security
-- The update_updated_at_column function needs a fixed search_path to prevent SQL injection attacks
-- Use CREATE OR REPLACE to avoid dropping dependent triggers

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;