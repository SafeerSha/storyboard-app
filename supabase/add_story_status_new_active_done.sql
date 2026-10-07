-- ==============================================================================
-- REQly: Story Lifecycle Status (New, Active, Done)
-- ==============================================================================

-- 1. Drop existing check constraint on stories.status if present
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_status_check;

-- 2. Add updated check constraint supporting new, active, done alongside legacy statuses
ALTER TABLE public.stories 
ADD CONSTRAINT stories_status_check 
CHECK (status IN ('new', 'active', 'done', 'draft', 'review', 'changes_requested', 'approved', 'in_development', 'completed'));

-- 3. Set default status for new stories to 'new'
ALTER TABLE public.stories ALTER COLUMN status SET DEFAULT 'new';

-- 4. Optional Backfill / Migration of legacy status values to clean lifecycle:
-- 'draft' or 'review' -> 'new'
-- 'in_development' -> 'active'
-- 'completed' -> 'done'
UPDATE public.stories SET status = 'new' WHERE status IN ('draft', 'review');
UPDATE public.stories SET status = 'active' WHERE status = 'in_development';
UPDATE public.stories SET status = 'done' WHERE status = 'completed';
