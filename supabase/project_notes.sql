-- Project Notes Schema & Policies
-- Allows recording discussion / meeting notes and converting them into epics and stories.

CREATE TABLE IF NOT EXISTS public.project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Note',
    content TEXT NOT NULL DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'archived')),
    converted_epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    created_by_id TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_status ON public.project_notes(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_notes_created_at ON public.project_notes(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Freelancers (project owners) can manage notes for their own projects
CREATE POLICY "owners can manage project notes" ON public.project_notes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_notes.project_id AND p.owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_notes.project_id AND p.owner_id = auth.uid()
    )
);
