-- ==============================================================================
-- STORYBOARD SUPER ADMIN BOOTSTRAP SCRIPT
-- ==============================================================================
-- 
-- PURPOSE:
-- Securely bootstrap the initial Super Admin account for StoryBoard.
-- This operation runs strictly via direct database admin access (SQL Editor)
-- or backend service role operations.
--
-- No public endpoint or frontend UI can elevate a user to Super Admin.
--
-- ==============================================================================

-- 1. Ensure the freelancer_profiles table exists
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'freelancer' CHECK (role IN ('super_admin', 'freelancer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Bootstrap Option A: Target by Email (Recommended)
-- Replace 'pksafeer8@gmail.com' with your primary owner email address.
INSERT INTO public.freelancer_profiles (id, email, name, role, status, updated_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', 'Safeer Sha'), 
  'super_admin', 
  'active',
  now()
FROM auth.users
WHERE email = 'pksafeer8@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'super_admin', 
  status = 'active',
  updated_at = now();

-- 3. Bootstrap Option B: Automatically promote the primary/oldest registered owner
-- (Only used if email is not specified above)
INSERT INTO public.freelancer_profiles (id, email, name, role, status, updated_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 
  'super_admin', 
  'active',
  now()
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'super_admin', 
  status = 'active',
  updated_at = now();

-- 4. Verify Super Admin assignment
SELECT id, email, name, role, status, created_at, updated_at 
FROM public.freelancer_profiles 
WHERE role = 'super_admin';
