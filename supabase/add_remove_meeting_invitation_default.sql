-- ==============================================================================
-- REQly: Remove default boilerplate meeting invitation message
-- ==============================================================================
-- The invitation_message column previously defaulted to boilerplate text that
-- leaked into shared meeting invitations. The application no longer injects a
-- default message, so the database must not either.

-- 1. Drop the boilerplate default and allow NULL (no message by default)
ALTER TABLE public.project_meetings
    ALTER COLUMN invitation_message DROP DEFAULT,
    ALTER COLUMN invitation_message DROP NOT NULL;

-- 2. Clear any pre-existing boilerplate values on old rows
UPDATE public.project_meetings
SET invitation_message = NULL
WHERE invitation_message = 'You are invited to a project meeting. Please find the meeting details below.';
