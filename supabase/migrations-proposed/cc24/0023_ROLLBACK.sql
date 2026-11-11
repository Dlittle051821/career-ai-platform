-- Rollback for 0023_counsellor_discovery_session_profile_read.sql
-- Removes only the CC-24 policy; every pre-existing policy is untouched.
drop policy if exists "Assigned DS counsellor can read student profile (cc24)" on public.profiles;
