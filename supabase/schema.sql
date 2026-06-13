-- AutoPlan Targets - Database Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom types
CREATE TYPE user_role AS ENUM (
  'demand_supply',
  'b2b_director',
  'managing_director',
  'national_performance_manager',
  'branch_manager'
);

CREATE TYPE planning_status AS ENUM (
  'draft',
  'submitted_b2b',
  'b2b_changes_requested',
  'b2b_approved',
  'submitted_md',
  'md_changes_requested',
  'md_approved',
  'finalized',
  'retail_allocation',
  'executive_allocation',
  'reconciliation_failed',
  'completed'
);

CREATE TYPE notification_status AS ENUM (
  'unread',
  'read'
);

-- Users profile table (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planning periods
CREATE TABLE planning_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  status planning_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, year)
);

-- Brand & Sales Group targets
CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_period_id UUID NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  sales_group TEXT NOT NULL,
  target_units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model allocations
CREATE TABLE model_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article allocations
CREATE TABLE article_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_allocation_id UUID NOT NULL REFERENCES model_allocations(id) ON DELETE CASCADE,
  article_code TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales office allocations (Retail)
CREATE TABLE sales_office_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_period_id UUID NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  sales_office TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Executive allocations
CREATE TABLE executive_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_office_allocation_id UUID NOT NULL REFERENCES sales_office_allocations(id) ON DELETE CASCADE,
  sales_executive TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'unread',
  planning_period_id UUID REFERENCES planning_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit history
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  planning_period_id UUID REFERENCES planning_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_targets_planning_period ON targets(planning_period_id);
CREATE INDEX idx_model_allocations_target ON model_allocations(target_id);
CREATE INDEX idx_article_allocations_model ON article_allocations(model_allocation_id);
CREATE INDEX idx_sales_office_allocations_period ON sales_office_allocations(planning_period_id);
CREATE INDEX idx_executive_allocations_office ON executive_allocations(sales_office_allocation_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, status);
CREATE INDEX idx_audit_logs_period ON audit_logs(planning_period_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planning_periods_updated_at
  BEFORE UPDATE ON planning_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER targets_updated_at
  BEFORE UPDATE ON targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER model_allocations_updated_at
  BEFORE UPDATE ON model_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER article_allocations_updated_at
  BEFORE UPDATE ON article_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sales_office_allocations_updated_at
  BEFORE UPDATE ON sales_office_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER executive_allocations_updated_at
  BEFORE UPDATE ON executive_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_office_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all planning data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view all users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated full access planning_periods" ON planning_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access targets" ON targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access model_allocations" ON model_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access article_allocations" ON article_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access sales_office_allocations" ON sales_office_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access executive_allocations" ON executive_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view audit logs" ON audit_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'demand_supply')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
