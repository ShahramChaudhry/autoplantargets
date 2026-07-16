-- Sales Executive × Model allocation (Branch Manager)
-- Leaf source of truth; row/column/office totals are derived.

CREATE TABLE IF NOT EXISTS sales_exec_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_period_id UUID NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  sales_group TEXT NOT NULL,
  sales_office TEXT NOT NULL,
  sales_exec_code TEXT NOT NULL,
  sales_exec_name TEXT,
  brand TEXT,
  model TEXT NOT NULL,
  article_code TEXT,
  target_units INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('not_started', 'draft', 'completed', 'reopened')),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP INDEX IF EXISTS sales_exec_targets_unique_leaf;
CREATE UNIQUE INDEX sales_exec_targets_unique_leaf
  ON sales_exec_targets (
    planning_period_id,
    sales_group,
    sales_office,
    sales_exec_code,
    COALESCE(brand, ''),
    model,
    COALESCE(article_code, '')
  );

CREATE INDEX IF NOT EXISTS idx_sales_exec_targets_period_office
  ON sales_exec_targets (planning_period_id, sales_office);

ALTER TABLE sales_exec_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_anon_all" ON sales_exec_targets;
DROP POLICY IF EXISTS "mvp_authenticated_all" ON sales_exec_targets;
CREATE POLICY "mvp_anon_all" ON sales_exec_targets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mvp_authenticated_all" ON sales_exec_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
