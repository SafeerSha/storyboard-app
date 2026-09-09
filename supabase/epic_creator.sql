-- Add created_by_id to epics table
ALTER TABLE public.epics
ADD COLUMN IF NOT EXISTS created_by_id UUID;

CREATE INDEX IF NOT EXISTS idx_epics_created_by ON public.epics(created_by_id);
