-- =================================================================
-- 1. ADD EMAIL TO CLIENTS TABLE & ASSIGN AMAL'S EMAIL
-- =================================================================
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update Amal's email address
UPDATE public.clients
SET email = 'amajobm@gmail.com'
WHERE name ILIKE '%Amal%' OR login_id = '713272';

-- =================================================================
-- 2. CREATE REMUNERATION ESTIMATES TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS public.remuneration_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hourly_rate NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    contingency_percentage NUMERIC NOT NULL DEFAULT 0,
    ai_total_hours NUMERIC NOT NULL DEFAULT 0,
    final_total_hours NUMERIC NOT NULL DEFAULT 0,
    base_amount NUMERIC NOT NULL DEFAULT 0,
    contingency_amount NUMERIC NOT NULL DEFAULT 0,
    final_amount NUMERIC NOT NULL DEFAULT 0,
    project_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- 3. CREATE REMUNERATION STORY ESTIMATES TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS public.remuneration_story_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_estimate_id UUID NOT NULL REFERENCES public.remuneration_estimates(id) ON DELETE CASCADE,
    epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
    story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
    story_title TEXT NOT NULL,
    epic_name TEXT NOT NULL,
    complexity TEXT,
    ai_estimated_hours NUMERIC NOT NULL DEFAULT 0,
    final_hours NUMERIC NOT NULL DEFAULT 0,
    frontend_hours NUMERIC NOT NULL DEFAULT 0,
    backend_hours NUMERIC NOT NULL DEFAULT 0,
    database_hours NUMERIC NOT NULL DEFAULT 0,
    integration_hours NUMERIC NOT NULL DEFAULT 0,
    testing_hours NUMERIC NOT NULL DEFAULT 0,
    confidence TEXT,
    reasoning TEXT,
    assumptions JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- 4. PERFORMANCE INDEXES
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_remuneration_estimates_project_id 
    ON public.remuneration_estimates(project_id);

CREATE INDEX IF NOT EXISTS idx_remuneration_estimates_created_by 
    ON public.remuneration_estimates(created_by);

CREATE INDEX IF NOT EXISTS idx_remuneration_story_estimates_estimate_id 
    ON public.remuneration_story_estimates(remuneration_estimate_id);

CREATE INDEX IF NOT EXISTS idx_clients_email 
    ON public.clients(email);

-- =================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================
ALTER TABLE public.remuneration_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_story_estimates ENABLE ROW LEVEL SECURITY;

-- Allow project owners and super admins full access to remuneration estimates
CREATE POLICY "owners and super admins can manage remuneration estimates"
    ON public.remuneration_estimates
    FOR ALL
    USING (
        auth.uid() = created_by 
        OR EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = remuneration_estimates.project_id AND p.owner_id = auth.uid()
        )
        OR public.is_super_admin()
    )
    WITH CHECK (
        auth.uid() = created_by 
        OR EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = remuneration_estimates.project_id AND p.owner_id = auth.uid()
        )
        OR public.is_super_admin()
    );

-- Allow project owners and super admins full access to story estimates
CREATE POLICY "owners and super admins can manage story estimates"
    ON public.remuneration_story_estimates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remuneration_estimates re
            JOIN public.projects p ON p.id = re.project_id
            WHERE re.id = remuneration_story_estimates.remuneration_estimate_id
            AND (p.owner_id = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.remuneration_estimates re
            JOIN public.projects p ON p.id = re.project_id
            WHERE re.id = remuneration_story_estimates.remuneration_estimate_id
            AND (p.owner_id = auth.uid() OR public.is_super_admin())
        )
    );
