-- ==============================================================================
-- REQly: Project Inbox Collaboration, AI Discussion & Saved Insights Schema
-- ==============================================================================

-- 1. Create project_inbox_members table
CREATE TABLE IF NOT EXISTS public.project_inbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_item_id UUID NOT NULL REFERENCES public.project_inbox_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'team_user' CHECK (user_type IN ('freelancer', 'team_user')),
    role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_inbox_member UNIQUE (inbox_item_id, user_id)
);

-- Fast lookup indexes for item-level access verification
CREATE INDEX IF NOT EXISTS idx_project_inbox_members_item_user 
    ON public.project_inbox_members(inbox_item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_inbox_members_user_item 
    ON public.project_inbox_members(user_id, inbox_item_id);

-- Backfill existing project_inbox_items owners as 'owner' in project_inbox_members
INSERT INTO public.project_inbox_members (inbox_item_id, user_id, user_type, role)
SELECT id, owner_id, 'freelancer', 'owner'
FROM public.project_inbox_items
ON CONFLICT (inbox_item_id, user_id) DO NOTHING;

-- 2. Create project_inbox_conversations table
CREATE TABLE IF NOT EXISTS public.project_inbox_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_item_id UUID NOT NULL REFERENCES public.project_inbox_items(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'General Discussion',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_inbox_conversations_item_updated 
    ON public.project_inbox_conversations(inbox_item_id, updated_at DESC);

-- Backfill from legacy project_inbox_ai_threads if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_inbox_ai_threads') THEN
        INSERT INTO public.project_inbox_conversations (id, inbox_item_id, title, created_at, updated_at)
        SELECT id, inbox_item_id, title, created_at, updated_at
        FROM public.project_inbox_ai_threads
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Ensure every existing project_inbox_item has at least one "General Discussion" conversation
INSERT INTO public.project_inbox_conversations (inbox_item_id, title)
SELECT id, 'General Discussion'
FROM public.project_inbox_items i
WHERE NOT EXISTS (
    SELECT 1 FROM public.project_inbox_conversations c WHERE c.inbox_item_id = i.id
);

-- 3. Create project_inbox_messages table
CREATE TABLE IF NOT EXISTS public.project_inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.project_inbox_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai')),
    user_id UUID,
    user_type TEXT CHECK (user_type IN ('freelancer', 'team_user')),
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_inbox_messages_conv_created 
    ON public.project_inbox_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_inbox_messages_created 
    ON public.project_inbox_messages(created_at ASC);

-- Backfill from legacy project_inbox_ai_messages if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_inbox_ai_messages') THEN
        INSERT INTO public.project_inbox_messages (id, conversation_id, sender_type, user_id, user_name, message, created_at)
        SELECT 
            m.id, 
            m.thread_id, 
            CASE WHEN m.role = 'user' THEN 'user' ELSE 'ai' END,
            NULL,
            CASE WHEN m.role = 'user' THEN 'You' ELSE 'AI Thinking Partner' END,
            m.content, 
            m.created_at
        FROM public.project_inbox_ai_messages m
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 4. Create project_inbox_insights table
CREATE TABLE IF NOT EXISTS public.project_inbox_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_item_id UUID NOT NULL REFERENCES public.project_inbox_items(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.project_inbox_conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.project_inbox_messages(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'insight' CHECK (type IN ('insight', 'research', 'hook', 'risk', 'decision', 'mvp_idea', 'competitor', 'technical_finding', 'question', 'reference')),
    title TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL,
    question_summary TEXT NOT NULL DEFAULT '',
    ai_response TEXT NOT NULL,
    ai_response_summary TEXT NOT NULL DEFAULT '',
    saved_by UUID NOT NULL,
    saved_by_name TEXT NOT NULL,
    saved_by_type TEXT NOT NULL DEFAULT 'team_user' CHECK (saved_by_type IN ('freelancer', 'team_user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_inbox_insights_message UNIQUE (inbox_item_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_project_inbox_insights_item_created 
    ON public.project_inbox_insights(inbox_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_inbox_insights_saved_by 
    ON public.project_inbox_insights(saved_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_inbox_insights_item_type 
    ON public.project_inbox_insights(inbox_item_id, type);

-- 5. Row Level Security (RLS)
ALTER TABLE public.project_inbox_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_insights ENABLE ROW LEVEL SECURITY;

-- Update project_inbox_items RLS to allow collaborators to view items
DROP POLICY IF EXISTS "Owners can manage inbox items" ON public.project_inbox_items;
DROP POLICY IF EXISTS "Members and super admins can view inbox items" ON public.project_inbox_items;
DROP POLICY IF EXISTS "Owners and super admins can manage inbox items" ON public.project_inbox_items;

CREATE POLICY "Members and super admins can view inbox items"
    ON public.project_inbox_items
    FOR SELECT
    USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM public.project_inbox_members m
            WHERE m.inbox_item_id = project_inbox_items.id AND m.user_id = auth.uid()
        )
        OR public.is_super_admin()
    );

CREATE POLICY "Owners and super admins can manage inbox items"
    ON public.project_inbox_items
    FOR ALL
    USING (
        auth.uid() = owner_id
        OR public.is_super_admin()
    )
    WITH CHECK (
        auth.uid() = owner_id
        OR public.is_super_admin()
    );

-- project_inbox_members policies
DROP POLICY IF EXISTS "Members can view collaborators" ON public.project_inbox_members;
CREATE POLICY "Members can view collaborators"
    ON public.project_inbox_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
        OR EXISTS (
            SELECT 1 FROM public.project_inbox_members m2
            WHERE m2.inbox_item_id = project_inbox_members.inbox_item_id AND m2.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners and super admins can manage members" ON public.project_inbox_members;
CREATE POLICY "Owners and super admins can manage members"
    ON public.project_inbox_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
    );

-- project_inbox_conversations policies
DROP POLICY IF EXISTS "Members can view and create conversations" ON public.project_inbox_conversations;
CREATE POLICY "Members can view and create conversations"
    ON public.project_inbox_conversations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
        OR EXISTS (
            SELECT 1 FROM public.project_inbox_members m
            WHERE m.inbox_item_id = project_inbox_conversations.inbox_item_id AND m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
        OR EXISTS (
            SELECT 1 FROM public.project_inbox_members m
            WHERE m.inbox_item_id = project_inbox_conversations.inbox_item_id AND m.user_id = auth.uid()
        )
    );

-- project_inbox_messages policies
DROP POLICY IF EXISTS "Members can view and post messages" ON public.project_inbox_messages;
CREATE POLICY "Members can view and post messages"
    ON public.project_inbox_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.project_inbox_conversations c
            JOIN public.project_inbox_items i ON i.id = c.inbox_item_id
            WHERE c.id = conversation_id AND (
                i.owner_id = auth.uid() 
                OR public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.project_inbox_members m
                    WHERE m.inbox_item_id = i.id AND m.user_id = auth.uid()
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_inbox_conversations c
            JOIN public.project_inbox_items i ON i.id = c.inbox_item_id
            WHERE c.id = conversation_id AND (
                i.owner_id = auth.uid() 
                OR public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.project_inbox_members m
                    WHERE m.inbox_item_id = i.id AND m.user_id = auth.uid()
                )
            )
        )
    );

-- project_inbox_insights policies
DROP POLICY IF EXISTS "Members can view and save insights" ON public.project_inbox_insights;
CREATE POLICY "Members can view and save insights"
    ON public.project_inbox_insights
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (
                i.owner_id = auth.uid() 
                OR public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.project_inbox_members m
                    WHERE m.inbox_item_id = i.id AND m.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Authorized users can insert insights" ON public.project_inbox_insights;
CREATE POLICY "Authorized users can insert insights"
    ON public.project_inbox_insights
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (
                i.owner_id = auth.uid() 
                OR public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.project_inbox_members m
                    WHERE m.inbox_item_id = i.id AND m.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Owners and savers can delete insights" ON public.project_inbox_insights;
CREATE POLICY "Owners and savers can delete insights"
    ON public.project_inbox_insights
    FOR DELETE
    USING (
        saved_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_inbox_items i
            WHERE i.id = inbox_item_id AND (i.owner_id = auth.uid() OR public.is_super_admin())
        )
    );
