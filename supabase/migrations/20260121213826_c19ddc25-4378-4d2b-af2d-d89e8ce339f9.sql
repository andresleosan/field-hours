-- Allow 'returned' status in tool_requests
ALTER TABLE public.tool_requests
  DROP CONSTRAINT IF EXISTS tool_requests_status_check;

ALTER TABLE public.tool_requests
  ADD CONSTRAINT tool_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'approved'::text,
    'picked_up'::text,
    'delivered'::text,
    'returned'::text,
    'rejected'::text
  ]));
