-- ============================================================================
-- REQly: Shared Epic -> Story Navigation Performance Indexes
-- Supabase Free Tier Optimization: Zero table scans on Epic & Story ordering
-- ============================================================================

-- 1. Index on epics for fast created_at DESC ordering per project
CREATE INDEX IF NOT EXISTS epics_project_created_at_idx 
  ON public.epics(project_id, created_at DESC);

-- 2. Composite index on stories for filtering by project & epic with updated_at DESC ordering
CREATE INDEX IF NOT EXISTS stories_project_epic_updated_at_idx 
  ON public.stories(project_id, epic_id, updated_at DESC);

-- 3. Composite index on stories for project-level updated_at DESC ordering
CREATE INDEX IF NOT EXISTS stories_project_updated_at_idx 
  ON public.stories(project_id, updated_at DESC);
