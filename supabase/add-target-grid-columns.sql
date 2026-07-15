-- Optional migration for existing databases that already ran schema.sql
-- Adds columns used by hierarchical Model × Sales Office target entry

ALTER TABLE targets ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS sales_office TEXT;
