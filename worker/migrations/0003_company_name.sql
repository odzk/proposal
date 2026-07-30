-- ============================================================
-- One-time migration — Nuvho Company Name (per-region legal entity name)
-- ============================================================
-- schema.sql's `CREATE TABLE IF NOT EXISTS` statements already include the
-- new company_name column for a *fresh* database, but IF NOT EXISTS does not
-- retroactively add columns to an existing table. Run this once against the
-- live D1 database to bring it up to date:
--
--   wrangler d1 execute nuvho-proposals --remote --file=./worker/migrations/0003_company_name.sql
--
-- (ALTER TABLE ADD COLUMN is additive/non-destructive — existing rows get
-- the column's default/NULL, no data loss — but must only run once per
-- database, same caveat as 0001_region_settings.sql / 0002_about_nuvho.sql.)

ALTER TABLE region_settings ADD COLUMN company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE proposals       ADD COLUMN company_name TEXT;

-- AU is the one region whose entity name was already known/hardcoded
-- ("Nuvho Pty Ltd") prior to this feature — seed it so existing AU proposals
-- and Settings don't suddenly show a blank company name. UK/IE are left
-- blank until their own entity name is entered via Settings → Region Settings.
UPDATE region_settings SET company_name = 'Nuvho Pty Ltd' WHERE region = 'au' AND company_name = '';
