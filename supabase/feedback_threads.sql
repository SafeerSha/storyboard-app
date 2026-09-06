-- Create story_feedback_threads table
CREATE TABLE IF NOT EXISTS public.story_feedback_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL CHECK (section_type IN ('acceptance_criteria', 'assumption', 'clarification', 'general')),
    item_id TEXT, -- e.g. "ac-0", "assump-1", or custom UUID; NULL for general feedback
    item_text TEXT, -- snapshot of the criterion/assumption/clarification text when feedback was opened
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('client', 'freelancer')),
    created_by_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create story_feedback_messages table
CREATE TABLE IF NOT EXISTS public.story_feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.story_feedback_threads(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('client', 'freelancer')),
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for optimal querying performance
CREATE INDEX IF NOT EXISTS idx_story_feedback_threads_story_id ON public.story_feedback_threads(story_id);
CREATE INDEX IF NOT EXISTS idx_story_feedback_threads_item ON public.story_feedback_threads(story_id, section_type, item_id);
CREATE INDEX IF NOT EXISTS idx_story_feedback_messages_thread_id ON public.story_feedback_messages(thread_id);

-- Enable Row Level Security
ALTER TABLE public.story_feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_feedback_messages ENABLE ROW LEVEL SECURITY;

-- Freelancer RLS Policies (Project Owners)
CREATE POLICY "owners can manage feedback threads" ON public.story_feedback_threads FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.stories s
        JOIN public.projects p ON p.id = s.project_id
        WHERE s.id = story_feedback_threads.story_id AND p.owner_id = auth.uid()
    )
);

CREATE POLICY "owners can manage feedback messages" ON public.story_feedback_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.story_feedback_threads t
        JOIN public.stories s ON s.id = t.story_id
        JOIN public.projects p ON p.id = s.project_id
        WHERE t.id = story_feedback_messages.thread_id AND p.owner_id = auth.uid()
    )
);
