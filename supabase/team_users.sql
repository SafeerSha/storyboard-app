-- ==========================================================
-- REQly: Team Users, Team Sessions, Dual Reviews & Feedback
-- ==========================================================

-- 1. Create team_users table
CREATE TABLE IF NOT EXISTS public.team_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_users_project_id ON public.team_users(project_id);
CREATE INDEX IF NOT EXISTS idx_team_users_username ON public.team_users(username);

-- 2. Create team_sessions table
CREATE TABLE IF NOT EXISTS public.team_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_user_id UUID NOT NULL REFERENCES public.team_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_sessions_token_hash ON public.team_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_team_sessions_team_user_id ON public.team_sessions(team_user_id);

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_name TEXT,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 4. Enable Row Level Security
ALTER TABLE public.team_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4b. RLS Policies for team_users
DROP POLICY IF EXISTS "owners and super admins can manage team users" ON public.team_users;
CREATE POLICY "owners and super admins can manage team users"
  ON public.team_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = team_users.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = team_users.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- 5. Extend story_feedback_threads and story_feedback_messages constraints to support 'team_user'
DO $$
BEGIN
    ALTER TABLE public.story_feedback_threads DROP CONSTRAINT IF EXISTS story_feedback_threads_created_by_type_check;
    ALTER TABLE public.story_feedback_threads ADD CONSTRAINT story_feedback_threads_created_by_type_check 
        CHECK (created_by_type IN ('client', 'freelancer', 'team_user'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.story_feedback_messages DROP CONSTRAINT IF EXISTS story_feedback_messages_author_type_check;
    ALTER TABLE public.story_feedback_messages ADD CONSTRAINT story_feedback_messages_author_type_check 
        CHECK (author_type IN ('client', 'freelancer', 'team_user'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 6. Add dual review columns to stories
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS team_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (team_review_status IN ('pending', 'approved', 'changes_requested')),
ADD COLUMN IF NOT EXISTS team_approved_by_id UUID REFERENCES public.team_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS team_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS team_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS client_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (client_review_status IN ('pending', 'approved', 'changes_requested')),
ADD COLUMN IF NOT EXISTS client_approved_by_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS client_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;
