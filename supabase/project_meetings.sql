-- ==============================================================================
-- REQly: Project Meeting Scheduling & Timeline Audit Migration
-- ==============================================================================

-- 1. Create project_meetings table
CREATE TABLE IF NOT EXISTS public.project_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    agenda TEXT NOT NULL,
    meeting_type TEXT NOT NULL CHECK (meeting_type IN ('demo', 'planning', 'discussion')),
    platform TEXT NOT NULL CHECK (platform IN ('whatsapp_call', 'teams', 'google_meet', 'zoom')),
    meeting_url TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    invitation_message TEXT,
    internal_note TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    cancellation_reason TEXT,
    last_shared_at TIMESTAMPTZ,
    last_shared_channel TEXT CHECK (last_shared_channel IN ('whatsapp', 'email', 'clipboard')),
    created_by_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_by_type TEXT NOT NULL DEFAULT 'freelancer' CHECK (created_by_type IN ('freelancer', 'team_user', 'client', 'super_admin')),
    updated_by_id TEXT,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_meeting_end_after_start CHECK (end_at > start_at)
);

-- 2. Create project_meeting_events table (Audit & Change Timeline)
CREATE TABLE IF NOT EXISTS public.project_meeting_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.project_meetings(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'created',
        'updated',
        'rescheduled',
        'platform_changed',
        'completed',
        'cancelled',
        'note_updated',
        'shared_whatsapp',
        'shared_email',
        'copied_invitation'
    )),
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast filtering and chronological queries
CREATE INDEX IF NOT EXISTS idx_project_meetings_project_id ON public.project_meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_start_at ON public.project_meetings(start_at);
CREATE INDEX IF NOT EXISTS idx_project_meetings_status ON public.project_meetings(status);
CREATE INDEX IF NOT EXISTS idx_project_meetings_meeting_type ON public.project_meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_project_meetings_platform ON public.project_meetings(platform);

CREATE INDEX IF NOT EXISTS idx_project_meeting_events_meeting_id ON public.project_meeting_events(meeting_id);
CREATE INDEX IF NOT EXISTS idx_project_meeting_events_project_id ON public.project_meeting_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_meeting_events_created_at ON public.project_meeting_events(created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.project_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_meeting_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies for server-side admin client
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role access project_meetings" ON public.project_meetings;
    DROP POLICY IF EXISTS "Service role access project_meeting_events" ON public.project_meeting_events;
    
    CREATE POLICY "Service role access project_meetings"
        ON public.project_meetings
        FOR ALL
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Service role access project_meeting_events"
        ON public.project_meeting_events
        FOR ALL
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
