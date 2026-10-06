-- ==============================================================================
-- Remuneration Splits & Receipt Confirmation Email Settings Migration
-- ==============================================================================

-- 1. Add send_receipt_email & splits columns to public.remunerations
ALTER TABLE public.remunerations
ADD COLUMN IF NOT EXISTS send_receipt_email BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.remunerations
ADD COLUMN IF NOT EXISTS splits JSONB DEFAULT '[]'::jsonb;

-- 2. Create Remuneration Splits Table for relational queries
CREATE TABLE IF NOT EXISTS public.remuneration_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remuneration_id UUID NOT NULL REFERENCES public.remunerations(id) ON DELETE CASCADE,
    team_user_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    role TEXT,
    percentage NUMERIC(5, 2),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remuneration_splits_rem_id ON public.remuneration_splits(remuneration_id);

-- 3. Row Level Security for remuneration_splits
ALTER TABLE public.remuneration_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners and super admins can manage remuneration splits"
    ON public.remuneration_splits
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.remunerations r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = remuneration_splits.remuneration_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.freelancer_profiles fp
                    WHERE fp.id = auth.uid() AND fp.role = 'super_admin'
                )
            )
        )
    );
