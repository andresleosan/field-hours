-- Create storage materials table for consumables in main storage
CREATE TABLE public.storage_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  section TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  min_stock_level NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage tools table for trackable tools
CREATE TABLE public.storage_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  section TEXT,
  serial_number TEXT,
  condition TEXT DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tool checkouts table for tracking borrowed tools
CREATE TABLE public.tool_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id UUID NOT NULL REFERENCES public.storage_tools(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  checked_out_by UUID NOT NULL,
  checked_out_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_return_date DATE,
  returned_at TIMESTAMP WITH TIME ZONE,
  returned_by UUID,
  condition_on_return TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create material transfers table for tracking materials moved to projects
CREATE TABLE public.material_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_material_id UUID NOT NULL REFERENCES public.storage_materials(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  transferred_by UUID NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.storage_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;

-- Storage Materials Policies
CREATE POLICY "Everyone can view storage materials"
ON public.storage_materials FOR SELECT
USING (true);

CREATE POLICY "Managers can manage storage materials"
ON public.storage_materials FOR ALL
USING (has_role(auth.uid(), 'manager'));

-- Storage Tools Policies
CREATE POLICY "Everyone can view storage tools"
ON public.storage_tools FOR SELECT
USING (true);

CREATE POLICY "Managers can manage storage tools"
ON public.storage_tools FOR ALL
USING (has_role(auth.uid(), 'manager'));

-- Tool Checkouts Policies
CREATE POLICY "Everyone can view tool checkouts"
ON public.tool_checkouts FOR SELECT
USING (true);

CREATE POLICY "Builders can checkout tools"
ON public.tool_checkouts FOR INSERT
WITH CHECK (auth.uid() = checked_out_by);

CREATE POLICY "Managers can manage tool checkouts"
ON public.tool_checkouts FOR ALL
USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can return their checkouts"
ON public.tool_checkouts FOR UPDATE
USING (auth.uid() = checked_out_by);

-- Material Transfers Policies
CREATE POLICY "Everyone can view material transfers"
ON public.material_transfers FOR SELECT
USING (true);

CREATE POLICY "Builders can transfer materials"
ON public.material_transfers FOR INSERT
WITH CHECK (auth.uid() = transferred_by);

CREATE POLICY "Managers can manage material transfers"
ON public.material_transfers FOR ALL
USING (has_role(auth.uid(), 'manager'));

-- Add triggers for updated_at
CREATE TRIGGER update_storage_materials_updated_at
BEFORE UPDATE ON public.storage_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storage_tools_updated_at
BEFORE UPDATE ON public.storage_tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tool checkouts (for real-time tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_checkouts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.storage_tools;