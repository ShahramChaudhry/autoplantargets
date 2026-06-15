-- Repair plans stuck at legacy b2b_approved (before auto-forward to MD was implemented)
UPDATE planning_periods
SET status = 'submitted_md'
WHERE status = 'b2b_approved';
