-- One-time migration -- add default_footnotes_json to service_categories
-- (Settings -> Body Configuration "Small Print / Footnotes" customization).
--
-- service_categories itself was added in schema.sql without this column, so
-- any D1 database created before this migration needs it added explicitly.
-- Mirrors 0004_service_categories_default_scope.sql's pattern exactly.
--
-- Apply with:
--   wrangler d1 execute nuvho-proposals --remote --file=./worker/migrations/0011_service_categories_default_footnotes.sql

ALTER TABLE service_categories ADD COLUMN default_footnotes_json TEXT NOT NULL DEFAULT '[]';
