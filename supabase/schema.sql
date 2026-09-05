create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  raw_requirement text,
  title text not null,
  description text not null default '',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  clarifications jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','changes_requested','approved','in_development','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists story_revisions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table stories enable row level security;
alter table story_comments enable row level security;
alter table share_links enable row level security;
alter table story_revisions enable row level security;

create policy "owners can manage projects" on projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners can manage stories" on stories for all using (
  exists (select 1 from projects p where p.id = stories.project_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from projects p where p.id = stories.project_id and p.owner_id = auth.uid())
);
create policy "owners can manage revisions" on story_revisions for all using (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_revisions.story_id and p.owner_id=auth.uid()
  )
);
create policy "owners can manage share links" on share_links for all using (
  exists (select 1 from projects p where p.id = share_links.project_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from projects p where p.id = share_links.project_id and p.owner_id = auth.uid())
);

-- Public client review/approval should be implemented through server-side token validation,
-- not by exposing broad anonymous table access.

-- Client portal extension
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  login_id varchar(6) not null unique,
  password_hash text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients enable row level security;
create policy "owners can manage clients" on clients for all using (
  exists (select 1 from projects p where p.id = clients.project_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from projects p where p.id = clients.project_id and p.owner_id = auth.uid())
);

-- Client comments are submitted through server-side client-session validation.
-- Owner policy permits the freelancer to see/manage comments.
create policy "owners can manage story comments" on story_comments for all using (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_comments.story_id and p.owner_id=auth.uid()
  )
) with check (
  exists (
    select 1 from stories s join projects p on p.id=s.project_id
    where s.id=story_comments.story_id and p.owner_id=auth.uid()
  )
);
