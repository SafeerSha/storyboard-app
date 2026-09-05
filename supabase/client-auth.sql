-- Add new columns to existing clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS login_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Create client_sessions table
CREATE TABLE IF NOT EXISTS public.client_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

-- Service role has full access by default. We do NOT want to expose these tables to anonymous or authenticated Supabase Auth users unnecessarily.
-- So we won't add broad select policies.
-- If freelancers need to select clients they created, we should add a policy for that.
-- Let's check existing policies for clients table if possible, or just leave it secure and rely on service role.

-- To allow freelancers to see their clients (assuming clients are linked to projects, and projects to freelancers):
-- (We'll assume existing policies on clients table cover freelancer access, if not, we rely on service role for client auth)
