-- ==========================================================
-- REQly: Story Feature Branch & Pull Request Links
-- ==========================================================

-- 1. Feature branch name for the story's implementation
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS feature_branch TEXT;

-- 2. Pull request URL for the story
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS pull_request_url TEXT;
