-- ==============================================================================
-- REQly: Workspace AI Copilot Conversations, Messages & Action History
-- ==============================================================================

-- 1. Create workspace_bot_conversations table
CREATE TABLE IF NOT EXISTS public.workspace_bot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'freelancer' CHECK (user_type IN ('freelancer', 'team_user')),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Discussion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_workspace_bot_conv_user 
    ON public.workspace_bot_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_bot_conv_project 
    ON public.workspace_bot_conversations(project_id) WHERE project_id IS NOT NULL;

-- 2. Create workspace_bot_messages table
CREATE TABLE IF NOT EXISTS public.workspace_bot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.workspace_bot_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- records tool calls, action receipts (created story IDs, task IDs)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_bot_msgs_conv 
    ON public.workspace_bot_messages(conversation_id, created_at ASC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.workspace_bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_bot_messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
DROP POLICY IF EXISTS "Users can manage own bot conversations" ON public.workspace_bot_conversations;
CREATE POLICY "Users can manage own bot conversations"
    ON public.workspace_bot_conversations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for messages
DROP POLICY IF EXISTS "Users can manage own bot messages" ON public.workspace_bot_messages;
CREATE POLICY "Users can manage own bot messages"
    ON public.workspace_bot_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_bot_conversations c
            WHERE c.id = workspace_bot_messages.conversation_id AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_bot_conversations c
            WHERE c.id = workspace_bot_messages.conversation_id AND c.user_id = auth.uid()
        )
    );
