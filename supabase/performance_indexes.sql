-- ==============================================================================
-- StoryBoard: Supabase Free Tier Performance Indexes & RLS Optimizations
-- ==============================================================================
-- This migration provides:
-- 1. Targeted B-tree & composite indexes for foreign keys, filters, and sorts
-- 2. InitPlan subquery caching for RLS policies ((select auth.uid()), (select public.is_super_admin()))
-- 3. Optimization of public.is_super_admin() with STABLE classification
-- 4. TO authenticated scoping on sensitive tables to bypass anonymous evaluation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FOREIGN KEY & COMPOSITE QUERY INDEXES
-- ------------------------------------------------------------------------------

-- Projects: owner lookup, status filtering, and created_at ordering
CREATE INDEX IF NOT EXISTS idx_projects_owner_created 
  ON public.projects(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_status 
  ON public.projects(status);

-- Stories: project scoping, status counts, epic filtering, and creation order
CREATE INDEX IF NOT EXISTS idx_stories_project_created 
  ON public.stories(project_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_stories_project_status 
  ON public.stories(project_id, status);

CREATE INDEX IF NOT EXISTS idx_stories_epic_id 
  ON public.stories(epic_id) 
  WHERE epic_id IS NOT NULL;

-- Epics: project scoping with sort_order and created_at hierarchy
CREATE INDEX IF NOT EXISTS idx_epics_project_sort 
  ON public.epics(project_id, sort_order ASC, created_at ASC);

-- Clients: project relationship and credential verification
CREATE INDEX IF NOT EXISTS idx_clients_project_id 
  ON public.clients(project_id);

CREATE INDEX IF NOT EXISTS idx_clients_login_status 
  ON public.clients(login_id, status);

-- Sessions: token lookup with expiration validation
CREATE INDEX IF NOT EXISTS idx_client_sessions_token_expires 
  ON public.client_sessions(token_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_team_sessions_token_expires 
  ON public.team_sessions(token_hash, expires_at);

-- Comments & Revisions: story relationship and revision ordering
CREATE INDEX IF NOT EXISTS idx_story_comments_story_created 
  ON public.story_comments(story_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_story_revisions_story_rev 
  ON public.story_revisions(story_id, revision_number DESC);

-- Feedback Threads & Messages: story status checks and message sequencing
CREATE INDEX IF NOT EXISTS idx_story_feedback_threads_story_status 
  ON public.story_feedback_threads(story_id, status);

CREATE INDEX IF NOT EXISTS idx_story_feedback_messages_thread_created 
  ON public.story_feedback_messages(thread_id, created_at ASC);

-- Project Inbox Items: owner scoping with status and updated_at sorting
CREATE INDEX IF NOT EXISTS idx_project_inbox_items_owner_status_updated 
  ON public.project_inbox_items(owner_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_inbox_items_owner_priority 
  ON public.project_inbox_items(owner_id, priority DESC, updated_at DESC);

-- Share links: project token lookup
CREATE INDEX IF NOT EXISTS idx_share_links_project_id 
  ON public.share_links(project_id);

-- ------------------------------------------------------------------------------
-- 2. STABLE IS_SUPER_ADMIN FUNCTION (INITPLAN CACHABLE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.freelancer_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- 3. RLS POLICIES WITH SUBQUERY CACHING (INITPLAN) & AUTHENTICATED SCOPING
-- ------------------------------------------------------------------------------

-- freelancer_profiles
DROP POLICY IF EXISTS "users can view own profile" ON public.freelancer_profiles;
CREATE POLICY "users can view own profile" 
  ON public.freelancer_profiles 
  FOR SELECT 
  TO authenticated 
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "super_admins can view all profiles" ON public.freelancer_profiles;
CREATE POLICY "super_admins can view all profiles" 
  ON public.freelancer_profiles 
  FOR SELECT 
  TO authenticated 
  USING ((SELECT public.is_super_admin()));

-- projects
DROP POLICY IF EXISTS "owners can manage projects" ON public.projects;
DROP POLICY IF EXISTS "owners and super admins can manage projects" ON public.projects;
CREATE POLICY "owners and super admins can manage projects" 
  ON public.projects 
  FOR ALL 
  TO authenticated 
  USING (
    (SELECT auth.uid()) = owner_id 
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    (SELECT auth.uid()) = owner_id 
    OR (SELECT public.is_super_admin())
  );

-- stories
DROP POLICY IF EXISTS "owners can manage stories" ON public.stories;
DROP POLICY IF EXISTS "owners and super admins can manage stories" ON public.stories;
CREATE POLICY "owners and super admins can manage stories" 
  ON public.stories 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = stories.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = stories.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- epics
DROP POLICY IF EXISTS "Freelancers can manage epics for owned projects" ON public.epics;
CREATE POLICY "Freelancers can manage epics for owned projects" 
  ON public.epics 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = epics.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = epics.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- story_revisions
DROP POLICY IF EXISTS "owners can manage revisions" ON public.story_revisions;
DROP POLICY IF EXISTS "owners and super admins can manage revisions" ON public.story_revisions;
DROP POLICY IF EXISTS "Freelancers can view and manage revisions for their stories" ON public.story_revisions;
CREATE POLICY "owners and super admins can manage revisions" 
  ON public.story_revisions 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_revisions.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- share_links
DROP POLICY IF EXISTS "owners can manage share links" ON public.share_links;
DROP POLICY IF EXISTS "owners and super admins can manage share links" ON public.share_links;
CREATE POLICY "owners and super admins can manage share links" 
  ON public.share_links 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = share_links.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = share_links.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- clients
DROP POLICY IF EXISTS "owners can manage clients" ON public.clients;
DROP POLICY IF EXISTS "owners and super admins can manage clients" ON public.clients;
CREATE POLICY "owners and super admins can manage clients" 
  ON public.clients 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = clients.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = clients.project_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- story_comments
DROP POLICY IF EXISTS "owners can manage story comments" ON public.story_comments;
DROP POLICY IF EXISTS "owners and super admins can manage story comments" ON public.story_comments;
CREATE POLICY "owners and super admins can manage story comments" 
  ON public.story_comments 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s 
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_comments.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories s 
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_comments.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- story_feedback_threads
DROP POLICY IF EXISTS "owners can manage feedback threads" ON public.story_feedback_threads;
CREATE POLICY "owners can manage feedback threads" 
  ON public.story_feedback_threads 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = story_feedback_threads.story_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- story_feedback_messages
DROP POLICY IF EXISTS "owners can manage feedback messages" ON public.story_feedback_messages;
CREATE POLICY "owners can manage feedback messages" 
  ON public.story_feedback_messages 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.story_feedback_threads t
      JOIN public.stories s ON s.id = t.story_id
      JOIN public.projects p ON p.id = s.project_id
      WHERE t.id = story_feedback_messages.thread_id AND p.owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_super_admin())
  );

-- project_inbox_items
DROP POLICY IF EXISTS "Owners can manage inbox items" ON public.project_inbox_items;
CREATE POLICY "Owners can manage inbox items" 
  ON public.project_inbox_items 
  FOR ALL 
  TO authenticated 
  USING ((SELECT auth.uid()) = owner_id) 
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- project_inbox_links
DROP POLICY IF EXISTS "Owners can manage inbox links" ON public.project_inbox_links;
CREATE POLICY "Owners can manage inbox links" 
  ON public.project_inbox_links 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = project_inbox_links.inbox_item_id AND i.owner_id = (SELECT auth.uid())
    )
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = project_inbox_links.inbox_item_id AND i.owner_id = (SELECT auth.uid())
    )
  );

-- project_inbox_ai_threads
DROP POLICY IF EXISTS "Owners can manage ai threads" ON public.project_inbox_ai_threads;
CREATE POLICY "Owners can manage ai threads" 
  ON public.project_inbox_ai_threads 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = project_inbox_ai_threads.inbox_item_id AND i.owner_id = (SELECT auth.uid())
    )
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = project_inbox_ai_threads.inbox_item_id AND i.owner_id = (SELECT auth.uid())
    )
  );

-- project_inbox_ai_messages
DROP POLICY IF EXISTS "Owners can manage ai messages" ON public.project_inbox_ai_messages;
CREATE POLICY "Owners can manage ai messages" 
  ON public.project_inbox_ai_messages 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_ai_threads t
      JOIN public.project_inbox_items i ON i.id = t.inbox_item_id
      WHERE t.id = project_inbox_ai_messages.thread_id AND i.owner_id = (SELECT auth.uid())
    )
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_ai_threads t
      JOIN public.project_inbox_items i ON i.id = t.inbox_item_id
      WHERE t.id = project_inbox_ai_messages.thread_id AND i.owner_id = (SELECT auth.uid())
    )
  );
