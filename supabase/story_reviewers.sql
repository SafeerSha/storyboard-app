-- ==============================================================================
-- REQly: Project Team Members (Many-to-Many) & Story Reviewer Access Control
-- ==============================================================================

-- 1. Ensure role column on team_users & allow multi-project membership (drop NOT NULL on project_id)
ALTER TABLE public.team_users 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

ALTER TABLE public.team_users 
ALTER COLUMN project_id DROP NOT NULL;

-- 2. Create project_team_members table (many-to-many between projects and team_users)
CREATE TABLE IF NOT EXISTS public.project_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    team_user_id UUID NOT NULL REFERENCES public.team_users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID, -- Can reference auth.users(id)
    CONSTRAINT uq_project_team_members UNIQUE (project_id, team_user_id)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_project_team_members_project_user 
ON public.project_team_members(project_id, team_user_id);

CREATE INDEX IF NOT EXISTS idx_project_team_members_user_project 
ON public.project_team_members(team_user_id, project_id);

-- 3. Backfill project_team_members from existing legacy team_users.project_id
INSERT INTO public.project_team_members (project_id, team_user_id)
SELECT project_id, id 
FROM public.team_users 
WHERE project_id IS NOT NULL
ON CONFLICT (project_id, team_user_id) DO NOTHING;

-- 3b. Clear legacy project_id from team_users after backfill
UPDATE public.team_users SET project_id = NULL WHERE project_id IS NOT NULL;

-- 4. Add created_by_id to stories to track story author
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS created_by_id UUID;

CREATE INDEX IF NOT EXISTS idx_stories_created_by 
ON public.stories(created_by_id);

-- 5. Create / Ensure story_reviewers table with team_user_id
CREATE TABLE IF NOT EXISTS public.story_reviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    team_user_id UUID NOT NULL REFERENCES public.team_users(id) ON DELETE CASCADE,
    assigned_by UUID, -- Can reference auth.users(id) or team_users(id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT story_reviewers_story_user_unique UNIQUE (story_id, team_user_id)
);

-- Ensure team_user_id column exists if table was previously created with user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'story_reviewers' AND column_name = 'team_user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'story_reviewers' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.story_reviewers RENAME COLUMN user_id TO team_user_id;
    END IF;
  END IF;
END $$;

-- 6. Targeted Indexes for fast permission checks and joins
CREATE INDEX IF NOT EXISTS idx_story_reviewers_story_id 
ON public.story_reviewers(story_id);

CREATE INDEX IF NOT EXISTS idx_story_reviewers_team_user_id 
ON public.story_reviewers(team_user_id);

CREATE INDEX IF NOT EXISTS idx_story_reviewers_story_user 
ON public.story_reviewers(story_id, team_user_id);

CREATE INDEX IF NOT EXISTS idx_story_reviewers_user_story 
ON public.story_reviewers(team_user_id, story_id);

CREATE INDEX IF NOT EXISTS idx_story_reviewers_team_user_created
ON public.story_reviewers(team_user_id, created_at DESC);

-- 7. Enable Row Level Security
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reviewers ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for project_team_members
DROP POLICY IF EXISTS "owners and super admins can manage project team members" ON public.project_team_members;
CREATE POLICY "owners and super admins can manage project team members"
  ON public.project_team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_team_members.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_team_members.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- 9. RLS Policies for story_reviewers
DROP POLICY IF EXISTS "owners and super admins can manage story reviewers" ON public.story_reviewers;
CREATE POLICY "owners and super admins can manage story reviewers"
  ON public.story_reviewers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_reviewers.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_reviewers.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );
