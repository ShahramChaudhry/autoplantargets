-- AutoPlan Targets - Seed Data
-- Run AFTER schema.sql
-- Creates auth users, profiles, and one in-progress planning cycle

-- Seed auth users (password: password123 for all)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) VALUES
  ('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'demand@autoplan.com', crypt('password123', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Demand & Supply Team","role":"demand_supply"}', NOW(), NOW(), '', ''),
  ('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'b2bdirector@autoplan.com', crypt('password123', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"B2B Director","role":"b2b_director"}', NOW(), NOW(), '', ''),
  ('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'md@autoplan.com', crypt('password123', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Managing Director","role":"managing_director"}', NOW(), NOW(), '', ''),
  ('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'npm@autoplan.com', crypt('password123', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"National Performance Manager","role":"national_performance_manager"}', NOW(), NOW(), '', ''),
  ('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'branchmanager@autoplan.com', crypt('password123', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Branch Manager","role":"branch_manager"}', NOW(), NOW(), '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111101', '{"sub":"11111111-1111-1111-1111-111111111101","email":"demand@autoplan.com"}', 'email', '11111111-1111-1111-1111-111111111101', NOW(), NOW(), NOW()),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111102', '{"sub":"11111111-1111-1111-1111-111111111102","email":"b2bdirector@autoplan.com"}', 'email', '11111111-1111-1111-1111-111111111102', NOW(), NOW(), NOW()),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111103', '{"sub":"11111111-1111-1111-1111-111111111103","email":"md@autoplan.com"}', 'email', '11111111-1111-1111-1111-111111111103', NOW(), NOW(), NOW()),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111104', '{"sub":"11111111-1111-1111-1111-111111111104","email":"npm@autoplan.com"}', 'email', '11111111-1111-1111-1111-111111111104', NOW(), NOW(), NOW()),
  (uuid_generate_v4(), '11111111-1111-1111-1111-111111111105', '{"sub":"11111111-1111-1111-1111-111111111105","email":"branchmanager@autoplan.com"}', 'email', '11111111-1111-1111-1111-111111111105', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- User profiles (trigger may create these; ensure correct roles)
INSERT INTO users (id, name, email, role) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Demand & Supply Team', 'demand@autoplan.com', 'demand_supply'),
  ('11111111-1111-1111-1111-111111111102', 'B2B Director', 'b2bdirector@autoplan.com', 'b2b_director'),
  ('11111111-1111-1111-1111-111111111103', 'Managing Director', 'md@autoplan.com', 'managing_director'),
  ('11111111-1111-1111-1111-111111111104', 'National Performance Manager', 'npm@autoplan.com', 'national_performance_manager'),
  ('11111111-1111-1111-1111-111111111105', 'Branch Manager', 'branchmanager@autoplan.com', 'branch_manager')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

-- Planning period: June 2026 - executive allocation with reconciliation failure
INSERT INTO planning_periods (id, month, year, status) VALUES
  ('22222222-2222-2222-2222-222222222201', 6, 2026, 'reconciliation_failed');

-- Targets by Brand & Sales Group
INSERT INTO targets (id, planning_period_id, brand, sales_group, target_units) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'Toyota', 'Retail', 450),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 'Toyota', 'Fleet', 120),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 'Toyota', 'Corporate Fleet', 80),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 'Lexus', 'Retail', 180),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222201', 'Lexus', 'Fleet', 60),
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222201', 'Honda', 'Retail', 220),
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222201', 'Honda', 'Fleet', 90);

-- Model allocations
INSERT INTO model_allocations (id, target_id, model, units) VALUES
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 'Corolla', 200),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', 'Camry', 150),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333301', 'Prado', 100),
  ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333302', 'Corolla', 60),
  ('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333302', 'Camry', 60),
  ('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333303', 'Prado', 80),
  ('44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333304', 'Camry', 100),
  ('44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333304', 'Prado', 80),
  ('44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333305', 'Camry', 60),
  ('44444444-4444-4444-4444-444444444410', '33333333-3333-3333-3333-333333333306', 'Civic', 120),
  ('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333306', 'Accord', 100),
  ('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333307', 'Civic', 50),
  ('44444444-4444-4444-4444-444444444413', '33333333-3333-3333-3333-333333333307', 'Accord', 40);

-- Article allocations
INSERT INTO article_allocations (id, model_allocation_id, article_code, units) VALUES
  ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', 'COR-GLI-2026', 120),
  ('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444401', 'COR-XLI-2026', 80),
  ('55555555-5555-5555-5555-555555555503', '44444444-4444-4444-4444-444444444402', 'CAM-SE-2026', 90),
  ('55555555-5555-5555-5555-555555555504', '44444444-4444-4444-4444-444444444402', 'CAM-XLE-2026', 60),
  ('55555555-5555-5555-5555-555555555505', '44444444-4444-4444-4444-444444444403', 'PRA-GXL-2026', 100),
  ('55555555-5555-5555-5555-555555555506', '44444444-4444-4444-4444-444444444410', 'CIV-LX-2026', 70),
  ('55555555-5555-5555-5555-555555555507', '44444444-4444-4444-4444-444444444410', 'CIV-SPORT-2026', 50),
  ('55555555-5555-5555-5555-555555555508', '44444444-4444-4444-4444-444444444411', 'ACC-EX-2026', 100);

-- Sales office allocations (Retail total = 850: Toyota 450 + Lexus 180 + Honda 220)
INSERT INTO sales_office_allocations (id, planning_period_id, sales_office, units) VALUES
  ('66666666-6666-6666-6666-666666666601', '22222222-2222-2222-2222-222222222201', 'Dubai', 380),
  ('66666666-6666-6666-6666-666666666602', '22222222-2222-2222-2222-222222222201', 'Abu Dhabi', 280),
  ('66666666-6666-6666-6666-666666666603', '22222222-2222-2222-2222-222222222201', 'Sharjah', 190);

-- Executive allocations (intentional mismatch: sum = 845 vs model retail sum = 850)
INSERT INTO executive_allocations (id, sales_office_allocation_id, sales_executive, units) VALUES
  ('77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601', 'Ahmed Hassan', 150),
  ('77777777-7777-7777-7777-777777777702', '66666666-6666-6666-6666-666666666601', 'Sarah Khan', 130),
  ('77777777-7777-7777-7777-777777777703', '66666666-6666-6666-6666-666666666601', 'John Mathew', 100),
  ('77777777-7777-7777-7777-777777777704', '66666666-6666-6666-6666-666666666602', 'Ali Raza', 140),
  ('77777777-7777-7777-7777-777777777705', '66666666-6666-6666-6666-666666666602', 'Fatima Noor', 135),
  ('77777777-7777-7777-7777-777777777706', '66666666-6666-6666-6666-666666666603', 'Ahmed Hassan', 95),
  ('77777777-7777-7777-7777-777777777707', '66666666-6666-6666-6666-666666666603', 'Sarah Khan', 95);

-- Reconciliation failure notification for Branch Manager
INSERT INTO notifications (id, user_id, type, message, status, planning_period_id) VALUES
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111105',
   'reconciliation_failed',
   'Reconciliation failed for June 2026: Model targets (850 units) do not match Sales Office targets (850 units) vs Executive allocations (845 units). Please review and update allocations.',
   'unread', '22222222-2222-2222-2222-222222222201');

-- Audit history
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, planning_period_id) VALUES
  ('11111111-1111-1111-1111-111111111101', 'created', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"month":6,"year":2026}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111101', 'created', 'targets', '33333333-3333-3333-3333-333333333301', '{"brand":"Toyota","sales_group":"Retail","units":450}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111101', 'submitted', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"status":"submitted_b2b"}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111102', 'approved', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"status":"b2b_approved","comment":"Targets look good"}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111101', 'submitted', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"status":"submitted_md"}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111103', 'approved', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"status":"md_approved","comment":"Approved for finalization"}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111101', 'finalized', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"status":"finalized"}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111104', 'allocated', 'sales_office_allocations', '66666666-6666-6666-6666-666666666601', '{"sales_office":"Dubai","units":380}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111105', 'allocated', 'executive_allocations', '77777777-7777-7777-7777-777777777701', '{"sales_executive":"Ahmed Hassan","units":150}', '22222222-2222-2222-2222-222222222201'),
  ('11111111-1111-1111-1111-111111111105', 'reconciliation_failed', 'planning_period', '22222222-2222-2222-2222-222222222201', '{"model_sum":850,"office_sum":850,"executive_sum":845,"variance":-5}', '22222222-2222-2222-2222-222222222201');
