-- Add email_from column to freelancer_profiles for storing the admin's preferred sender identity
-- This is used as the default "From" address in all outgoing email notifications (SMTP)
alter table freelancer_profiles
  add column if not exists email_from text;

-- Optionally add full_name if it doesn't exist yet (used across the app)
alter table freelancer_profiles
  add column if not exists full_name text;
