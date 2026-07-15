-- Add nullable article_code to targets for NPM leaf office allocations.
-- Article rows: one per (period, brand, sales_group, model, sales_office, article_code)
-- Model office rows (no articles): article_code IS NULL
-- D&S brand/model totals: sales_office IS NULL AND article_code IS NULL

ALTER TABLE targets ADD COLUMN IF NOT EXISTS article_code TEXT;

-- Drop any prior unique index with the same name (idempotent re-run)
DROP INDEX IF EXISTS targets_period_brand_sg_model_office_article_uidx;

-- COALESCE so NULL article_code / sales_office do not collide under Postgres UNIQUE NULL semantics
CREATE UNIQUE INDEX targets_period_brand_sg_model_office_article_uidx
  ON targets (
    planning_period_id,
    brand,
    sales_group,
    COALESCE(model, ''),
    COALESCE(sales_office, ''),
    COALESCE(article_code, '')
  );

CREATE INDEX IF NOT EXISTS idx_targets_article_code
  ON targets (planning_period_id, article_code)
  WHERE article_code IS NOT NULL;
