-- Create tool_requests table to track builder tool requests
CREATE TABLE public.tool_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.storage_tools(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'picked_up', 'delivered', 'rejected')),
  notes TEXT,
  -- Approval/pickup tracking
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  picked_up_by UUID,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.tool_requests ENABLE ROW LEVEL SECURITY;

-- Managers have full access
CREATE POLICY "Managers can manage tool requests"
ON public.tool_requests
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role));

-- Builders can view their own requests
CREATE POLICY "Builders can view own tool requests"
ON public.tool_requests
FOR SELECT
USING (requested_by = auth.uid());

-- Builders can create requests
CREATE POLICY "Builders can create tool requests"
ON public.tool_requests
FOR INSERT
WITH CHECK (requested_by = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_requests;

-- Add trigger for updated_at
CREATE TRIGGER update_tool_requests_updated_at
BEFORE UPDATE ON public.tool_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();