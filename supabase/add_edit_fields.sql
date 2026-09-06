-- Add status column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Create story_revisions table
CREATE TABLE IF NOT EXISTS public.story_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
    acceptance_criteria JSONB,
    assumptions JSONB,
    clarifications JSONB,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on story_revisions
ALTER TABLE public.story_revisions ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for story_revisions
CREATE POLICY "Freelancers can view and manage revisions for their stories"
    ON public.story_revisions
    FOR ALL
    USING (
        story_id IN (
            SELECT id FROM public.stories WHERE project_id IN (
                SELECT id FROM public.projects WHERE owner_id = auth.uid()
            )
        )
    );
