-- ==============================================================================
-- Client Password Onboarding & Credential Migration
-- ==============================================================================

-- 1. Add is_password_changed column to clients table (defaulting to false for new rows)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS is_password_changed BOOLEAN NOT NULL DEFAULT false;

-- 2. Add password_changed_at timestamp for security auditing
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 3. Gracefully migrate existing active clients who already possess a valid password
-- This prevents locking out existing clients or forcing them through onboarding unnecessarily.
UPDATE public.clients
SET is_password_changed = true
WHERE password_hash IS NOT NULL 
  AND password_hash != ''
  AND is_password_changed = false;

-- 4. Create an index on is_password_changed for fast filtering and authentication checks
CREATE INDEX IF NOT EXISTS idx_clients_is_password_changed 
ON public.clients(is_password_changed);
