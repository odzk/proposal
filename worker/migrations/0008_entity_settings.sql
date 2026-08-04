-- ============================================================
-- One-time migration — Entity Settings (per-entity address / about / footer / T&Cs / currency)
-- ============================================================
-- Replaces region_settings (keyed by region: au/uk/ie) with entity_settings
-- (keyed by Master Registry entity_code, e.g. NVH-AU-OPS) so every legal
-- entity the registry returns — not just the one "operating" entity per
-- region — can have its own address/about-us/legal-footer/currency/T&Cs
-- managed from Settings → Entities. Run this once against the live D1
-- database:
--
--   wrangler d1 execute nuvho-proposals --remote --file=./worker/migrations/0008_entity_settings.sql
--
-- region_settings is left in place (untouched, no longer written to by the
-- Settings UI) as a fallback/audit trail — it is NOT dropped here.
-- worker/src/routes/settings.ts's getRegionSettings() now derives the
-- proposal wizard's per-region defaults from entity_settings instead
-- (mapping region → its NVH-{GEO}-OPS entity code) plus the Master
-- Registry's live legal_name, so no wizard behaviour changes.

CREATE TABLE IF NOT EXISTS entity_settings (
  entity_code         TEXT PRIMARY KEY,   -- Master Registry entity_code, e.g. NVH-AU-OPS
  address             TEXT NOT NULL DEFAULT '',
  about_nuvho         TEXT NOT NULL DEFAULT '',
  footer_text         TEXT NOT NULL DEFAULT '',
  currency            TEXT NOT NULL DEFAULT 'AUD',
  clauses_json        TEXT NOT NULL DEFAULT '[]',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Carry forward whatever's already saved against the 3 previously-editable
-- regions onto their corresponding operating entity (au → NVH-AU-OPS, etc).
-- company_name is deliberately NOT carried over — Nuvho Company Name is now
-- always sourced live from the registry's legal_name, never stored locally.
INSERT OR IGNORE INTO entity_settings (entity_code, address, about_nuvho, footer_text, currency, clauses_json)
SELECT
  CASE region WHEN 'au' THEN 'NVH-AU-OPS' WHEN 'uk' THEN 'NVH-UK-OPS' WHEN 'ie' THEN 'NVH-IE-OPS' END,
  address, about_nuvho, footer_text, currency, clauses_json
FROM region_settings
WHERE region IN ('au', 'uk', 'ie');
