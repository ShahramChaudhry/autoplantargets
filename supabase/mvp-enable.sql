-- AutoPlan Targets — MVP Supabase migration
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Safe on partial schemas: only alters / policies tables that already exist.

-- ---------------------------------------------------------------------------
-- Schema upgrades (only if base tables exist)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'targets'
  ) THEN
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS model TEXT;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS sales_office TEXT;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS article_code TEXT;

    DROP INDEX IF EXISTS targets_period_brand_sg_model_office_article_uidx;
    CREATE UNIQUE INDEX targets_period_brand_sg_model_office_article_uidx
      ON targets (
        planning_period_id,
        brand,
        sales_group,
        COALESCE(model, ''),
        COALESCE(sales_office, ''),
        COALESCE(article_code, '')
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planning_periods'
  ) THEN
    ALTER TABLE planning_periods
      ADD COLUMN IF NOT EXISTS article_allocation_skipped BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Allow it_admin role if enum exists and value is missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'it_admin';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- Demo login uses fixed UUIDs that are not in auth.users — drop FKs that block writes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- MVP RLS: allow anon + authenticated full access on tables that exist
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'planning_periods',
    'targets',
    'model_allocations',
    'article_allocations',
    'sales_office_allocations',
    'executive_allocations',
    'notifications',
    'audit_logs',
    'users',
    'brands',
    'vehicle_models',
    'article_codes'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp_anon_all" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "mvp_authenticated_all" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "mvp_anon_all" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
        t
      );
      EXECUTE format(
        'CREATE POLICY "mvp_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed planning periods (idempotent) — only if table exists
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planning_periods'
  ) THEN
    INSERT INTO planning_periods (id, month, year, status, article_allocation_skipped)
    VALUES
      ('22222222-2222-2222-2222-222222222201', 6, 2026, 'draft', false),
      ('22222222-2222-2222-2222-222222222202', 7, 2026, 'draft', false),
      ('22222222-2222-2222-2222-222222222203', 8, 2026, 'draft', false),
      ('22222222-2222-2222-2222-222222222204', 9, 2026, 'draft', false)
    ON CONFLICT (month, year) DO NOTHING;
  END IF;
END $$;
