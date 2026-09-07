-- ==============================================================================
-- StoryBoard - Project Inbox & Personal AI Workspace Schema
-- ==============================================================================

-- 1. Project Inbox Items table
CREATE TABLE IF NOT EXISTS public.project_inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'idea' CHECK (type IN ('idea', 'upcoming_project', 'research', 'opportunity', 'experiment', 'feature', 'other')),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'exploring', 'researching', 'planned', 'ready', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT NOT NULL DEFAULT '',
  research_notes TEXT NOT NULL DEFAULT '',
  converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Project Inbox Reference Links
CREATE TABLE IF NOT EXISTS public.project_inbox_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_item_id UUID NOT NULL REFERENCES public.project_inbox_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Project Inbox AI Threads
CREATE TABLE IF NOT EXISTS public.project_inbox_ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_item_id UUID NOT NULL REFERENCES public.project_inbox_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'General Discussion',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Project Inbox AI Messages
CREATE TABLE IF NOT EXISTS public.project_inbox_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.project_inbox_ai_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_project_inbox_items_owner ON public.project_inbox_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_inbox_items_status ON public.project_inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_project_inbox_items_updated ON public.project_inbox_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_inbox_links_item ON public.project_inbox_links(inbox_item_id);
CREATE INDEX IF NOT EXISTS idx_project_inbox_threads_item ON public.project_inbox_ai_threads(inbox_item_id);
CREATE INDEX IF NOT EXISTS idx_project_inbox_messages_thread ON public.project_inbox_ai_messages(thread_id, created_at ASC);

-- Row Level Security (RLS)
ALTER TABLE public.project_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_ai_messages ENABLE ROW LEVEL SECURITY;

-- Item policies: strictly owner-scoped
DROP POLICY IF EXISTS "Owners can manage inbox items" ON public.project_inbox_items;
CREATE POLICY "Owners can manage inbox items"
  ON public.project_inbox_items
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Links policies
DROP POLICY IF EXISTS "Owners can manage inbox links" ON public.project_inbox_links;
CREATE POLICY "Owners can manage inbox links"
  ON public.project_inbox_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = inbox_item_id AND i.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = inbox_item_id AND i.owner_id = auth.uid()
    )
  );

-- AI Threads policies
DROP POLICY IF EXISTS "Owners can manage ai threads" ON public.project_inbox_ai_threads;
CREATE POLICY "Owners can manage ai threads"
  ON public.project_inbox_ai_threads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = inbox_item_id AND i.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_items i
      WHERE i.id = inbox_item_id AND i.owner_id = auth.uid()
    )
  );

-- AI Messages policies
DROP POLICY IF EXISTS "Owners can manage ai messages" ON public.project_inbox_ai_messages;
CREATE POLICY "Owners can manage ai messages"
  ON public.project_inbox_ai_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_inbox_ai_threads t
      JOIN public.project_inbox_items i ON i.id = t.inbox_item_id
      WHERE t.id = thread_id AND i.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_inbox_ai_threads t
      JOIN public.project_inbox_items i ON i.id = t.inbox_item_id
      WHERE t.id = thread_id AND i.owner_id = auth.uid()
    )
  );
