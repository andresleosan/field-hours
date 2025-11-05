-- Fix Security Issue #1: Replace hardcoded manager password with invite-only system
-- Create pending_invitations table for secure manager signup
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role app_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS on pending_invitations
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Managers can create invitations
CREATE POLICY "Managers can create invitations"
ON public.pending_invitations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'));

-- Managers can view all invitations
CREATE POLICY "Managers can view all invitations"
ON public.pending_invitations
FOR SELECT
USING (has_role(auth.uid(), 'manager'));

-- Anyone can check if their email has a pending invitation (for signup validation)
CREATE POLICY "Users can check own invitation"
ON public.pending_invitations
FOR SELECT
USING (email = auth.email());

-- Managers can delete expired or used invitations
CREATE POLICY "Managers can delete invitations"
ON public.pending_invitations
FOR DELETE
USING (has_role(auth.uid(), 'manager'));

-- Function to validate invitation during signup
CREATE OR REPLACE FUNCTION public.validate_invitation(user_email text, user_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Builders don't need invitations
  IF user_role = 'builder' THEN
    RETURN true;
  END IF;
  
  -- Managers need valid, non-expired invitations
  RETURN EXISTS (
    SELECT 1
    FROM public.pending_invitations
    WHERE email = user_email
      AND role = user_role
      AND expires_at > now()
  );
END;
$$;

-- Fix Security Issue #2: Restrict invoice storage bucket access
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view all invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own invoices" ON storage.objects;

-- Create properly scoped policies for invoice bucket
-- Policy 1: Users can upload their own invoices
CREATE POLICY "Users can upload own invoices"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.uid() = owner
);

-- Policy 2: Users can view only their own uploaded invoices
CREATE POLICY "Users can view own invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices'
  AND auth.uid() = owner
);

-- Policy 3: Managers can view all invoices
CREATE POLICY "Managers can view all invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices'
  AND has_role(auth.uid(), 'manager')
);

-- Policy 4: Users can update their own invoices
CREATE POLICY "Users can update own invoices"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'invoices'
  AND auth.uid() = owner
);

-- Policy 5: Users can delete their own invoices
CREATE POLICY "Users can delete own invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices'
  AND auth.uid() = owner
);

-- Policy 6: Managers can delete any invoices
CREATE POLICY "Managers can delete all invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices'
  AND has_role(auth.uid(), 'manager')
);