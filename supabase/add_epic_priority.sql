-- ==========================================================
-- StoryBoard: Epic Priority Management Migration
-- ==========================================================

-- 1. Add priority column to epics table
ALTER TABLE public.epics 
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' 
CHECK (priority IN ('low', 'medium', 'high'));

-- 2. Index for filtering and ordering by priority
CREATE INDEX IF NOT EXISTS idx_epics_priority ON public.epics(priority);

-- 3. Composite index for project-scoped priority queries
CREATE INDEX IF NOT EXISTS idx_epics_project_priority ON public.epics(project_id, priority);
