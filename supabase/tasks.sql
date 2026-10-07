-- ==============================================================================
-- REQly: To-Do Tasks, Assignees, Story Linking, Notes & Attachments
-- ==============================================================================

-- 1. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category TEXT CHECK (category IN ('frontend', 'backend', 'fullstack', 'test')),
    due_date DATE,
    assignee_id UUID,
    assignee_type TEXT CHECK (assignee_type IN ('freelancer', 'team_user', 'client')),
    assignee_name TEXT,
    assignee_email TEXT,
    assignees JSONB DEFAULT '[]'::jsonb,
    created_by_id UUID,
    created_by_type TEXT DEFAULT 'freelancer' CHECK (created_by_type IN ('freelancer', 'team_user', 'client')),
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was already created in a previous migration run
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignees JSONB DEFAULT '[]'::jsonb;

-- 2. Create task_notes table
CREATE TABLE IF NOT EXISTS public.task_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID,
    author_type TEXT NOT NULL DEFAULT 'freelancer' CHECK (author_type IN ('freelancer', 'team_user', 'client')),
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create task_attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_key TEXT,
    file_type TEXT,
    file_size BIGINT,
    uploaded_by_id UUID,
    uploaded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Owners and super admins can manage tasks
DROP POLICY IF EXISTS "owners and super admins can manage tasks" ON public.tasks;
CREATE POLICY "owners and super admins can manage tasks"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- Owners and super admins can manage task_notes
DROP POLICY IF EXISTS "owners and super admins can manage task notes" ON public.task_notes;
CREATE POLICY "owners and super admins can manage task notes"
  ON public.task_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_notes.task_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- Owners and super admins can manage task_attachments
DROP POLICY IF EXISTS "owners and super admins can manage task attachments" ON public.task_attachments;
CREATE POLICY "owners and super admins can manage task attachments"
  ON public.task_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_attachments.task_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_attachments.task_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- 6. Relax notifications user_id foreign key constraint if it references auth.users(id)
-- so notifications can be delivered to team_users or clients
DO $$
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- 7. Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_story_id ON public.tasks(story_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON public.task_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_created_at ON public.task_notes(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
