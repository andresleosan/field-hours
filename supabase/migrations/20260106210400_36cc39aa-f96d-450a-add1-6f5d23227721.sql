-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can validate invitation codes" ON public.invitations;

-- The validate_invitation_code function already handles this securely via SECURITY DEFINER
-- No need for anon SELECT access since the function bypasses RLS