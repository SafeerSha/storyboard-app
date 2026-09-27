-- Table to store temporary password reset OTPs and verified reset tokens
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  reset_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying active OTPs by email and expiration
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_exp 
  ON public.password_reset_otps (email, expires_at);

-- Index for looking up verified reset tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_token 
  ON public.password_reset_otps (reset_token);

-- Enable Row Level Security (RLS)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Note: No direct public policies are added. All access is handled via server-side service role client.
