-- Add epic_id column to project_notes table to link discussion and meeting notes directly to an Epic
ALTER TABLE public.project_notes
ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE;

-- Create index for fast lookups on epic-scoped notes
CREATE INDEX IF NOT EXISTS idx_project_notes_epic_id 
ON public.project_notes(epic_id);
