-- ============================================================
-- One-time migration — Region Settings (address / footer / T&Cs / currency)
-- ============================================================
-- schema.sql's `CREATE TABLE IF NOT EXISTS proposals (...)` already includes
-- the new nuvho_address/footer_text/currency columns for a *fresh* database,
-- but IF NOT EXISTS does not retroactively add columns to an existing table.
-- Run this once against the live D1 database to bring it up to date:
--
--   wrangler d1 execute nuvho-proposals --remote --file=./worker/migrations/0001_region_settings.sql
--
-- (Do NOT re-run schema.sql's ALTER-equivalent columns by hand elsewhere —
-- this file is the single source of truth for this migration. The region_settings
-- CREATE TABLE / INSERT OR IGNORE below are also in schema.sql and are safe
-- to run more than once; the ALTER TABLE statements are NOT and must only
-- run once per database.)

ALTER TABLE proposals ADD COLUMN nuvho_address TEXT;
ALTER TABLE proposals ADD COLUMN footer_text   TEXT;
ALTER TABLE proposals ADD COLUMN currency      TEXT NOT NULL DEFAULT 'AUD';

CREATE TABLE IF NOT EXISTS region_settings (
  region              TEXT PRIMARY KEY,
  address             TEXT NOT NULL DEFAULT '',
  footer_text         TEXT NOT NULL DEFAULT '',
  currency            TEXT NOT NULL DEFAULT 'AUD',
  clauses_json        TEXT NOT NULL DEFAULT '[]',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO region_settings (region, address, footer_text, currency, clauses_json) VALUES
('au', '', '', 'AUD', '[
  {"id":"term_au_payment",      "heading":"Payment Terms",           "text":"Fees are invoiced in advance (monthly retainers) or on issue (setup/fixed fees) and are payable within 14 days of the invoice date, in AUD.", "enabled":true},
  {"id":"term_au_contract",     "heading":"Contract Term & Renewal", "text":"This agreement commences on the date of signing and continues for the term specified against each service. Thereafter it continues on a month-to-month basis unless terminated by either party.", "enabled":true},
  {"id":"term_au_cancellation", "heading":"Cancellation",            "text":"Either party may terminate this agreement with 60 days'' written notice, effective after the expiry of the initial term.", "enabled":true},
  {"id":"term_au_confidential", "heading":"Confidentiality",         "text":"Both parties agree to keep confidential all non-public information disclosed in connection with this agreement and this proposal.", "enabled":true},
  {"id":"term_au_liability",    "heading":"Limitation of Liability", "text":"Nuvho''s aggregate liability under this agreement is limited to the fees paid in the twelve months preceding the claim.", "enabled":true},
  {"id":"term_au_ip",           "heading":"Intellectual Property",   "text":"Nuvho retains ownership of all systems, processes, and materials used to deliver the services. The client retains ownership of its own brand assets and data.", "enabled":true},
  {"id":"term_au_forcemajeure", "heading":"Force Majeure",           "text":"Neither party is liable for delay or failure to perform caused by circumstances beyond its reasonable control.", "enabled":true},
  {"id":"term_au_governinglaw", "heading":"Governing Law",           "text":"This agreement is governed by the laws of Queensland, Australia, and the parties submit to the exclusive jurisdiction of its courts.", "enabled":true}
]'),
('uk', '', '', 'GBP', '[
  {"id":"term_uk_payment",      "heading":"Payment Terms",           "text":"Fees are invoiced in advance (monthly retainers) or on issue (setup/fixed fees) and are payable within 14 days of the invoice date, in GBP.", "enabled":true},
  {"id":"term_uk_contract",     "heading":"Contract Term & Renewal", "text":"This agreement commences on the date of signing and continues for the term specified against each service. Thereafter it continues on a month-to-month basis unless terminated by either party.", "enabled":true},
  {"id":"term_uk_cancellation", "heading":"Cancellation",            "text":"Either party may terminate this agreement with 60 days'' written notice, effective after the expiry of the initial term.", "enabled":true},
  {"id":"term_uk_confidential", "heading":"Confidentiality",         "text":"Both parties agree to keep confidential all non-public information disclosed in connection with this agreement and this proposal.", "enabled":true},
  {"id":"term_uk_liability",    "heading":"Limitation of Liability", "text":"Nuvho''s aggregate liability under this agreement is limited to the fees paid in the twelve months preceding the claim.", "enabled":true},
  {"id":"term_uk_ip",           "heading":"Intellectual Property",   "text":"Nuvho retains ownership of all systems, processes, and materials used to deliver the services. The client retains ownership of its own brand assets and data.", "enabled":true},
  {"id":"term_uk_forcemajeure", "heading":"Force Majeure",           "text":"Neither party is liable for delay or failure to perform caused by circumstances beyond its reasonable control.", "enabled":true},
  {"id":"term_uk_governinglaw", "heading":"Governing Law",           "text":"This agreement is governed by the laws of England & Wales, and the parties submit to the exclusive jurisdiction of its courts.", "enabled":true}
]'),
('ie', '', '', 'EUR', '[
  {"id":"term_ie_payment",      "heading":"Payment Terms",           "text":"Fees are invoiced in advance (monthly retainers) or on issue (setup/fixed fees) and are payable within 14 days of the invoice date, in EUR.", "enabled":true},
  {"id":"term_ie_contract",     "heading":"Contract Term & Renewal", "text":"This agreement commences on the date of signing and continues for the term specified against each service. Thereafter it continues on a month-to-month basis unless terminated by either party.", "enabled":true},
  {"id":"term_ie_cancellation", "heading":"Cancellation",            "text":"Either party may terminate this agreement with 60 days'' written notice, effective after the expiry of the initial term.", "enabled":true},
  {"id":"term_ie_confidential", "heading":"Confidentiality",         "text":"Both parties agree to keep confidential all non-public information disclosed in connection with this agreement and this proposal.", "enabled":true},
  {"id":"term_ie_liability",    "heading":"Limitation of Liability", "text":"Nuvho''s aggregate liability under this agreement is limited to the fees paid in the twelve months preceding the claim.", "enabled":true},
  {"id":"term_ie_ip",           "heading":"Intellectual Property",   "text":"Nuvho retains ownership of all systems, processes, and materials used to deliver the services. The client retains ownership of its own brand assets and data.", "enabled":true},
  {"id":"term_ie_forcemajeure", "heading":"Force Majeure",           "text":"Neither party is liable for delay or failure to perform caused by circumstances beyond its reasonable control.", "enabled":true},
  {"id":"term_ie_governinglaw", "heading":"Governing Law",           "text":"This agreement is governed by the laws of Ireland, and the parties submit to the exclusive jurisdiction of its courts.", "enabled":true}
]');
