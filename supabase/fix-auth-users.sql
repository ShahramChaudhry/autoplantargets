-- Run this in Supabase SQL Editor if login fails with
-- "Database error querying schema" after seeding auth users.
-- Safe to re-run.

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, '')
WHERE email LIKE '%@autoplan.com';
