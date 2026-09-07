-- Create freelancer_profiles table
create table if not exists freelancer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text not null,
  role text not null default 'freelancer' check (role in ('super_admin', 'freelancer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table freelancer_profiles enable row level security;

-- Freelancers can read their own profile
create policy "users can view own profile" on freelancer_profiles for select using (auth.uid() = id);

-- Super admins can read all profiles
create policy "super_admins can view all profiles" on freelancer_profiles for select using (
  public.is_super_admin()
);

-- Note: We do NOT allow insert/update/delete via RLS. These operations will be done via server-side admin client.

-- ==========================================
-- Update existing RLS policies to allow Super Admin access
-- ==========================================

-- Helper function to check if current user is super_admin (useful to avoid deep joins in every policy)
create or replace function public.is_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from freelancer_profiles
    where id = auth.uid() and role = 'super_admin'
  );
end;
$$ language plpgsql security definer;

-- Drop existing policies that need updating
drop policy if exists "owners can manage projects" on projects;
drop policy if exists "owners can manage stories" on stories;
drop policy if exists "owners can manage revisions" on story_revisions;
drop policy if exists "owners can manage share links" on share_links;
drop policy if exists "owners can manage clients" on clients;
drop policy if exists "owners can manage story comments" on story_comments;

-- Recreate policies with Super Admin override
create policy "owners and super admins can manage projects" on projects for all using (
  auth.uid() = owner_id or public.is_super_admin()
) with check (
  auth.uid() = owner_id or public.is_super_admin()
);

create policy "owners and super admins can manage stories" on stories for all using (
  exists (select 1 from projects p where p.id = stories.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
) with check (
  exists (select 1 from projects p where p.id = stories.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
);

create policy "owners and super admins can manage revisions" on story_revisions for all using (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_revisions.story_id and p.owner_id=auth.uid()
  )
  or public.is_super_admin()
);

create policy "owners and super admins can manage share links" on share_links for all using (
  exists (select 1 from projects p where p.id = share_links.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
) with check (
  exists (select 1 from projects p where p.id = share_links.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
);

create policy "owners and super admins can manage clients" on clients for all using (
  exists (select 1 from projects p where p.id = clients.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
) with check (
  exists (select 1 from projects p where p.id = clients.project_id and p.owner_id = auth.uid())
  or public.is_super_admin()
);

create policy "owners and super admins can manage story comments" on story_comments for all using (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_comments.story_id and p.owner_id=auth.uid()
  )
  or public.is_super_admin()
) with check (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_comments.story_id and p.owner_id=auth.uid()
  )
  or public.is_super_admin()
);
