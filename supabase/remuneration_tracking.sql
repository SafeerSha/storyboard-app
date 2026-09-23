-- ==============================================================================
-- Remuneration Tracking & Payment Management Schema Migration
-- ==============================================================================

-- 1. Create Remunerations Table
CREATE TABLE IF NOT EXISTS public.remunerations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('single', 'installments')),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'requested', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Remuneration Installments Table
CREATE TABLE IF NOT EXISTS public.remuneration_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'requested', 'completed')),
    requested_date TIMESTAMPTZ,
    received_date TIMESTAMPTZ,
    received_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    payment_reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_remuneration_installment_number UNIQUE (remuneration_id, installment_number)
);

-- 3. Create Remuneration Payments Table (Independent payment records)
CREATE TABLE IF NOT EXISTS public.remuneration_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    installment_id UUID NOT NULL REFERENCES public.remuneration_installments(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method VARCHAR(50) NOT NULL,
    payment_reference TEXT,
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Remuneration Proofs Table (Payment proofs in Cloudflare R2)
CREATE TABLE IF NOT EXISTS public.remuneration_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    installment_id UUID NOT NULL REFERENCES public.remuneration_installments(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.remuneration_payments(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Remuneration Timeline Events (Immutable Financial Audit Trail)
CREATE TABLE IF NOT EXISTS public.remuneration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES public.remuneration_installments(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_name TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create Notifications Table (In-App Notification Center)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'remuneration',
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Performance & Query Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_remunerations_project_id ON public.remunerations(project_id);
CREATE INDEX IF NOT EXISTS idx_remunerations_created_by ON public.remunerations(created_by);
CREATE INDEX IF NOT EXISTS idx_remunerations_status ON public.remunerations(status);

CREATE INDEX IF NOT EXISTS idx_remuneration_installments_rem_id ON public.remuneration_installments(remuneration_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_installments_due_date ON public.remuneration_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_remuneration_installments_status ON public.remuneration_installments(status);

CREATE INDEX IF NOT EXISTS idx_remuneration_payments_installment ON public.remuneration_payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_payments_rem_id ON public.remuneration_payments(remuneration_id);

CREATE INDEX IF NOT EXISTS idx_remuneration_proofs_installment ON public.remuneration_proofs(installment_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_proofs_rem_id ON public.remuneration_proofs(remuneration_id);

CREATE INDEX IF NOT EXISTS idx_remuneration_events_rem_id ON public.remuneration_events(remuneration_id);
CREATE INDEX IF NOT EXISTS idx_remuneration_events_created_at ON public.remuneration_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ==============================================================================
-- Row-Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.remunerations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper check for super admin if not already present
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.freelancer_profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;

-- 1. Remunerations RLS: Project owner or Super Admin
CREATE POLICY "owners and super admins can manage remunerations"
    ON public.remunerations
    FOR ALL
    USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = remunerations.project_id AND p.owner_id = auth.uid()
        )
        OR public.is_super_admin()
    )
    WITH CHECK (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = remunerations.project_id AND p.owner_id = auth.uid()
        )
        OR public.is_super_admin()
    );

-- 2. Installments RLS: Inherit project ownership
CREATE POLICY "owners and super admins can manage installments"
    ON public.remuneration_installments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_installments.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_installments.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    );

-- 3. Payments RLS: Inherit project ownership
CREATE POLICY "owners and super admins can manage payments"
    ON public.remuneration_payments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_payments.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_payments.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    );

-- 4. Proofs RLS: Inherit project ownership
CREATE POLICY "owners and super admins can manage proofs"
    ON public.remuneration_proofs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_proofs.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_proofs.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    );

-- 5. Audit Events RLS: Inherit project ownership
CREATE POLICY "owners and super admins can manage events"
    ON public.remuneration_events
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_events.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_events.remuneration_id
            AND (p.owner_id = auth.uid() OR r.created_by = auth.uid() OR public.is_super_admin())
        )
    );

-- 6. Notifications RLS: Own notifications only
CREATE POLICY "users can view and manage their own notifications"
    ON public.notifications
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
