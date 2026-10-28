-- Migration 0022: optional fee rows (2026-10-29, Hayley's feedback).
-- A fee row can be flagged as an optional extra / alternative. It is shown
-- with an "Optional" tag in the document and left out of every total
-- (frontend computeFeeTotals), so alternatives no longer read as being
-- charged twice.
--
-- Run once against the live database BEFORE deploying the matching worker:
--   wrangler d1 execute nuvho-proposals --remote --file=migrations/0022_fee_rows_optional.sql

ALTER TABLE proposal_fee_rows ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0;
