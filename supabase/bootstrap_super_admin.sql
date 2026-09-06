-- ==============================================================================
-- STORYBOARD SUPER ADMIN BOOTSTRAP SCRIPT
-- ==============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Ensure you have already created your first account via the Supabase dashboard
--    (Authentication -> Add User -> Create New User).
-- 2. Find the UUID (User ID) of the account you want to make the Super Admin.
-- 3. Replace 'YOUR-USER-UUID-HERE' below with that actual UUID.
-- 4. Replace 'your-email@example.com' with the user's email.
-- 5. Run this script in the Supabase SQL Editor.
-- 
-- Note: This is a one-time operation. Once the first Super Admin exists,
-- all future accounts should be created through the StoryBoard UI.
-- ==============================================================================

DO $$
DECLARE
  target_user_id uuid := 'YOUR-USER-UUID-HERE'; -- CHANGE THIS
  target_email text := 'your-email@example.com'; -- CHANGE THIS
BEGIN
  -- Insert or update the profile to be a super_admin
  INSERT INTO public.freelancer_profiles (id, email, name, role, status)
  VALUES (target_user_id, target_email, 'Initial Super Admin', 'super_admin', 'active')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'super_admin', status = 'active';
  
  RAISE NOTICE 'User % is now a super_admin.', target_user_id;
END $$;
