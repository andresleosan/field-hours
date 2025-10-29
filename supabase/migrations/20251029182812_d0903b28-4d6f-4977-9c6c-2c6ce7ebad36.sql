-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('manager', 'builder');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT NOT NULL,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view projects"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Managers can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update projects"
  ON public.projects FOR UPDATE
  USING (public.has_role(auth.uid(), 'manager'));

-- Create time_tracking table
CREATE TABLE public.time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time tracking"
  ON public.time_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all time tracking"
  ON public.time_tracking FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Builders can insert own time tracking"
  ON public.time_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Builders can update own time tracking"
  ON public.time_tracking FOR UPDATE
  USING (auth.uid() = user_id);

-- Create materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view materials"
  ON public.materials FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage materials"
  ON public.materials FOR ALL
  USING (public.has_role(auth.uid(), 'manager'));

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  date DATE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view invoices"
  ON public.invoices FOR SELECT
  USING (true);

CREATE POLICY "Builders and managers can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.materials(id) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create invoice items for their invoices"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id = invoice_id AND uploaded_by = auth.uid()
    )
  );

-- Create material_usage table
CREATE TABLE public.material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.materials(id) NOT NULL,
  quantity_used DECIMAL(10, 2) NOT NULL,
  used_by UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view material usage"
  ON public.material_usage FOR SELECT
  USING (true);

CREATE POLICY "Builders can create material usage"
  ON public.material_usage FOR INSERT
  WITH CHECK (auth.uid() = used_by);

-- Create project_switches table for travel time tracking
CREATE TABLE public.project_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_project_id UUID REFERENCES public.projects(id),
  to_project_id UUID REFERENCES public.projects(id) NOT NULL,
  travel_time_minutes INTEGER NOT NULL,
  switched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.project_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project switches"
  ON public.project_switches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all project switches"
  ON public.project_switches FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Builders can create project switches"
  ON public.project_switches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add trigger to projects table
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();