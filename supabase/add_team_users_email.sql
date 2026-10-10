-- ==============================================================================
-- REQly: Add optional email column to team_users
-- ==============================================================================

-- 1. Add email column to public.team_users
ALTER TABLE public.team_users 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_team_users_email 
ON public.team_users(email);

-- 3. Document column
COMMENT ON COLUMN public.team_users.email IS 'Optional contact email for team members used for meeting invites, task notifications, and remuneration allocations.';
