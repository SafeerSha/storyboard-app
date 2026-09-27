-- Add is_client_visible column to project_notes table to control whether mapped clients can view notes in their portal
ALTER TABLE public.project_notes
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN NOT NULL DEFAULT false;

-- Create index for fast lookups on client-visible notes
CREATE INDEX IF NOT EXISTS idx_project_notes_client_visible 
ON public.project_notes(project_id, is_client_visible);
