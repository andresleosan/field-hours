-- Create invitations table for QR code system
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  role app_role NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_used BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only managers can create invitations
CREATE POLICY "Managers can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Managers can view all invitations they created
CREATE POLICY "Managers can view their invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid());

-- Managers can update invitations they created
CREATE POLICY "Managers can update their invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid());

-- Public can view invitation to validate during signup (but only code, role, expires_at, is_used)
CREATE POLICY "Anyone can validate invitation codes"
ON public.invitations
FOR SELECT
TO anon
USING (true);

-- Create function to validate invitation during signup
CREATE OR REPLACE FUNCTION public.validate_invitation_code(invitation_code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  role app_role,
  invitation_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO inv FROM public.invitations WHERE code = invitation_code;
  
  IF inv IS NULL THEN
    RETURN QUERY SELECT false, NULL::app_role, NULL::UUID, 'Invalid invitation code'::TEXT;
    RETURN;
  END IF;
  
  IF inv.is_used THEN
    RETURN QUERY SELECT false, NULL::app_role, NULL::UUID, 'This invitation has already been used'::TEXT;
    RETURN;
  END IF;
  
  IF inv.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::app_role, NULL::UUID, 'This invitation has expired'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, inv.role, inv.id, NULL::TEXT;
END;
$$;

-- Create function to mark invitation as used
CREATE OR REPLACE FUNCTION public.use_invitation(invitation_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invitations
  SET is_used = true, used_at = now(), used_by = user_id
  WHERE id = invitation_id AND is_used = false AND expires_at > now();
  
  RETURN FOUND;
END;
$$;