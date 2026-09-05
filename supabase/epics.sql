-- Create the epics table
CREATE TABLE IF NOT EXISTS public.epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index
CREATE INDEX IF NOT EXISTS epics_project_id_idx ON public.epics(project_id);

-- Enable RLS
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for epics
-- Freelancer can manage epics for their own projects
CREATE POLICY "Freelancers can manage epics for owned projects"
    ON public.epics
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        )
    );

-- Alter stories table to add epic_id
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL;
