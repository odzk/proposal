-- ============================================================
-- One-time migration — About Nuvho (per-region "Nuvho Pty Ltd" about-us text)
-- ============================================================
-- schema.sql's `CREATE TABLE IF NOT EXISTS` statements already include the
-- new about_nuvho column for a *fresh* database, but IF NOT EXISTS does not
-- retroactively add columns to an existing table. Run this once against the
-- live D1 database to bring it up to date:
--
--   wrangler d1 execute nuvho-proposals --remote --file=./worker/migrations/0002_about_nuvho.sql
--
-- (ALTER TABLE ADD COLUMN is additive/non-destructive — existing rows get
-- the column's default/NULL, no data loss — but must only run once per
-- database, same caveat as 0001_region_settings.sql.)

ALTER TABLE region_settings ADD COLUMN about_nuvho TEXT NOT NULL DEFAULT '';
ALTER TABLE proposals       ADD COLUMN about_nuvho TEXT;
