-- Create risk_assessments table for storing PDF documents per project
CREATE TABLE public.risk_assessments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    pdf_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risk_assessment_signatures table for tracking builder agreements
CREATE TABLE public.risk_assessment_signatures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    risk_assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (risk_assessment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessment_signatures ENABLE ROW LEVEL SECURITY;

-- Policies for risk_assessments
CREATE POLICY "Everyone can view risk assessments"
ON public.risk_assessments FOR SELECT
USING (true);

CREATE POLICY "Managers can create risk assessments"
ON public.risk_assessments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete risk assessments"
ON public.risk_assessments FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Policies for signatures
CREATE POLICY "Everyone can view signatures"
ON public.risk_assessment_signatures FOR SELECT
USING (true);

CREATE POLICY "Users can sign risk assessments"
ON public.risk_assessment_signatures FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for risk assessment PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('risk-assessments', 'risk-assessments', true);

-- Storage policies
CREATE POLICY "Anyone can view risk assessment PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'risk-assessments');

CREATE POLICY "Managers can upload risk assessment PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'risk-assessments' AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete risk assessment PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'risk-assessments' AND has_role(auth.uid(), 'manager'::app_role));