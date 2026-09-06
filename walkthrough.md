# StoryBoard Super Admin Implementation

I have successfully replaced the public signup system with a secure, role-based user management architecture. 

## 1. Authentication Changes
- **Removed Public Signup**: The `components/AuthForm.tsx` file has been updated. The "signup" mode, toggle buttons, and all client-side calls to `supabase.auth.signUp()` have been completely removed.
- **Freelancer Login**: Freelancers now only see a clean Email/Password "Sign in" form.
- **Client Authentication**: The custom client authentication (using the `clients` table and 6-digit login ID) remains completely untouched and perfectly separated.

## 2. Database & RLS
- **`freelancer_profiles` Table**: Added a new table to store freelancer roles (`super_admin` or `freelancer`) and account status (`active` or `disabled`).
- **RLS Policies**: Re-wrote the RLS policies for Projects, Stories, Share Links, Clients, Revisions, and Comments to explicitly permit `super_admin` users to manage all freelancer-side data, as requested in the design decisions. Normal freelancers remain securely restricted to their own data.

## 3. Super Admin Bootstrap Procedure
> [!IMPORTANT]
> **How to create your first Super Admin**
> Since public signup is disabled, you must manually grant yourself Super Admin privileges once.
> 
> 1. Go to your Supabase Dashboard -> **SQL Editor**.
> 2. Open the file `supabase/bootstrap_super_admin.sql` that I just created.
> 3. Follow the 5 short instructions at the top of the file to enter your existing User UUID and email.
> 4. Run the script.

## 4. User Management API & UI
- **New Routes**:
  - `GET /api/users` - Fetches all accounts (Super Admin only).
  - `POST /api/users` - Securely creates an Auth user using the server-side Supabase Admin client and sets up their profile.
  - `PATCH /api/users/[id]` - Toggles account status.
  - `/users` - The UI management dashboard.
- **Role Enforcement**: `middleware.ts` now actively checks user profiles. If an account is marked `disabled`, it forces a sign-out. It also blocks non-admins from manually navigating to `/users`.
- **Sidebar Updates**: The `Users / Freelancers` tab will dynamically appear in the sidebar only if the authenticated user has the `super_admin` role.

## 5. Security Summary
- Passwords are never stored in plaintext (handled natively by Supabase).
- No service keys are exposed to the browser.
- Privilege escalation is prevented because the `freelancer_profiles` table does not allow INSERT/UPDATE via public RLS—only the server-side admin client can assign the `super_admin` role.
