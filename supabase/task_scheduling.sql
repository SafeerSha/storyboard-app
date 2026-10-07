-- ==============================================================================
-- Task Scheduling & Recurring Tasks Migration
-- ==============================================================================

-- 1. Add due_date to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 2. Create recurring_tasks table
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    category VARCHAR(50),
    cron_expression VARCHAR(100) NOT NULL,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners and super admins can manage recurring tasks" ON public.recurring_tasks;
CREATE POLICY "owners and super admins can manage recurring tasks"
    ON public.recurring_tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = recurring_tasks.project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.freelancer_profiles fp
                    WHERE fp.id = auth.uid() AND fp.role = 'super_admin'
                )
            )
        )
    );

CREATE INDEX IF NOT EXISTS idx_recurring_tasks_project ON public.recurring_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_run ON public.recurring_tasks(next_run_at) WHERE is_active = true;
