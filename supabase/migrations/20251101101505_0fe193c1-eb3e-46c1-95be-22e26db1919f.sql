-- Fix profiles table privacy - restrict phone number access
-- Current issue: All authenticated users can view all profiles including phone numbers
-- Fix: Users can only view their own profile, managers can view all profiles

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT 
USING (auth.uid() = id);

-- Managers can view all profiles (for contact/management purposes)
CREATE POLICY "Managers can view all profiles" ON public.profiles
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));