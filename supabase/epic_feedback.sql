-- ==============================================================================
-- REQly: Epic Discussions Schema
-- ==============================================================================

-- Create epic_feedback_threads table
CREATE TABLE IF NOT EXISTS public.epic_feedback_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('client', 'admin', 'team_user')),
    created_by_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create epic_feedback_messages table
CREATE TABLE IF NOT EXISTS public.epic_feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.epic_feedback_threads(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('client', 'admin', 'team_user')),
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for optimal querying performance
CREATE INDEX IF NOT EXISTS idx_epic_feedback_threads_epic_id ON public.epic_feedback_threads(epic_id);
CREATE INDEX IF NOT EXISTS idx_epic_feedback_messages_thread_id ON public.epic_feedback_messages(thread_id);

-- Enable Row Level Security
ALTER TABLE public.epic_feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epic_feedback_messages ENABLE ROW LEVEL SECURITY;

-- Admins (Project Owners) RLS Policies
CREATE POLICY "admins can manage epic feedback threads" ON public.epic_feedback_threads FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epics e
        JOIN public.projects p ON e.project_id = p.id
        WHERE e.id = epic_feedback_threads.epic_id
        AND p.owner_id = (SELECT auth.uid())
    )
);

CREATE POLICY "admins can manage epic feedback messages" ON public.epic_feedback_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epic_feedback_threads t
        JOIN public.epics e ON t.epic_id = e.id
        JOIN public.projects p ON e.project_id = p.id
        WHERE t.id = epic_feedback_messages.thread_id
        AND p.owner_id = (SELECT auth.uid())
    )
);

-- Team Users RLS Policies
CREATE POLICY "team users can manage epic feedback threads" ON public.epic_feedback_threads FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epics e
        JOIN public.team_users tu ON e.project_id = tu.project_id
        WHERE e.id = epic_feedback_threads.epic_id
        AND tu.id = (SELECT auth.uid())
    )
);

CREATE POLICY "team users can manage epic feedback messages" ON public.epic_feedback_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epic_feedback_threads t
        JOIN public.epics e ON t.epic_id = e.id
        JOIN public.team_users tu ON e.project_id = tu.project_id
        WHERE t.id = epic_feedback_messages.thread_id
        AND tu.id = (SELECT auth.uid())
    )
);

-- Clients RLS Policies
CREATE POLICY "clients can manage epic feedback threads" ON public.epic_feedback_threads FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epics e
        JOIN public.clients c ON e.project_id = c.project_id
        WHERE e.id = epic_feedback_threads.epic_id
        AND c.id = (SELECT auth.uid())
    )
);

CREATE POLICY "clients can manage epic feedback messages" ON public.epic_feedback_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.epic_feedback_threads t
        JOIN public.epics e ON t.epic_id = e.id
        JOIN public.clients c ON e.project_id = c.project_id
        WHERE t.id = epic_feedback_messages.thread_id
        AND c.id = (SELECT auth.uid())
    )
);
