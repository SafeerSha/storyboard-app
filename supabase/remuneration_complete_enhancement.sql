-- ==============================================================================
-- Remuneration & Payment Management – Complete Production Enhancement Migration
-- ==============================================================================

-- 1. Extend public.remunerations with Agreement fields
ALTER TABLE public.remunerations
ADD COLUMN IF NOT EXISTS agreement_date DATE DEFAULT CURRENT_DATE;

ALTER TABLE public.remunerations
ADD COLUMN IF NOT EXISTS agreement_status VARCHAR(20) DEFAULT 'active';

-- 2. Extend public.remuneration_installments with Name, Description & Optional Due Date
ALTER TABLE public.remuneration_installments
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.remuneration_installments
ADD COLUMN IF NOT EXISTS description TEXT;

-- Make due_date optional / nullable
ALTER TABLE public.remuneration_installments
ALTER COLUMN due_date DROP NOT NULL;

-- Update status check constraint on remuneration_installments to support both legacy & enhanced statuses
DO $$
BEGIN
    ALTER TABLE public.remuneration_installments 
    DROP CONSTRAINT IF EXISTS remuneration_installments_status_check;

    ALTER TABLE public.remuneration_installments
    ADD CONSTRAINT remuneration_installments_status_check
    CHECK (status IN ('planned', 'due', 'partially_paid', 'paid', 'cancelled', 'new', 'requested', 'completed'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Extend public.remuneration_payments with Status
ALTER TABLE public.remuneration_payments
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

-- 4. Create Payment Team Splits Table (per actual payment transaction)
CREATE TABLE IF NOT EXISTS public.payment_team_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.remuneration_payments(id) ON DELETE CASCADE,
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    team_user_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    role TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    percentage NUMERIC(5, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_team_splits_payment_id ON public.payment_team_splits(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_team_splits_rem_id ON public.payment_team_splits(remuneration_id);
CREATE INDEX IF NOT EXISTS idx_payment_team_splits_team_user_id ON public.payment_team_splits(team_user_id);

-- 5. Create Remuneration Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.remuneration_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    client_email_settings JSONB NOT NULL DEFAULT '{
        "payment_received": true,
        "payment_receipt": true,
        "installment_created": true,
        "installment_updated": false,
        "payment_reminder": false,
        "installment_due": true,
        "installment_overdue": true
    }'::jsonb,
    team_notification_settings JSONB NOT NULL DEFAULT '{
        "payment_received": { "email": true, "in_app": true },
        "payment_allocated": { "email": true, "in_app": true },
        "split_updated": { "email": true, "in_app": true },
        "allocation_removed": { "email": true, "in_app": true },
        "status_changed": { "email": false, "in_app": true }
    }'::jsonb,
    require_full_split BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_rem_notification_preferences UNIQUE (remuneration_id)
);

CREATE INDEX IF NOT EXISTS idx_rem_notif_prefs_rem_id ON public.remuneration_notification_preferences(remuneration_id);

-- 6. Create Notification Logs Table (Full Audit Trail for Notification Delivery)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID REFERENCES public.remunerations(id) ON DELETE CASCADE,
    installment_id UUID REFERENCES public.remuneration_installments(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.remuneration_payments(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    recipient_name TEXT,
    recipient_type VARCHAR(30) NOT NULL, -- 'client', 'team_member', 'admin'
    notification_type VARCHAR(50) NOT NULL, -- 'payment_received', 'payment_allocated', 'installment_due', etc.
    channel VARCHAR(20) NOT NULL, -- 'email', 'in_app', 'sms'
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
    title TEXT,
    message TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_rem_id ON public.notification_logs(remuneration_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON public.notification_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);

-- ==============================================================================
-- Row-Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.payment_team_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remuneration_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- payment_team_splits RLS
DROP POLICY IF EXISTS "owners and super admins can manage payment team splits" ON public.payment_team_splits;
CREATE POLICY "owners and super admins can manage payment team splits"
    ON public.payment_team_splits
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = payment_team_splits.remuneration_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.freelancer_profiles fp
                    WHERE fp.id = auth.uid() AND fp.role = 'super_admin'
                )
            )
        )
    );

-- remuneration_notification_preferences RLS
DROP POLICY IF EXISTS "owners and super admins can manage notification preferences" ON public.remuneration_notification_preferences;
CREATE POLICY "owners and super admins can manage notification preferences"
    ON public.remuneration_notification_preferences
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_notification_preferences.remuneration_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.freelancer_profiles fp
                    WHERE fp.id = auth.uid() AND fp.role = 'super_admin'
                )
            )
        )
    );

-- notification_logs RLS
DROP POLICY IF EXISTS "owners and super admins can view notification logs" ON public.notification_logs;
CREATE POLICY "owners and super admins can view notification logs"
    ON public.notification_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = notification_logs.remuneration_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.freelancer_profiles fp
                    WHERE fp.id = auth.uid() AND fp.role = 'super_admin'
                )
            )
        )
    );
