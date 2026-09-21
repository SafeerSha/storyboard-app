-- Add images JSONB column to project_notes table to store discussion note attachments
ALTER TABLE public.project_notes
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Optional GIN index for querying image attachments if needed
CREATE INDEX IF NOT EXISTS idx_project_notes_images ON public.project_notes USING gin(images);
