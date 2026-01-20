-- Add returned tracking columns to tool_requests
ALTER TABLE public.tool_requests 
ADD COLUMN IF NOT EXISTS returned_by uuid,
ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;